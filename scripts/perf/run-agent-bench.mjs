import { Buffer } from "node:buffer";
import { rmSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
	buildTaskResultSchema,
	buildPromptText,
	compareDirectories,
	copyDirectory,
	ensureDir,
	fileExists,
	getFileInfo,
	listScenarioDefinitions,
	loadScenarioDefinition,
	matchesScenarioPattern,
	parseArgs,
	promptsRoot,
	readJson,
	repoRoot,
	resolveTemplateValue,
	resultsRoot,
	runCommand,
	timestampSlug,
	toInteger,
	vaultRoot,
	writeJson,
	writeText
} from "./lib.mjs";

const agentConfigs = {
	codex: {
		command: "codex",
		buildArgs({ promptText, schemaPath, finalPath }) {
			return [
				"exec",
				"--cd",
				repoRoot,
				"--sandbox",
				"workspace-write",
				"--output-schema",
				schemaPath,
				"--output-last-message",
				finalPath,
				"--color",
				"never",
				"--json",
				promptText
			];
		},
		getFinalResultPath(runDir) {
			return resolve(runDir, "final.json");
		}
	},
	claude: {
		command: "claude",
		buildArgs({ promptText, schemaJson }) {
			return [
				"-p",
				"--output-format",
				"json",
				"--json-schema",
				schemaJson,
				"--permission-mode",
				"dontAsk",
				"--add-dir",
				repoRoot,
				promptText
			];
		},
		getFinalResultPath(runDir) {
			return resolve(runDir, "final.json");
		}
	}
};

function selectScenarios(pattern) {
	if (pattern && !pattern.includes("*")) {
		return [loadScenarioDefinition(pattern).value];
	}

	return listScenarioDefinitions()
		.map((entry) => entry.value)
		.filter((scenario) => matchesScenarioPattern(scenario.id, pattern ?? "*"));
}

async function prepareVault(profile, seed, manifestDir) {
	const build = await runCommand("./bin/obsidian-dev", ["pnpm", "run", "build"], {
		cwd: repoRoot,
		timeoutMs: 600000
	});
	if (build.exitCode !== 0) {
		throw new Error(`Build failed:\n${build.stderr || build.stdout}`);
	}

	const base = await runCommand("./bin/obsidian-dev", ["pnpm", "run", "vault:generate"], {
		cwd: repoRoot,
		timeoutMs: 600000
	});
	if (base.exitCode !== 0) {
		throw new Error(`vault:generate failed:\n${base.stderr || base.stdout}`);
	}

	const generate = await runCommand(
		"node",
		["scripts/perf/generate-synthetic-vault.mjs", "--profile", profile, "--seed", String(seed)],
		{
			cwd: repoRoot,
			timeoutMs: 600000
		}
	);
	if (generate.exitCode !== 0) {
		throw new Error(`Synthetic generator failed:\n${generate.stderr || generate.stdout}`);
	}

	writeText(resolve(manifestDir, "prepare-build.stdout.log"), build.stdout);
	writeText(resolve(manifestDir, "prepare-build.stderr.log"), build.stderr);
	writeText(resolve(manifestDir, "prepare-vault.stdout.log"), base.stdout);
	writeText(resolve(manifestDir, "prepare-vault.stderr.log"), base.stderr);
	writeText(resolve(manifestDir, "prepare-generate.stdout.log"), generate.stdout);
	writeText(resolve(manifestDir, "prepare-generate.stderr.log"), generate.stderr);
}

async function runSingleScenario({
	agent,
	scenario,
	profile,
	seed,
	runIndex,
	sessionRoot,
	keepWorkArtifacts
}) {
	const runDir = resolve(
		sessionRoot,
		agent,
		scenario.id,
		`run-${String(runIndex).padStart(2, "0")}`
	);
	ensureDir(runDir);

	await prepareVault(profile, seed, runDir);

	const baselinePath = resolve(runDir, "baseline-vault");
	copyDirectory(vaultRoot, baselinePath);

	const goldenPath = resolve(vaultRoot, "perf-generated/_golden.json");
	const golden = readJson(goldenPath);
	const resolvedScenario = resolveTemplateValue(scenario, { golden });
	const resolvedSchema = buildTaskResultSchema({
		taskId: resolvedScenario.id,
		expectedAnswer: resolvedScenario.expectedAnswer
	});
	const schemaPath = resolve(runDir, "task-result.schema.json");
	const schemaJson = JSON.stringify(resolvedSchema);
	writeJson(schemaPath, resolvedSchema);
	const promptText = buildPromptText(resolvedScenario.promptTemplate);
	const promptPath = resolve(
		promptsRoot,
		`${basename(sessionRoot)}-${agent}-${scenario.id}-run-${padRun(runIndex)}.txt`
	);
	writeText(promptPath, promptText);
	writeText(resolve(runDir, "prompt.txt"), promptText);
	writeJson(resolve(runDir, "scenario.resolved.json"), resolvedScenario);

	const config = agentConfigs[agent];
	const finalPath = config.getFinalResultPath(runDir);
	const commandArgs = config.buildArgs({
		promptText,
		schemaPath,
		schemaJson,
		finalPath
	});
	const execution = await runCommand(config.command, commandArgs, {
		cwd: repoRoot,
		timeoutMs: resolvedScenario.timeoutMs
	});
	const combinedOutput = `${execution.stdout}\n${execution.stderr}`;
	const requiredCommandsMatched = resolvedScenario.requiredCommands.filter((command) =>
		combinedOutput.includes(command)
	);

	writeText(resolve(runDir, "stdout.log"), execution.stdout);
	writeText(resolve(runDir, "stderr.log"), execution.stderr);
	writeJson(resolve(runDir, "command.json"), {
		command: config.command,
		args: commandArgs
	});

	if (agent === "claude" && execution.stdout.trim().length > 0) {
		writeText(finalPath, execution.stdout.trim());
	}

	const diff = compareDirectories(baselinePath, vaultRoot, { ignorePrefixes: [".obsidian/"] });
	const diffPath = resolve(runDir, "vault.diff.json");
	writeJson(diffPath, diff);

	const verify = await runCommand(
		"node",
		[
			"scripts/perf/verify-agent-result.mjs",
			"--scenario",
			scenario.id,
			"--golden",
			goldenPath,
			"--final",
			finalPath,
			"--baseline",
			baselinePath,
			"--current",
			vaultRoot,
			"--output",
			resolve(runDir, "judge.json")
		],
		{
			cwd: repoRoot,
			timeoutMs: 60000
		}
	);

	writeText(resolve(runDir, "verify.stdout.log"), verify.stdout);
	writeText(resolve(runDir, "verify.stderr.log"), verify.stderr);

	const judge = readJson(resolve(runDir, "judge.json"));
	const result = {
		agent,
		scenarioId: scenario.id,
		profile,
		seed,
		runIndex,
		elapsedMs: execution.elapsedMs,
		exitCode: execution.exitCode,
		timedOut: execution.timedOut,
		stdoutBytes: Buffer.byteLength(execution.stdout, "utf8"),
		stderrBytes: Buffer.byteLength(execution.stderr, "utf8"),
		finalPath,
		finalJsonValid: judge.finalJsonValid,
		answerPassed: judge.answerPassed,
		diffPassed: judge.diffPassed,
		judgePassed: judge.passed,
		diffSummary: judge.diffSummary,
		requiredCommands: resolvedScenario.requiredCommands,
		requiredCommandsMatched,
		requiredCommandsEvidence: "stdout_stderr_substring_scan",
		runDir,
		promptPath,
		goldenPath,
		finalExists: fileExists(finalPath),
		finalInfo: fileExists(finalPath) ? getFileInfo(finalPath) : null,
		keepWorkArtifacts
	};
	writeJson(resolve(runDir, "result.json"), result);

	if (!keepWorkArtifacts) {
		rmSync(baselinePath, { recursive: true, force: true });
	}

	return result;
}

function padRun(runIndex) {
	return String(runIndex).padStart(2, "0");
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const agent = String(args.agent ?? "");
	if (!agentConfigs[agent]) {
		throw new Error('--agent is required and must be one of: "codex", "claude".');
	}

	const scenarioPattern = String(args.scenario ?? "*");
	const scenarios = selectScenarios(scenarioPattern);
	if (scenarios.length === 0) {
		throw new Error(`No scenarios matched: ${scenarioPattern}`);
	}

	const runs = toInteger(args.runs, 3);
	const seed = toInteger(args.seed, 42);
	const keepWorkArtifacts = args["keep-work-artifacts"] !== "false";
	const profileOverride = args.profile ? String(args.profile) : undefined;
	const sessionRoot = resolve(
		String(args["output-dir"] ?? resolve(resultsRoot, timestampSlug()))
	);
	ensureDir(sessionRoot);
	ensureDir(promptsRoot);

	const results = [];

	for (const scenario of scenarios) {
		const profile = profileOverride ?? scenario.profile;
		for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
			results.push(
				await runSingleScenario({
					agent,
					scenario,
					profile,
					seed,
					runIndex,
					sessionRoot,
					keepWorkArtifacts
				})
			);
		}
	}

	writeJson(resolve(sessionRoot, "index.json"), results);
	console.log(JSON.stringify({ outputDir: sessionRoot, runs: results }, null, 2));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});

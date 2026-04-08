import { resolve } from "node:path";
import {
	compareDirectories,
	deepEqual,
	loadScenarioDefinition,
	parseArgs,
	readJson,
	resolveTemplateValue,
	validateTaskResult,
	vaultRoot,
	writeJson
} from "./lib.mjs";

function normalizeToArray(value) {
	return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function validateExpectedDiff(changeMap, matcher) {
	const errors = [];
	const change = changeMap.get(matcher.path);

	if (matcher.mustExist === true && !change) {
		errors.push(`Expected a change for "${matcher.path}" but none was found.`);
	}

	if (matcher.mustNotExist === true && change) {
		errors.push(`Expected no file at "${matcher.path}" but the path exists after the run.`);
	}

	if (!change) {
		return errors;
	}

	const text = change.currentText ?? "";
	for (const needle of normalizeToArray(matcher.contains)) {
		if (!text.includes(String(needle))) {
			errors.push(`Expected "${matcher.path}" to contain "${needle}".`);
		}
	}

	for (const needle of normalizeToArray(matcher.notContains)) {
		if (text.includes(String(needle))) {
			errors.push(`Expected "${matcher.path}" not to contain "${needle}".`);
		}
	}

	if (matcher.lineCountEquals !== undefined) {
		const lineCount =
			text.length === 0
				? 0
				: text
						.replaceAll("\r\n", "\n")
						.split("\n")
						.filter((_, index, lines) => {
							return !(index === lines.length - 1 && lines[index] === "");
						}).length;
		if (lineCount !== matcher.lineCountEquals) {
			errors.push(
				`Expected "${matcher.path}" line count ${matcher.lineCountEquals} but received ${lineCount}.`
			);
		}
	}

	return errors;
}

function collectUnexpectedChanges(diff, expectedPaths, forbiddenPaths) {
	const errors = [];
	for (const change of diff.changes) {
		if (
			forbiddenPaths.some(
				(prefix) => change.path === prefix || change.path.startsWith(prefix)
			)
		) {
			errors.push(`Forbidden path changed: ${change.path}`);
		}

		if (!expectedPaths.has(change.path)) {
			errors.push(`Unexpected vault change: ${change.path}`);
		}
	}
	return errors;
}

function loadFinalResult(finalPath) {
	try {
		return {
			value: readJson(finalPath),
			parseError: undefined
		};
	} catch (error) {
		return {
			value: undefined,
			parseError: error instanceof Error ? error.message : String(error)
		};
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const scenarioId = String(args.scenario ?? "");
	if (scenarioId.length === 0) {
		throw new Error("--scenario is required.");
	}

	const goldenPath = String(args.golden ?? resolve(vaultRoot, "perf-generated/_golden.json"));
	const finalPath = String(args.final ?? "");
	if (finalPath.length === 0) {
		throw new Error("--final is required.");
	}

	const baselinePath = String(args.baseline ?? "");
	const currentPath = String(args.current ?? vaultRoot);
	const outputPath = String(args.output ?? "");
	const scenario = loadScenarioDefinition(scenarioId).value;
	const golden = readJson(goldenPath);
	const resolvedScenario = resolveTemplateValue(scenario, { golden });
	const finalResult = loadFinalResult(finalPath);
	const validation = finalResult.value
		? validateTaskResult(finalResult.value)
		: { valid: false, errors: [`Could not parse final JSON: ${finalResult.parseError}`] };

	const diff =
		baselinePath.length > 0
			? compareDirectories(baselinePath, currentPath, { ignorePrefixes: [".obsidian/"] })
			: { summary: { added: 0, modified: 0, deleted: 0, total: 0 }, changes: [] };
	const changeMap = new Map(diff.changes.map((change) => [change.path, change]));
	const expectedPaths = new Set(resolvedScenario.expectedDiff.map((item) => item.path));
	const answerErrors = [];

	if (!validation.valid || !finalResult.value) {
		answerErrors.push(...validation.errors);
	} else {
		if (finalResult.value.taskId !== resolvedScenario.id) {
			answerErrors.push(
				`Expected taskId "${resolvedScenario.id}" but received "${finalResult.value.taskId}".`
			);
		}

		if (finalResult.value.status !== "success") {
			answerErrors.push(
				`Expected status "success" but received "${finalResult.value.status}".`
			);
		}

		if (!deepEqual(finalResult.value.answer, resolvedScenario.expectedAnswer)) {
			answerErrors.push(
				`Answer mismatch. Expected ${JSON.stringify(
					resolvedScenario.expectedAnswer
				)} but received ${JSON.stringify(finalResult.value.answer)}.`
			);
		}
	}

	const diffErrors = resolvedScenario.expectedDiff.flatMap((matcher) =>
		validateExpectedDiff(changeMap, matcher)
	);
	diffErrors.push(
		...collectUnexpectedChanges(diff, expectedPaths, resolvedScenario.forbiddenPaths)
	);

	const judge = {
		scenarioId: resolvedScenario.id,
		finalJsonValid: validation.valid,
		answerPassed: answerErrors.length === 0,
		diffPassed: diffErrors.length === 0,
		passed: answerErrors.length === 0 && diffErrors.length === 0,
		checks: {
			answerErrors,
			diffErrors
		},
		diffSummary: diff.summary
	};

	if (outputPath.length > 0) {
		writeJson(outputPath, judge);
	} else {
		console.log(JSON.stringify(judge, null, 2));
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});

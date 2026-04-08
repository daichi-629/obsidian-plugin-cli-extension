import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync
} from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(thisDir, "..", "..");
export const perfRoot = resolve(repoRoot, "perf");
export const vaultRoot = resolve(repoRoot, "vault");
export const scenarioRoot = resolve(perfRoot, "scenarios");
export const schemaRoot = resolve(perfRoot, "schema");
export const promptsRoot = resolve(perfRoot, "prompts");
export const resultsRoot = resolve(perfRoot, "results");

export function parseArgs(argv) {
	const args = { _: [] };

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === "--") {
			continue;
		}
		if (!token.startsWith("--")) {
			args._.push(token);
			continue;
		}

		const body = token.slice(2);
		const equalsIndex = body.indexOf("=");
		if (equalsIndex >= 0) {
			args[body.slice(0, equalsIndex)] = body.slice(equalsIndex + 1);
			continue;
		}

		const next = argv[index + 1];
		if (next && !next.startsWith("--")) {
			args[body] = next;
			index += 1;
			continue;
		}

		args[body] = true;
	}

	return args;
}

export function toInteger(value, fallback) {
	if (value === undefined) {
		return fallback;
	}

	const parsed = Number.parseInt(String(value), 10);
	if (Number.isNaN(parsed)) {
		throw new Error(`Expected an integer value but received: ${value}`);
	}

	return parsed;
}

export function toBoolean(value, fallback = false) {
	if (value === undefined) {
		return fallback;
	}

	if (typeof value === "boolean") {
		return value;
	}

	return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

export function ensureDir(path) {
	mkdirSync(path, { recursive: true });
}

export function resetDir(path) {
	rmSync(path, { recursive: true, force: true });
	mkdirSync(path, { recursive: true });
}

export function writeText(path, text) {
	ensureDir(dirname(path));
	writeFileSync(path, text, "utf8");
}

export function writeJson(path, value) {
	writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

export function copyDirectory(fromPath, toPath) {
	rmSync(toPath, { recursive: true, force: true });
	cpSync(fromPath, toPath, { recursive: true });
}

export function timestampSlug(date = new Date()) {
	const parts = [
		date.getUTCFullYear().toString().padStart(4, "0"),
		(date.getUTCMonth() + 1).toString().padStart(2, "0"),
		date.getUTCDate().toString().padStart(2, "0"),
		date.getUTCHours().toString().padStart(2, "0"),
		date.getUTCMinutes().toString().padStart(2, "0"),
		date.getUTCSeconds().toString().padStart(2, "0")
	];
	return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
}

function listFilesInternal(rootPath, currentPath, results) {
	for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
		const absolutePath = resolve(currentPath, entry.name);
		if (entry.isDirectory()) {
			listFilesInternal(rootPath, absolutePath, results);
			continue;
		}

		results.push(relative(rootPath, absolutePath).replaceAll("\\", "/"));
	}
}

export function listFiles(rootPath) {
	if (!existsSync(rootPath)) {
		return [];
	}

	const results = [];
	listFilesInternal(rootPath, rootPath, results);
	results.sort((left, right) => left.localeCompare(right));
	return results;
}

export function shouldIgnorePath(path, prefixes = []) {
	return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

function looksLikeText(buffer, path) {
	const extension = extname(path).toLowerCase();
	if ([".md", ".txt", ".json", ".canvas", ".csv", ".patch"].includes(extension)) {
		return true;
	}

	for (let index = 0; index < Math.min(buffer.length, 1024); index += 1) {
		if (buffer[index] === 0) {
			return false;
		}
	}

	return true;
}

export function buildDirectorySnapshot(rootPath, options = {}) {
	const ignorePrefixes = options.ignorePrefixes ?? [];
	const snapshot = new Map();

	for (const path of listFiles(rootPath)) {
		if (shouldIgnorePath(path, ignorePrefixes)) {
			continue;
		}

		const absolutePath = resolve(rootPath, path);
		const content = readFileSync(absolutePath);
		const isText = looksLikeText(content, path);
		snapshot.set(path, {
			path,
			size: content.byteLength,
			hash: createHash("sha256").update(content).digest("hex"),
			isText,
			text: isText ? content.toString("utf8") : undefined
		});
	}

	return snapshot;
}

export function compareDirectories(baselinePath, currentPath, options = {}) {
	const ignorePrefixes = options.ignorePrefixes ?? [];
	const baseline = buildDirectorySnapshot(baselinePath, { ignorePrefixes });
	const current = buildDirectorySnapshot(currentPath, { ignorePrefixes });
	const paths = new Set([...baseline.keys(), ...current.keys()]);
	const changes = [];

	for (const path of [...paths].sort((left, right) => left.localeCompare(right))) {
		const before = baseline.get(path);
		const after = current.get(path);

		if (!before && after) {
			changes.push({
				path,
				status: "added",
				isText: after.isText,
				currentText: after.text,
				currentSize: after.size
			});
			continue;
		}

		if (before && !after) {
			changes.push({
				path,
				status: "deleted",
				isText: before.isText,
				previousText: before.text,
				previousSize: before.size
			});
			continue;
		}

		if (before && after && before.hash !== after.hash) {
			changes.push({
				path,
				status: "modified",
				isText: before.isText && after.isText,
				previousText: before.text,
				currentText: after.text,
				previousSize: before.size,
				currentSize: after.size
			});
		}
	}

	return {
		summary: {
			added: changes.filter((change) => change.status === "added").length,
			modified: changes.filter((change) => change.status === "modified").length,
			deleted: changes.filter((change) => change.status === "deleted").length,
			total: changes.length
		},
		changes
	};
}

export function countMatchingLines(content, needle) {
	const normalized = content.replaceAll("\r\n", "\n");
	if (normalized.length === 0) {
		return 0;
	}

	return normalized
		.split("\n")
		.filter((line) => line.includes(needle)).length;
}

export function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getByPath(source, path) {
	const segments = path.split(".").filter(Boolean);
	let current = source;
	for (const segment of segments) {
		if (current === undefined || current === null || !(segment in current)) {
			throw new Error(`Missing template value: ${path}`);
		}
		current = current[segment];
	}
	return current;
}

function resolveTemplateString(template, context) {
	const exactMatch = template.match(/^\{\{([^}]+)\}\}$/);
	if (exactMatch) {
		return getByPath(context, exactMatch[1].trim());
	}

	return template.replace(/\{\{([^}]+)\}\}/g, (_, expression) => {
		const value = getByPath(context, expression.trim());
		return typeof value === "string" ? value : JSON.stringify(value);
	});
}

export function resolveTemplateValue(value, context) {
	if (typeof value === "string") {
		return resolveTemplateString(value, context);
	}

	if (Array.isArray(value)) {
		return value.map((item) => resolveTemplateValue(item, context));
	}

	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, resolveTemplateValue(item, context)])
		);
	}

	return value;
}

export function validateScenarioDefinition(input, filePath = "scenario") {
	if (!input || typeof input !== "object") {
		throw new Error(`Invalid scenario in ${filePath}: expected an object.`);
	}

	for (const key of [
		"id",
		"kind",
		"profile",
		"promptTemplate",
		"timeoutMs",
		"maxTurnsHint",
		"expectedAnswer",
		"expectedDiff",
		"forbiddenPaths",
		"requiredCommands",
		"tags"
	]) {
		if (!(key in input)) {
			throw new Error(`Invalid scenario in ${filePath}: missing "${key}".`);
		}
	}

	if (!["search", "operate", "mixed"].includes(input.kind)) {
		throw new Error(`Invalid scenario kind in ${filePath}: ${input.kind}`);
	}

	if (!["small", "large", "xl"].includes(input.profile)) {
		throw new Error(`Invalid scenario profile in ${filePath}: ${input.profile}`);
	}

	if (
		!(
			typeof input.promptTemplate === "string" ||
			(Array.isArray(input.promptTemplate) &&
				input.promptTemplate.every((value) => typeof value === "string"))
		)
	) {
		throw new Error(`Invalid promptTemplate in ${filePath}.`);
	}

	if (!Array.isArray(input.expectedDiff)) {
		throw new Error(`Invalid expectedDiff in ${filePath}.`);
	}

	return input;
}

export function validateTaskResult(result) {
	if (!result || typeof result !== "object") {
		return { valid: false, errors: ["Result is not an object."] };
	}

	const errors = [];
	if (typeof result.taskId !== "string" || result.taskId.length === 0) {
		errors.push("taskId must be a non-empty string.");
	}
	if (!["success", "failed"].includes(result.status)) {
		errors.push('status must be either "success" or "failed".');
	}
	if (!result.answer || typeof result.answer !== "object" || Array.isArray(result.answer)) {
		errors.push("answer must be an object.");
	}
	if ("notes" in result && typeof result.notes !== "string") {
		errors.push("notes must be a string when present.");
	}
	return {
		valid: errors.length === 0,
		errors
	};
}

export function deepEqual(left, right) {
	if (left === right) {
		return true;
	}

	if (typeof left !== typeof right) {
		return false;
	}

	if (Array.isArray(left) && Array.isArray(right)) {
		return (
			left.length === right.length && left.every((value, index) => deepEqual(value, right[index]))
		);
	}

	if (
		left &&
		right &&
		typeof left === "object" &&
		typeof right === "object" &&
		!Array.isArray(left) &&
		!Array.isArray(right)
	) {
		const leftKeys = Object.keys(left).sort();
		const rightKeys = Object.keys(right).sort();
		return (
			deepEqual(leftKeys, rightKeys) &&
			leftKeys.every((key) => deepEqual(left[key], right[key]))
		);
	}

	return false;
}

export function buildSchemaFromValue(value) {
	if (value === null) {
		return { type: "null" };
	}

	if (typeof value === "string") {
		return { type: "string" };
	}

	if (typeof value === "boolean") {
		return { type: "boolean" };
	}

	if (typeof value === "number") {
		return { type: Number.isInteger(value) ? "integer" : "number" };
	}

	if (Array.isArray(value)) {
		if (value.length === 0) {
			return {
				type: "array",
				items: {}
			};
		}

		return {
			type: "array",
			items: buildSchemaFromValue(value[0])
		};
	}

	if (typeof value === "object") {
		const properties = Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, buildSchemaFromValue(item)])
		);
		return {
			type: "object",
			properties,
			required: Object.keys(properties),
			additionalProperties: false
		};
	}

	throw new Error(`Unsupported schema value type: ${typeof value}`);
}

export function buildTaskResultSchema(input) {
	return {
		$schema: "https://json-schema.org/draft/2020-12/schema",
		title: "ResolvedAgentBenchmarkTaskResult",
		type: "object",
		properties: {
			taskId: {
				type: "string",
				const: input.taskId
			},
			status: {
				type: "string",
				enum: ["success", "failed"]
			},
			answer: buildSchemaFromValue(input.expectedAnswer)
		},
		required: ["taskId", "status", "answer"],
		additionalProperties: false
	};
}

export function loadScenarioDefinition(id) {
	const filePath = resolve(scenarioRoot, `${id}.json`);
	if (!existsSync(filePath)) {
		throw new Error(`Scenario file not found: ${filePath}`);
	}
	return {
		filePath,
		value: validateScenarioDefinition(readJson(filePath), filePath)
	};
}

export function listScenarioDefinitions() {
	return listFiles(scenarioRoot)
		.filter((path) => path.endsWith(".json"))
		.map((path) => {
			const filePath = resolve(scenarioRoot, path);
			return {
				filePath,
				value: validateScenarioDefinition(readJson(filePath), filePath)
			};
		});
}

export function matchesScenarioPattern(id, pattern) {
	if (!pattern || pattern === "*") {
		return true;
	}

	const matcher = new RegExp(
		`^${pattern
			.split("*")
			.map((part) => escapeRegExp(part))
			.join(".*")}$`
	);
	return matcher.test(id);
}

export function buildPromptText(promptTemplate) {
	const lines = Array.isArray(promptTemplate) ? promptTemplate : [promptTemplate];
	return `${lines.join("\n\n")}\n`;
}

export async function runCommand(command, args, options = {}) {
	const startedAt = process.hrtime.bigint();
	const child = spawn(command, args, {
		cwd: options.cwd ?? repoRoot,
		env: { ...process.env, ...(options.env ?? {}) },
		stdio: ["pipe", "pipe", "pipe"]
	});

	let stdout = "";
	let stderr = "";
	let timedOut = false;

	child.stdout.on("data", (chunk) => {
		stdout += chunk.toString();
	});

	child.stderr.on("data", (chunk) => {
		stderr += chunk.toString();
	});

	let timeoutId;
	if (options.timeoutMs) {
		timeoutId = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
			setTimeout(() => child.kill("SIGKILL"), 1000).unref();
		}, options.timeoutMs);
	}

	if (options.stdinText) {
		child.stdin.write(options.stdinText);
	}
	child.stdin.end();

	const exit = await new Promise((resolvePromise, rejectPromise) => {
		child.on("error", rejectPromise);
		child.on("close", (code, signal) => resolvePromise({ code, signal }));
	});

	if (timeoutId) {
		clearTimeout(timeoutId);
	}

	const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

	return {
		command,
		args,
		cwd: options.cwd ?? repoRoot,
		stdout,
		stderr,
		exitCode: exit.code,
		signal: exit.signal,
		timedOut,
		elapsedMs
	};
}

export function fileExists(path) {
	return existsSync(path);
}

export function getFileInfo(path) {
	const stats = statSync(path);
	return {
		path,
		size: stats.size,
		mtimeMs: stats.mtimeMs
	};
}

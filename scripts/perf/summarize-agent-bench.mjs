import { resolve } from "node:path";
import {
	listFiles,
	parseArgs,
	readJson,
	resultsRoot,
	writeJson,
	writeText
} from "./lib.mjs";

function median(values) {
	if (values.length === 0) {
		return null;
	}

	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[middle - 1] + sorted[middle]) / 2
		: sorted[middle];
}

function groupKey(result) {
	return `${result.agent}::${result.scenarioId}`;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const inputRoot = resolve(String(args.input ?? resultsRoot));
	const outputJsonPath = args["output-json"] ? resolve(String(args["output-json"])) : undefined;
	const outputCsvPath = args["output-csv"] ? resolve(String(args["output-csv"])) : undefined;
	const resultPaths = listFiles(inputRoot).filter((path) => path.endsWith("/result.json"));
	const results = resultPaths.map((path) => readJson(resolve(inputRoot, path)));
	const grouped = new Map();

	for (const result of results) {
		const key = groupKey(result);
		if (!grouped.has(key)) {
			grouped.set(key, []);
		}
		grouped.get(key).push(result);
	}

	const summary = [...grouped.entries()]
		.map(([key, group]) => {
			const [agent, scenarioId] = key.split("::");
			const elapsedValues = group.map((item) => item.elapsedMs);
			const stdoutValues = group.map((item) => item.stdoutBytes);
			return {
				agent,
				scenarioId,
				runs: group.length,
				passRate: group.filter((item) => item.judgePassed).length / group.length,
				medianElapsedMs: median(elapsedValues),
				minElapsedMs: Math.min(...elapsedValues),
				maxElapsedMs: Math.max(...elapsedValues),
				medianStdoutBytes: median(stdoutValues)
			};
		})
		.sort((left, right) =>
			`${left.agent}:${left.scenarioId}`.localeCompare(`${right.agent}:${right.scenarioId}`)
		);

	if (outputJsonPath) {
		writeJson(outputJsonPath, summary);
	}

	if (outputCsvPath) {
		const lines = [
			"agent,scenarioId,runs,passRate,medianElapsedMs,minElapsedMs,maxElapsedMs,medianStdoutBytes"
		];
		for (const row of summary) {
			lines.push(
				[
					row.agent,
					row.scenarioId,
					row.runs,
					row.passRate,
					row.medianElapsedMs,
					row.minElapsedMs,
					row.maxElapsedMs,
					row.medianStdoutBytes
				].join(",")
			);
		}
		writeText(outputCsvPath, `${lines.join("\n")}\n`);
	}

	console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});

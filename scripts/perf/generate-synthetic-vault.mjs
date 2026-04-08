import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
	countMatchingLines,
	ensureDir,
	parseArgs,
	repoRoot,
	resetDir,
	toInteger,
	vaultRoot,
	writeJson,
	writeText
} from "./lib.mjs";

const profileConfigs = {
	small: {
		targetMarkdownNotes: 300,
		largeMarkdownNotes: 10,
		textFiles: 20,
		canvasFiles: 5,
		attachments: 50,
		linesPerRegularNote: 10,
		linesPerLargeNote: 140
	},
	large: {
		targetMarkdownNotes: 3000,
		largeMarkdownNotes: 80,
		textFiles: 80,
		canvasFiles: 20,
		attachments: 300,
		linesPerRegularNote: 14,
		linesPerLargeNote: 200
	},
	xl: {
		targetMarkdownNotes: 12000,
		largeMarkdownNotes: 240,
		textFiles: 200,
		canvasFiles: 50,
		attachments: 1000,
		linesPerRegularNote: 16,
		linesPerLargeNote: 240
	}
};

function createPrng(seed) {
	let state = seed >>> 0;
	return () => {
		state = (1664525 * state + 1013904223) >>> 0;
		return state / 0x1_0000_0000;
	};
}

function pad(number, width) {
	return String(number).padStart(width, "0");
}

function createWriter(rootPath) {
	const files = [];
	return {
		write(relativePath, content) {
			const targetPath = resolve(rootPath, relativePath);
			ensureDir(dirname(targetPath));
			if (typeof content === "string") {
				writeText(targetPath, content);
				files.push({ path: relativePath, bytes: Buffer.byteLength(content, "utf8") });
			} else {
				writeFileSync(targetPath, content);
				files.push({ path: relativePath, bytes: content.byteLength });
			}
		},
		files
	};
}

function makeRegularNote(index, linkTargets, linesPerRegularNote) {
	const lines = [
		`# Synthetic Note ${pad(index, 5)}`,
		"",
		`Synthetic benchmark document ${pad(index, 5)} for large vault traversal.`
	];

	for (let lineIndex = 0; lineIndex < linesPerRegularNote; lineIndex += 1) {
		const linkA = linkTargets[(lineIndex * 2) % linkTargets.length];
		const linkB = linkTargets[(lineIndex * 2 + 1) % linkTargets.length];
		lines.push(
			`- note ${pad(index, 5)} line ${pad(lineIndex + 1, 2)} references [[${linkA}]] and [[${linkB}]] for benchmark traversal.`
		);
		if ((index + lineIndex) % 11 === 0) {
			lines.push(`- TODO synthetic follow-up ${pad(index, 5)}.${pad(lineIndex + 1, 2)}`);
		}
	}

	return `${lines.join("\n")}\n`;
}

function makeLargeNote(index, linkTargets, linesPerLargeNote) {
	const lines = [
		`# Synthetic Large Note ${pad(index, 5)}`,
		"",
		"This file is intentionally large to stress note reads and grep scans."
	];

	for (let lineIndex = 0; lineIndex < linesPerLargeNote; lineIndex += 1) {
		const link = linkTargets[lineIndex % linkTargets.length];
		lines.push(
			`## Section ${lineIndex + 1}\n- TODO large synthetic workload ${pad(index, 5)}.${pad(lineIndex + 1, 3)} references [[${link}]] and benchmark phrase synthetic-workload-${pad(index, 5)}.`
		);
	}

	return `${lines.join("\n")}\n`;
}

function makeCanvas(index) {
	return `${JSON.stringify(
		{
			nodes: [
				{
					id: `note-${index}`,
					type: "text",
					text: `Synthetic canvas ${index}`,
					x: 40,
					y: 60,
					width: 320,
					height: 140
				}
			],
			edges: []
		},
		null,
		2
	)}\n`;
}

function makeAttachment(index) {
	return Buffer.from(`synthetic-binary-attachment-${index}\n`, "utf8");
}

function countMarkdownFiles(filePaths) {
	return filePaths.filter((file) => file.path.endsWith(".md")).length;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const profile = String(args.profile ?? "large");
	const config = profileConfigs[profile];
	if (!config) {
		throw new Error(`Unknown profile: ${profile}`);
	}

	const seed = toInteger(args.seed, 42);
	const root = String(args.root ?? "perf-generated").replace(/^\/+|\/+$/g, "");
	const manifestPath = resolve(
		vaultRoot,
		String(args["manifest-out"] ?? `${root}/_manifest.json`)
	);
	const goldenPath = resolve(vaultRoot, `${root}/_golden.json`);
	const outputRoot = resolve(vaultRoot, root);
	const prng = createPrng(seed);

	resetDir(outputRoot);

	const writer = createWriter(outputRoot);
	let syntheticLinkCount = 0;

	const searchArchivePath = `${root}/archive/2025-incident-retro.md`;
	const searchArchiveContent = `# Synthetic Incident Retro

- TODO capture the latency regression benchmark
- TODO compare archive search traversal
- TODO confirm deterministic fixture generation

This archived note is the canonical search target for the synthetic benchmark.
`;
	writer.write("archive/2025-incident-retro.md", searchArchiveContent);

	const unicodeKeyword = "検索性能ベンチ";
	const searchUnicodePath = `${root}/international/検索性能ベンチ.md`;
	const searchUnicodeContent = `# 検索性能ベンチ

- ${unicodeKeyword} の対象ノートです
- TODO 日本語の検索結果を確認する
- ${unicodeKeyword} を含む行を数える
- ${unicodeKeyword} の一致行数を返す
`;
	writer.write("international/検索性能ベンチ.md", searchUnicodeContent);

	const searchScopePathPrefix = `${root}/projects/active/`;
	const releaseChecklistPath = `${root}/projects/active/release-checklist.md`;
	const releaseChecklistContent = `# Synthetic Release Checklist

- [ ] TODO verify benchmark prompt determinism
- [ ] TODO verify benchmark vault diff matching
- [ ] TODO verify benchmark summary output
`;
	writer.write("projects/active/release-checklist.md", releaseChecklistContent);

	const alphaOverviewPath = `${root}/projects/active/alpha/overview.md`;
	const mixedAnchor = "benchmark-anchor-42-alpha";
	const alphaOverviewContent = `# Alpha Overview

- TODO inspect synthetic benchmark drift
- TODO keep search targets deterministic
- Anchor: ${mixedAnchor}
`;
	writer.write("projects/active/alpha/overview.md", alphaOverviewContent);

	const betaSpecContent = `# Beta Spec

- TODO keep patch tasks isolated
- TODO compare scope count outputs
`;
	writer.write("projects/active/beta/spec.md", betaSpecContent);

	const restrictedPrefix = `${root}/restricted/`;
	writer.write(
		"restricted/secret-plan.md",
		`# Restricted Fixture

This file exists so the benchmark verifier can reject unintended edits.
`
	);

	writer.write(
		"README.md",
		`# Synthetic Benchmark Vault

This directory is generated by scripts/perf/generate-synthetic-vault.mjs.

- Profile: ${profile}
- Seed: ${seed}
- Root: ${root}
`
	);

	const regularNoteCount = config.targetMarkdownNotes - 7 - config.largeMarkdownNotes;
	const noteTargets = [];
	for (let index = 1; index <= regularNoteCount; index += 1) {
		noteTargets.push(`corpus/notes/note-${pad(index, 5)}`);
	}

	for (let index = 1; index <= regularNoteCount; index += 1) {
		const targetCount = Math.min(5, noteTargets.length);
		const links = [];
		for (let linkIndex = 0; linkIndex < targetCount; linkIndex += 1) {
			const linkedIndex =
				(Math.floor(prng() * noteTargets.length) + index + linkIndex) % noteTargets.length;
			links.push(noteTargets[linkedIndex]);
		}
		syntheticLinkCount += links.length * 2;
		writer.write(
			`corpus/notes/note-${pad(index, 5)}.md`,
			makeRegularNote(index, links, config.linesPerRegularNote)
		);
	}

	for (let index = 1; index <= config.largeMarkdownNotes; index += 1) {
		const links = [];
		for (let linkIndex = 0; linkIndex < 8; linkIndex += 1) {
			const linkedIndex = (index * 17 + linkIndex * 11) % noteTargets.length;
			links.push(noteTargets[linkedIndex]);
		}
		syntheticLinkCount += links.length * config.linesPerLargeNote;
		writer.write(
			`corpus/large/large-${pad(index, 4)}.md`,
			makeLargeNote(index, links, config.linesPerLargeNote)
		);
	}

	for (let index = 1; index <= config.textFiles; index += 1) {
		writer.write(
			`corpus/text/doc-${pad(index, 4)}.txt`,
			`synthetic text document ${index}\nTODO text benchmark ${index}\n`
		);
	}

	for (let index = 1; index <= config.canvasFiles; index += 1) {
		writer.write(`corpus/canvas/board-${pad(index, 4)}.canvas`, makeCanvas(index));
	}

	for (let index = 1; index <= config.attachments; index += 1) {
		writer.write(`attachments/binary/attachment-${pad(index, 4)}.bin`, makeAttachment(index));
	}

	const patchExistingLine = "- [ ] TODO verify synthetic benchmark follow-up";
	const createNotePath = `${root}/sandbox/agent-e2e/result.md`;
	const createNoteContent = "# Agent E2E Result\n\nSynthetic benchmark note created by agent.\n";
	const mixedAppendedLine = `- [ ] TODO agent verified ${mixedAnchor}`;

	const todoLineCountInActive =
		countMatchingLines(releaseChecklistContent, "TODO") +
		countMatchingLines(alphaOverviewContent, "TODO") +
		countMatchingLines(betaSpecContent, "TODO");

	const manifest = {
		generatedAt: new Date().toISOString(),
		repoRoot,
		vaultRoot,
		root,
		profile,
		seed,
		metrics: {
			markdownFiles: countMarkdownFiles(writer.files),
			textFiles: writer.files.filter((file) => file.path.endsWith(".txt")).length,
			canvasFiles: writer.files.filter((file) => file.path.endsWith(".canvas")).length,
			attachmentFiles: writer.files.filter((file) => file.path.endsWith(".bin")).length,
			totalFiles: writer.files.length + 2,
			largeMarkdownNotes: config.largeMarkdownNotes,
			syntheticLinkCount
		}
	};

	const golden = {
		profile,
		seed,
		paths: {
			root,
			restrictedPrefix
		},
		searchArchive: {
			path: searchArchivePath,
			todoLineCount: countMatchingLines(searchArchiveContent, "TODO")
		},
		searchUnicode: {
			path: searchUnicodePath,
			keyword: unicodeKeyword,
			matchLineCount: countMatchingLines(searchUnicodeContent, unicodeKeyword)
		},
		searchScope: {
			pathPrefix: searchScopePathPrefix,
			todoLineCount: todoLineCountInActive
		},
		patchExisting: {
			path: releaseChecklistPath,
			appendedLine: patchExistingLine
		},
		createNote: {
			path: createNotePath,
			content: createNoteContent,
			contentTrimmed: createNoteContent.trimEnd()
		},
		mixedSearchPatch: {
			path: alphaOverviewPath,
			anchor: mixedAnchor,
			appendedLine: mixedAppendedLine
		}
	};

	writeJson(manifestPath, manifest);
	writeJson(goldenPath, golden);

	console.log(
		JSON.stringify(
			{
				profile,
				seed,
				root,
				manifestPath,
				goldenPath,
				metrics: manifest.metrics
			},
			null,
			2
		)
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});

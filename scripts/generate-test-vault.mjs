import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const vaultRoot = join(process.cwd(), "vault");
const tinyPngBase64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0mQAAAAASUVORK5CYII=";

function writeVaultFile(relativePath, content, options = {}) {
	const filePath = join(vaultRoot, relativePath);
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, {
		encoding: typeof content === "string" ? (options.encoding ?? "utf8") : options.encoding
	});
	return {
		path: relativePath,
		bytes:
			typeof content === "string"
				? Buffer.byteLength(content, options.encoding ?? "utf8")
				: content.byteLength
	};
}

function buildLargeMarkdown(title, sectionCount, linesPerSection) {
	const sections = [];
	for (let sectionIndex = 1; sectionIndex <= sectionCount; sectionIndex += 1) {
		const lines = [`## Section ${sectionIndex}`];
		for (let lineIndex = 1; lineIndex <= linesPerSection; lineIndex += 1) {
			lines.push(
				`- Item ${sectionIndex}.${lineIndex}: TODO verify grep output around repeated phrases, wiki links [[Vault Grep]], and block refs ^section-${sectionIndex}-${lineIndex}`
			);
		}
		sections.push(lines.join("\n"));
	}

	return `# ${title}

This file is generated to stress vault traversal, large reads, and repeated matches.

${sections.join("\n\n")}
`;
}

function buildTodoMatrix(rows, columns) {
	const lines = ["# TODO Matrix", ""];
	for (let row = 1; row <= rows; row += 1) {
		const cells = [];
		for (let column = 1; column <= columns; column += 1) {
			cells.push(
				`TODO-R${row.toString().padStart(2, "0")}C${column.toString().padStart(2, "0")}`
			);
		}
		lines.push(cells.join(" | "));
	}
	return `${lines.join("\n")}\n`;
}

function buildLongSingleLine(length) {
	return `${"EDGECASE_".repeat(Math.ceil(length / 9)).slice(0, length)}\n`;
}

function buildJsonCanvas() {
	return `${JSON.stringify(
		{
			nodes: [
				{
					id: "alpha",
					type: "text",
					text: "TODO map CLI output to vault fixtures",
					x: 40,
					y: 60,
					width: 340,
					height: 120
				},
				{
					id: "beta",
					type: "text",
					text: "Edge cases: spaces, unicode, CRLF, large notes",
					x: 440,
					y: 60,
					width: 340,
					height: 120
				}
			],
			edges: [{ id: "alpha-beta", fromNode: "alpha", toNode: "beta" }]
		},
		null,
		2
	)}\n`;
}

function buildWorkspaceJson() {
	return `${JSON.stringify(
		{
			lastOpenFiles: [
				"HOME.md",
				"daily/2026-04-08.md",
				"projects/vault-grep.md",
				"reference/unicode-and-symbols.md"
			],
			activeFile: "HOME.md",
			leftSidebar: {
				collapsed: false,
				favorites: ["HOME.md", "projects/vault-grep.md", "reference/cli-examples.md"]
			}
		},
		null,
		2
	)}\n`;
}

function buildDataviewFixture() {
	return `---
type: query
tags:
  - query
  - dataview
status: active
owners:
  - alex
---

# Dataview Fixture

\`\`\`dataview
TABLE status, owners
FROM "projects/active"
WHERE contains(file.name, "overview")
SORT file.name ASC
\`\`\`

\`\`\`dataviewjs
const pages = dv.pages('"tasks"').where((page) => page.status);
dv.table(["File", "Status"], pages.map((page) => [page.file.link, page.status]));
\`\`\`
`;
}

function buildTasksFixture() {
	return `---
type: task-board
tags:
  - tasks
  - operations
status: in-progress
owners:
  - morgan
---

# Tasks Fixture

\`\`\`tasks
not done
path includes tasks
sort by due
\`\`\`

- [ ] TODO review fixture realism 📅 2026-04-10
- [ ] TODO verify code fence rendering ⏫
- [x] Done item for contrast ✅ 2026-04-07
`;
}

function buildCodeFenceFixture() {
	return `# Code Fence Lab

## TypeScript

\`\`\`ts
type SearchHit = {
	path: string;
	line: number;
};

export function formatHit(hit: SearchHit): string {
	return \`\${hit.path}:\${hit.line}\`;
}
\`\`\`

## Bash

\`\`\`bash
./bin/obsidian-dev obsidian excli-grep pattern=TODO path=reference/
\`\`\`

## JSON

\`\`\`json
{
  "fixture": true,
  "kind": "code-fence"
}
\`\`\`
`;
}

function buildTextAttachment(index) {
	return `attachment-${index}
TODO synthetic attachment ${index}
kind: text
`;
}

function buildBinaryAttachment(index) {
	return Buffer.from(`binary-attachment-${index}\n`, "utf8");
}

const files = [
	writeVaultFile(
		"README.md",
		`---
type: readme
tags:
  - docs
  - fixture
status: active
---

# Sample vault

This vault is intentionally populated for local plugin development and command testing.

Run \`pnpm run vault:generate\` from the repository root to refresh the generated fixtures.

## Areas

- \`HOME.md\` is a map-of-content note that links the main fixtures together.
- \`daily/\` keeps daily notes with realistic tasks and links.
- \`tasks/\` and \`queries/\` cover Tasks/Dataview-style content.
- \`projects/\` keeps active and archived work with mixed note sizes.
- \`reference/\` keeps grep-oriented fixtures and tricky formatting cases.
- \`meeting-notes/\` and \`people/\` add more realistic cross-linked notes.
- \`collisions/\` and \`deep/\` cover path ambiguity and deep nesting.
- \`stress/\` keeps larger files for traversal and output-limit checks.
- \`templates/private/\` keeps intentionally denied content for policy checks.
- \`attachments/bulk/\` provides a noisier attachment set.
- \`.obsidian/\` includes config fixtures that grep must continue to ignore.

## Schema hints

- Most operational notes now expose frontmatter such as \`type\`, \`tags\`, \`status\`, and \`date\`.
- Some notes intentionally omit frontmatter so \`excli-schema:missing\` and validation flows still have realistic failures to report.
- A few notes intentionally keep unusual or low-frequency properties such as \`created\` or \`rogue_key\`.

## Search hints

- Search \`TODO\` to verify default matching across many files.
- Search \`incident\` within \`projects/archive/\` to verify path filters.
- Search \`EDGECASE_\` inside \`reference/long-lines.md\` to test long single-line handling.
- Search \`Japanese\` or \`検索\` to spot Unicode handling.
- Open \`reference/code-fence-lab.md\` for explicit fenced code samples.
- Open \`HOME.md\` in Obsidian to navigate the generated vault like a real workspace.
`
	),
	writeVaultFile(
		"HOME.md",
		`---
aliases:
  - Vault Home
  - Test Vault Index
tags:
  - moc
  - test-fixture
type: moc
status: active
---

# Home

This note acts as a realistic map of content for the generated vault.

## Start here

- [[daily/2026-04-08]]
- [[projects/vault-grep]]
- [[reference/cli-examples]]
- [[reference/code-fence-lab]]
- [[queries/dataview-fixture]]
- [[tasks/open-items]]
- [[meeting-notes/2026-04-08 product sync]]
- [[people/alex-doe]]
- [[collisions/team/overview]]
- [[collisions/project/overview]]

## Embedded samples

![[reference/frontmatter-lab]]
![[attachments/graph.canvas]]
![[attachments/tiny.png]]

## Missing on purpose

- [[ghost/missing-note]]
- [[templates/private/secret-plan]]
`
	),
	writeVaultFile(
		".obsidian/app.json",
		`${JSON.stringify(
			{
				legacyEditor: false,
				promptDelete: false,
				showLineNumber: true
			},
			null,
			2
		)}\n`
	),
	writeVaultFile(".obsidian/workspace.json", buildWorkspaceJson()),
	writeVaultFile(
		".obsidian/plugins/excli/data.json",
		`${JSON.stringify(
			{
				grepPermissionSettings: {
					enabled: true,
					denyPathPrefixes: ["templates/private/"],
					allowPathPrefixes: [],
					targetExtensions: ["md", "txt", "canvas"]
				}
			},
			null,
			2
		)}\n`
	),
	writeVaultFile(
		"daily/2026-04-07.md",
		`---
tags:
  - daily
  - review
type: daily
date: 2026-04-07
status: done
---

# Daily Note 2026-04-07

- [x] Review grep command output
- [ ] TODO audit vault edge cases
- [ ] Draft follow-up for apply-patch verification

## Notes

Met with the release group and linked [[projects/release-checklist]].
Need to revisit [[reference/cli-examples]] and compare with [[stress/todo-matrix]].
`
	),
	writeVaultFile(
		"daily/2026-04-08.md",
		`---
tags:
  - daily
  - shipping
type: daily
date: 2026-04-08
status: in-progress
---

# Daily Note 2026-04-08

- [ ] TODO ship grep improvements
- [ ] TODO verify denied path handling
- [x] Review [[projects/vault-grep]]

## Journal

Observed two classes of failures:

1. Large files with many repeated TODO markers.
2. Path-filter bugs around \`templates/private/\` and \`.obsidian/\`.

## Links

- [[projects/active/alpha/overview]]
- [[reference/cli-examples]]
- [[notes/weird file name [draft] #1]]
`
	),
	writeVaultFile(
		"daily/2026-04-09.md",
		`# Daily Note 2026-04-09

- [ ] TODO confirm CRLF file handling
- [ ] TODO sample non-markdown targets
- [ ] Follow up on [[projects/active/beta/spec]]

> Grep output should stay stable even when the vault becomes noisy.
`
	),
	writeVaultFile(
		"meeting-notes/2026-04-08 product sync.md",
		`---
type: meeting
date: 2026-04-08
status: done
participants:
  - "[[people/alex-doe]]"
  - "[[people/morgan-lee]]"
tags:
  - meeting
  - grep
---

# Product sync

## Agenda

- TODO confirm vault coverage gaps
- TODO add more realistic Obsidian fixtures
- Review ![[projects/active/alpha/overview]]

## Decisions

> [!info]
> Keep generated content deterministic so tests and demos stay stable.

- Link graph should include both valid and intentionally missing links.
- Attachments should include at least one binary file.
`
	),
	writeVaultFile(
		"people/alex-doe.md",
		`---
aliases:
  - Alex
type: person
tags:
  - people
  - platform
status: active
team: Platform
---

# Alex Doe

- Role: plugin maintainer
- TODO review grep policy defaults
- Related: [[projects/active/alpha/overview]]
`
	),
	writeVaultFile(
		"people/morgan-lee.md",
		`---
type: person
tags:
  - people
  - qa
status: active
team: QA
---

# Morgan Lee

- Role: QA
- TODO verify vault fixture realism
- Related: [[meeting-notes/2026-04-08 product sync]]
`
	),
	writeVaultFile("queries/dataview-fixture.md", buildDataviewFixture()),
	writeVaultFile("tasks/open-items.md", buildTasksFixture()),
	writeVaultFile(
		"notes/project.txt",
		`Project scratchpad
TODO keep txt fixtures searchable
TODO compare txt vs md extension handling
reference: projects/vault-grep.md
`
	),
	writeVaultFile(
		"notes/weird file name [draft] #1.md",
		`---
type: scratch
tags:
  - notes
status: draft
rogue_key: true
---

# Weird File Name

This note exists to test spaces, brackets, and hash signs in vault-relative paths.

- TODO confirm escaping in command output
- Related: [[projects/vault-grep]]
`
	),
	writeVaultFile(
		"notes/.hidden-note.md",
		`---
type: scratch
tags:
  - notes
  - hidden
status: draft
---

# Hidden Note

Hidden files can still exist in the vault.
TODO hidden note visibility check
`
	),
	writeVaultFile(
		"notes/empty.md",
		`---
type: scratch
tags:
  - notes
status: archived
empty_body: true
---
`
	),
	writeVaultFile(
		"notes/windows-crlf.txt",
		[
			"CRLF fixture",
			"TODO verify line splitting",
			"line endings should stay Windows-style"
		].join("\r\n") + "\r\n"
	),
	writeVaultFile(
		"projects/release-checklist.md",
		`---
type: project
tags:
  - project
  - release
status: todo
owners:
  - alex
stage: active
---

# Release Checklist

- [ ] TODO bump manifest and versions.json together
- [ ] TODO run pnpm run build
- [ ] TODO run pnpm run test
- [ ] TODO verify vault plugin sync

## Risks

- Missing tests around denied paths
- Large-file regressions in grep formatting
- Unexpected output differences for \`--files-with-matches\`
`
	),
	writeVaultFile(
		"projects/vault-grep.md",
		`---
type: project
tags:
  - project
  - grep
status: in-progress
owners:
  - alex
stage: active
created: 2026-04-01
---

# Vault Grep

This note collects search-heavy examples for local Obsidian CLI testing.

## Example commands

\`\`\`bash
./bin/obsidian-dev obsidian excli-grep pattern=TODO
./bin/obsidian-dev obsidian excli-grep pattern=incident path=projects/archive/
./bin/obsidian-dev obsidian excli-grep pattern=EDGECASE_ path=reference/
\`\`\`

## Fixture map

- [[daily/2026-04-08]]
- [[projects/active/alpha/overview]]
- [[reference/search-fixtures]]
- [[stress/large-note]]
`
	),
	writeVaultFile(
		"projects/active/alpha/overview.md",
		`---
type: project
tags:
  - project
  - alpha
status: in-progress
owners:
  - alex
stage: active
---

# Alpha Overview

## Scope

Alpha tracks command-oriented vault operations.

- TODO improve search result summaries
- TODO compare markdown and canvas fixtures
- Owner: platform-team

## Related

- [[projects/active/alpha/meeting-notes]]
- [[reference/long-lines]]
`
	),
	writeVaultFile(
		"projects/active/alpha/meeting-notes.md",
		`---
type: project
tags:
  - project
  - alpha
status: in-progress
owners:
  - alex
stage: active
created: 2026-04-02
---

# Alpha Meeting Notes

## 2026-04-08

- Discussed path filtering for \`projects/archive/\`
- Noted that \`templates/private/\` must stay denied
- Added a request for larger vault samples

## Decision log

1. Keep \`.obsidian/\` excluded.
2. Add large markdown and txt fixtures.
3. Add at least one Unicode-heavy note for search checks.
`
	),
	writeVaultFile(
		"projects/active/beta/spec.md",
		`---
type: project
tags:
  - project
  - beta
status: todo
owners:
  - morgan
stage: active
---

# Beta Spec

## Acceptance checks

- TODO allow path prefix filtering
- TODO report skipped files cleanly
- TODO handle empty documents without crashing

## Embedded references

![[attachments/graph.canvas]]
![[reference/unicode-and-symbols.md]]
`
	),
	writeVaultFile(
		"projects/archive/2025-incident-retro.md",
		`---
type: project
tags:
  - project
  - archive
  - incident
status: archived
owners:
  - morgan
stage: archive
date: 2025-12-19
---

# 2025 Incident Retro

Incident summary: grep output missed archived notes because the search scope was too narrow.

- TODO capture regression tests
- TODO verify archive path filtering
- TODO document expected line-number output
`
	),
	writeVaultFile(
		"archive/old.md",
		`---
type: archive-note
tags:
  - archive
status: archived
date: 2024-12-31
---

# Old Note

This file is intentionally plain and small.
TODO legacy note still searchable
`
	),
	writeVaultFile(
		"reference/cli-examples.md",
		`---
type: reference
tags:
  - reference
  - cli
status: active
---

# CLI Examples

## Basic

\`\`\`bash
./bin/obsidian-dev obsidian excli-grep pattern=TODO
./bin/obsidian-dev obsidian excli-grep pattern=TODO path=daily/ line-number
\`\`\`

## Narrow search

\`\`\`bash
./bin/obsidian-dev obsidian excli-grep pattern=incident path=projects/archive/
./bin/obsidian-dev obsidian excli-grep pattern=EDGECASE_ path=reference/ count
\`\`\`

## Notes

- TODO examples should cover files-with-matches
- TODO examples should cover ignore-case
`
	),
	writeVaultFile(
		"reference/search-fixtures.txt",
		`TODO
todo
ToDo
grep
GREP
incident
EDGECASE_marker
spaces in file names
templates/private/secret-plan.md should stay denied
`
	),
	writeVaultFile(
		"reference/long-lines.md",
		`---
type: reference
tags:
  - reference
  - long-lines
status: active
---

# Long Lines

${buildLongSingleLine(24000)}`
	),
	writeVaultFile(
		"reference/unicode-and-symbols.md",
		`---
type: reference
tags:
  - reference
  - unicode
status: active
---

# Unicode And Symbols

Japanese: 検索テスト と 日本語の TODO 行
Greek: alpha beta gamma delta
Symbols: [link], (paren), {brace}, <angle>, pipe |, slash /, backslash \\

- TODO 検索 should work with Unicode content
- TODO mixed symbols should not break output rendering
`
	),
	writeVaultFile(
		"reference/frontmatter-lab.md",
		`---
title: Frontmatter Lab
aliases:
  - Metadata Playground
tags:
  - reference
  - metadata
type: reference
status: in-progress
owners:
  - alex
  - morgan
---

# Frontmatter Lab

This note exercises metadata-heavy markdown.

## Checklist

- [ ] TODO verify frontmatter is preserved during patching
- [ ] TODO inspect embeds from [[HOME]]

## Callout

> [!warning]
> Metadata-rich notes often expose formatting bugs first.
`
	),
	writeVaultFile(
		"reference/code-fence-lab.md",
		`---
type: reference
tags:
  - reference
  - code
status: active
---

${buildCodeFenceFixture()}`
	),
	writeVaultFile(
		"collisions/team/overview.md",
		`---
type: reference
tags:
  - collisions
  - team
status: active
scope: team
---

# Overview

Folder-scoped collision fixture for the team namespace.

- TODO confirm disambiguation in links
- Related: [[people/alex-doe]]
`
	),
	writeVaultFile(
		"collisions/project/overview.md",
		`---
type: reference
tags:
  - collisions
  - project
status: active
scope: project
---

# Overview

Folder-scoped collision fixture for the project namespace.

- TODO confirm ambiguous note handling
- Related: [[projects/active/alpha/overview]]
`
	),
	writeVaultFile(
		"deep/level-1/level-2/level-3/level-4/level-5/trace.md",
		`---
type: reference
tags:
  - deep
  - trace
status: active
depth: 5
---

# Deep Trace

This note exists to test deeply nested traversal.

- TODO deep path traversal
- TODO nested path filters
- Related: [[deep/level-1/level-2/level-3/level-4/level-5/snippet]]
`
	),
	writeVaultFile(
		"deep/level-1/level-2/level-3/level-4/level-5/snippet.md",
		`---
type: reference
tags:
  - deep
  - snippet
status: active
depth: 5
---

# Deep Snippet

\`\`\`md
![[deep/level-1/level-2/level-3/level-4/level-5/trace]]
\`\`\`
`
	),
	writeVaultFile(
		"paths/space dir/nested/file with spaces.md",
		`---
type: reference
tags:
  - paths
  - spaces
status: active
path_case: spaced
---

# File With Spaces

TODO path normalization for nested directories with spaces
`
	),
	writeVaultFile(
		"paths/commas, semicolons/odd-name.md",
		`---
type: reference
tags:
  - paths
  - punctuation
status: active
path_case: punctuated
---

# Odd Name

TODO punctuation in path segments
`
	),
	writeVaultFile(
		"templates/daily-template.md",
		`---
type: template
tags:
  - template
  - daily
status: active
---

# Daily Template

- Date:
- Top goals:
- TODO follow-ups:
- Links:
`
	),
	writeVaultFile(
		"templates/private/secret-plan.md",
		`---
type: template
tags:
  - template
  - private
status: restricted
visibility: private
---

# Secret Plan

This file should be denied by default grep policy.
TODO do not expose
`
	),
	writeVaultFile(
		"templates/private/nested/credentials.md",
		`---
type: template
tags:
  - template
  - private
status: restricted
visibility: private
---

# Credentials

This nested private note is another denied-path fixture.
TODO remain unreadable to grep
`
	),
	writeVaultFile(
		"attachments/data.csv",
		`name,status,count
alpha,open,12
beta,closed,4
gamma,todo,31
`
	),
	writeVaultFile("attachments/graph.canvas", buildJsonCanvas()),
	writeVaultFile("attachments/tiny.png", Buffer.from(tinyPngBase64, "base64")),
	writeVaultFile(
		"attachments/config.json",
		`${JSON.stringify(
			{
				fixture: true,
				description: "Non-markdown structured data for vault traversal tests",
				tags: ["json", "edge-case", "search"]
			},
			null,
			2
		)}\n`
	),
	writeVaultFile(
		"attachments/bulk/index.md",
		`---
type: reference
tags:
  - reference
  - attachments
status: active
---

# Bulk Attachments

- TODO verify large attachment directories do not affect command behavior
- Files:
- [[attachments/bulk/file-01.txt]]
- [[attachments/bulk/file-12.txt]]
- [[attachments/bulk/file-24.bin]]
`
	),
	writeVaultFile(
		"stress/todo-matrix.md",
		`---
type: fixture
tags:
  - stress
  - matrix
status: active
---

${buildTodoMatrix(80, 6)}`
	),
	writeVaultFile(
		"stress/large-note.md",
		`---
type: fixture
tags:
  - stress
  - large
status: active
---

${buildLargeMarkdown("Large Note", 90, 12)}`
	),
	writeVaultFile(
		"stress/repeated-headings.md",
		`---
type: fixture
tags:
  - stress
  - headings
status: active
---

# Repeated Headings

## Status
TODO first status block

## Status
TODO second status block

## Status
TODO third status block
`
	),
	writeVaultFile(
		"stress/mixed-content.md",
		`---
fixture: true
category: stress
type: fixture
tags:
  - stress
  - mixed
status: active
---

# Mixed Content

> TODO blockquote match

\`\`\`ts
// TODO code block match
const pattern = "TODO";
\`\`\`

| Column | Value |
| --- | --- |
| text | TODO table cell |
| link | [[projects/vault-grep]] |

- TODO bullet item
- [[reference/unicode-and-symbols]]
`
	),
	writeVaultFile(
		"sandbox/apply-patch-e2e/test.patch",
		`*** Begin Patch
*** Update File: sandbox/apply-patch-e2e/created.md
@@
-created by fixture
+created by richer fixture
*** End Patch
`
	),
	writeVaultFile(
		"sandbox/apply-patch-e2e/recheck.patch",
		`*** Begin Patch
*** Update File: projects/release-checklist.md
@@
 - [ ] TODO verify vault plugin sync
+- [ ] TODO inspect expanded vault fixtures
*** End Patch
`
	),
	writeVaultFile(
		"sandbox/apply-patch-e2e/vault-relative.patch",
		`*** Begin Patch
*** Update File: reference/frontmatter-lab.md
@@
- [ ] TODO inspect embeds from [[HOME]]
+ [ ] TODO inspect embeds from [[HOME]] and [[projects/vault-grep]]
*** End Patch
`
	),
	writeVaultFile(
		"international/検索テスト.md",
		`---
type: reference
tags:
  - international
  - unicode
status: active
lang: ja
---

# 検索テスト

これは Unicode を含む vault fixture です。

- TODO 日本語を含む行
- 関連: [[reference/unicode-and-symbols]]
`
	)
];

for (let index = 1; index <= 18; index += 1) {
	files.push(
		writeVaultFile(
			`attachments/bulk/file-${index.toString().padStart(2, "0")}.txt`,
			buildTextAttachment(index)
		)
	);
}

for (let index = 19; index <= 24; index += 1) {
	files.push(
		writeVaultFile(
			`attachments/bulk/file-${index.toString().padStart(2, "0")}.bin`,
			buildBinaryAttachment(index)
		)
	);
}

const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);

console.log(`Generated ${files.length} vault fixture files (${totalBytes} bytes) in ${vaultRoot}`);

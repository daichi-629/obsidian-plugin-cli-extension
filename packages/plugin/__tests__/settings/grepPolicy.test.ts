import { describe, expect, it } from "vitest";
import {
	getGrepPathPolicyError,
	isPathAllowedByGrepPolicy,
	normalizeGrepPathPrefix,
	resolveGrepPermissionSettings
} from "../../src/settings";

const CONFIG_DIR = "config";

describe("grepPolicy", () => {
	it("normalizes path prefixes to the internal slash-suffixed form", () => {
		expect(normalizeGrepPathPrefix("/drafts/today/")).toBe("drafts/today/");
		expect(normalizeGrepPathPrefix("")).toBeUndefined();
	});

	it("enforces hard-coded and configured deny prefixes", () => {
		const settings = resolveGrepPermissionSettings({
			enabled: true,
			denyPathPrefixes: ["private/"],
			allowPathPrefixes: [],
			targetExtensions: ["md", "txt"]
		});

		expect(isPathAllowedByGrepPolicy(`${CONFIG_DIR}/workspace.json`, settings, CONFIG_DIR)).toBe(
			false
		);
		expect(isPathAllowedByGrepPolicy("private/plan.md", settings, CONFIG_DIR)).toBe(false);
		expect(isPathAllowedByGrepPolicy("notes/plan.md", settings, CONFIG_DIR)).toBe(true);
	});

	it("returns a clear error when a requested path is outside the allowed scope", () => {
		const settings = resolveGrepPermissionSettings({
			enabled: true,
			denyPathPrefixes: [],
			allowPathPrefixes: ["notes/projects/"],
			targetExtensions: ["md", "txt"]
		});

		expect(getGrepPathPolicyError("drafts/", settings, CONFIG_DIR)).toBe(
			'Path "drafts/" is outside the allowed grep scope.'
		);
	});

	it("returns a clear error when a requested path is denied", () => {
		const settings = resolveGrepPermissionSettings({
			enabled: true,
			denyPathPrefixes: ["private/"],
			allowPathPrefixes: [],
			targetExtensions: ["md", "txt"]
		});

		expect(getGrepPathPolicyError("private/", settings, CONFIG_DIR)).toBe(
			'Access to path "private/" is denied by grep policy.'
		);
	});

	it("normalizes target extensions and falls back to defaults", () => {
		expect(
			resolveGrepPermissionSettings({
				enabled: true,
				denyPathPrefixes: [],
				allowPathPrefixes: [],
				targetExtensions: [".MD", "txt", ""]
			}).targetExtensions
		).toEqual(["md", "txt"]);

		expect(resolveGrepPermissionSettings({ targetExtensions: [] }).targetExtensions).toEqual([
			"md",
			"txt"
		]);
	});
});

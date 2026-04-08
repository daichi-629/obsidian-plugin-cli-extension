import { UserError } from "../../shared/errors/userError";

function normalizeRenderedPath(renderedPath: string): string {
	return renderedPath.replace(/\\/g, "/").trim().replace(/^\/+/, "");
}

export function validateRenderedPaths(paths: string[]): string[] {
	const normalizedPaths = paths.map((entry) => {
		const normalized = normalizeRenderedPath(entry);
		if (normalized.length === 0) {
			throw new UserError("Rendered path must not be empty.");
		}

		if (entry.startsWith("/") || /^[A-Za-z]:[\\/]/.test(entry)) {
			throw new UserError(`Rendered path "${entry}" must not be absolute.`);
		}

		if (normalized.split("/").includes("..")) {
			throw new UserError(`Rendered path "${entry}" must not escape the bundle root.`);
		}
		return normalized;
	});

	return normalizedPaths;
}

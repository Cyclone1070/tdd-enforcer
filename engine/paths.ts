import { existsSync } from "node:fs";
import { join } from "node:path";

/** Project-local TDD directory. This is the default layout. */
export const TDD_DIR = ".tdd";
/** Legacy pi layout. Still resolved, so existing pi projects keep working. */
export const LEGACY_TDD_DIR = ".pi/tdd";

export const RULES_FILE = "rules.json";
export const STATE_FILE = "state.json";
export const LOG_FILE = "tdd.log";
export const GITIGNORE_FILE = ".gitignore";

/**
 * Directories that are never writable while TDD is enabled. Both layouts are
 * locked even when only one of them is in use: a stray `.pi/tdd` must not
 * become a bypass.
 */
export const LOCKED_DIRS = [TDD_DIR, LEGACY_TDD_DIR] as const;

export interface TddLayout {
	/** Project-relative directory holding TDD state, e.g. `.tdd`. */
	dir: string;
	/** True when the legacy directory also exists even though the primary wins. */
	legacyDirPresent: boolean;
}

export interface LayoutDeps {
	existsSync: typeof existsSync;
}

/**
 * Pick the TDD directory for a project.
 *
 * Resolution order:
 * 1. `.tdd/` when it exists — the primary layout always wins.
 * 2. `.pi/tdd/` when it exists and `.tdd/` does not — legacy fallback.
 * 3. `.tdd/` otherwise — the default for a project that has no TDD setup yet.
 */
export function resolveTddLayout(
	projectRoot: string,
	deps: LayoutDeps = { existsSync },
): TddLayout {
	const primaryPresent = deps.existsSync(join(projectRoot, TDD_DIR));
	const legacyPresent = deps.existsSync(join(projectRoot, LEGACY_TDD_DIR));

	if (primaryPresent) {
		return { dir: TDD_DIR, legacyDirPresent: legacyPresent };
	}
	if (legacyPresent) {
		return { dir: LEGACY_TDD_DIR, legacyDirPresent: false };
	}
	return { dir: TDD_DIR, legacyDirPresent: false };
}

export function resolveTddDir(
	projectRoot: string,
	deps: LayoutDeps = { existsSync },
): string {
	return resolveTddLayout(projectRoot, deps).dir;
}

/** Absolute path inside the resolved TDD directory. */
export function tddPath(projectRoot: string, ...parts: string[]): string {
	return join(projectRoot, resolveTddDir(projectRoot), ...parts);
}

/**
 * The locked directory a project-relative path belongs to, if any.
 * `undefined` means the path is outside TDD bookkeeping.
 */
export function lockedDirFor(relPath: string): string | undefined {
	const normalized = relPath
		.split("\\")
		.join("/")
		.replace(/^\.\//, "")
		.replace(/\/+$/, "");
	for (const dir of LOCKED_DIRS) {
		if (normalized === dir || normalized.startsWith(`${dir}/`)) return dir;
	}
	return undefined;
}

export function isTddPath(relPath: string): boolean {
	return lockedDirFor(relPath) !== undefined;
}

/** Human-readable warning when both layouts are present. */
export function legacyDirWarning(layout: TddLayout): string | undefined {
	if (!layout.legacyDirPresent) return undefined;
	return (
		`Both ${TDD_DIR}/ and ${LEGACY_TDD_DIR}/ exist. ` +
		`Using ${TDD_DIR}/ and ignoring ${LEGACY_TDD_DIR}/. ` +
		`Both stay write-locked while TDD is enabled.`
	);
}

/**
 * Memory-backed protection for the TDD bookkeeping files.
 *
 * Two things inside the TDD directories are deliberately outside the lock, and
 * this module covers neither:
 *
 * - the private git store, which git cannot report at all (a nested `.git` is
 *   invisible to `git status`);
 * - anything the private repo ignores, the log included. Those are the plugin's
 *   own scratch space — nothing an agent does to them changes enforcement.
 *
 * What is left is exactly what the private repo actually tracks: the
 * bookkeeping files it force-adds. Holding those in memory means the session
 * stays recoverable even when a call destroys the private store outright,
 * because the store is what the git-based revert reads from.
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
	GITIGNORE_FILE,
	LOCKED_DIRS,
	RULES_FILE,
	STATE_FILE,
} from "./paths.js";

/** Content above this is recorded by presence only — never read into memory. */
const MAX_CAPTURED_BYTES = 8 * 1024 * 1024;

/** The files the private repo force-adds, and so the only ones worth holding. */
const BOOKKEEPING = [STATE_FILE, RULES_FILE, GITIGNORE_FILE] as const;

export interface TddFilesDeps {
	existsSync: (path: string) => boolean;
	readFileSync: (path: string) => Buffer;
	writeFileSync: (path: string, data: Buffer) => void;
	mkdirSync: (path: string) => void;
	unlinkSync: (path: string) => void;
	statSync: (path: string) => { size: number; isDirectory(): boolean };
}

export const defaultTddFilesDeps: TddFilesDeps = {
	existsSync,
	readFileSync: (path) => readFileSync(path),
	writeFileSync: (path, data) => writeFileSync(path, data),
	mkdirSync: (path) => void mkdirSync(path, { recursive: true }),
	unlinkSync: (path) => unlinkSync(path),
	statSync: (path) => {
		const stats = statSync(path);
		return { size: stats.size, isDirectory: () => stats.isDirectory() };
	},
};

export interface TddSnapshot {
	/** Project-relative path to content, or `null` when it was too large to hold. */
	files: Map<string, Buffer | null>;
	/** Locked directories that existed when the snapshot was taken. */
	dirs: Set<string>;
}

export function emptyTddSnapshot(): TddSnapshot {
	return { files: new Map(), dirs: new Set() };
}

/**
 * Read the bookkeeping files of every locked directory that exists. A directory
 * that is absent is not recorded, so a call that creates one is left alone
 * rather than deleted.
 */
export function captureTddFiles(
	projectRoot: string,
	deps: TddFilesDeps = defaultTddFilesDeps,
): TddSnapshot {
	const snapshot = emptyTddSnapshot();
	for (const locked of LOCKED_DIRS) {
		const abs = join(projectRoot, locked);
		if (!isDirectory(abs, deps)) continue;
		snapshot.dirs.add(locked);
		for (const name of BOOKKEEPING) {
			const fileAbs = join(abs, name);
			if (!deps.existsSync(fileAbs)) continue;
			snapshot.files.set(`${locked}/${name}`, readCapped(fileAbs, deps));
		}
	}
	return snapshot;
}

/**
 * Put the bookkeeping files back as they were: recreate the directory and the
 * files a call removed, rewrite the ones it changed, and remove any it added.
 * Returns the project-relative paths that had to be touched.
 */
export function restoreTddFiles(
	projectRoot: string,
	snapshot: TddSnapshot,
	deps: TddFilesDeps = defaultTddFilesDeps,
): string[] {
	const restored: string[] = [];

	for (const locked of snapshot.dirs) {
		const abs = join(projectRoot, locked);
		if (!isDirectory(abs, deps)) {
			// A call may have removed the directory, or replaced it with a file.
			if (deps.existsSync(abs)) deps.unlinkSync(abs);
			deps.mkdirSync(abs);
		}

		for (const name of BOOKKEEPING) {
			const rel = `${locked}/${name}`;
			const fileAbs = join(projectRoot, rel);
			const captured = snapshot.files.get(rel);

			if (captured === undefined) {
				// Absent at capture, so the call must not leave one behind.
				if (deps.existsSync(fileAbs)) {
					deps.unlinkSync(fileAbs);
					restored.push(rel);
				}
				continue;
			}
			if (captured === null) continue;
			if (
				deps.existsSync(fileAbs) &&
				deps.readFileSync(fileAbs).equals(captured)
			) {
				continue;
			}
			deps.writeFileSync(fileAbs, captured);
			restored.push(rel);
		}
	}

	return restored;
}

function readCapped(abs: string, deps: TddFilesDeps): Buffer | null {
	try {
		if (deps.statSync(abs).size > MAX_CAPTURED_BYTES) return null;
		return deps.readFileSync(abs);
	} catch {
		// Unreadable now, so there is nothing to restore later. The path is
		// still recorded, so a call that deletes it is still noticed.
		return null;
	}
}

function isDirectory(abs: string, deps: TddFilesDeps): boolean {
	try {
		return deps.statSync(abs).isDirectory();
	} catch {
		return false;
	}
}

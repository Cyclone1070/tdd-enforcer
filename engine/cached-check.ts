import {
	type ExecSyncOptions,
	execSync as realExecSync,
} from "node:child_process";
import {
	copyFileSync as realCopyFileSync,
	existsSync as realExistsSync,
	mkdirSync as realMkdirSync,
	rmSync as realRmSync,
} from "node:fs";
import { join } from "node:path";
import picomatch from "picomatch";
import { findRedHash, changesSince as realChangesSince } from "./git.js";
import type { Config } from "./types.js";

export interface CachedCheckResult {
	passed: boolean;
	message?: string;
	cancelled?: boolean;
	timeout?: boolean;
}

export interface CachedCheckDeps {
	findRedHash: typeof findRedHash;
	changesSince: typeof realChangesSince;
	execSync: typeof realExecSync;
	existsSync: typeof realExistsSync;
	mkdirSync: typeof realMkdirSync;
	copyFileSync: typeof realCopyFileSync;
	rmSync: typeof realRmSync;
}

const defaultDeps: CachedCheckDeps = {
	findRedHash,
	changesSince: realChangesSince,
	execSync: realExecSync as (
		command: string,
		options?: ExecSyncOptions,
	) => Buffer,
	existsSync: realExistsSync,
	mkdirSync: realMkdirSync,
	copyFileSync: realCopyFileSync,
	rmSync: realRmSync,
};

/**
 * Check whether test file changes made in GREEN are legitimate by running tests
 * against cached RED code. If the tests pass against RED code, the test changes
 * are fraudulent (they'd pass on old broken code too).
 */
export async function runCachedCheck(
	root: string,
	config: Config,
	testRunner: (
		commands: string[],
		timeoutSeconds: number,
	) => Promise<CachedCheckResult & { passed: boolean }>,
	deps: CachedCheckDeps = defaultDeps,
): Promise<CachedCheckResult> {
	// Nothing to check if no test patterns defined
	if (config.testFiles.length === 0) {
		return { passed: true };
	}

	// Need a RED snapshot to have something to compare against
	const redHash = deps.findRedHash(root);
	if (!redHash) {
		return { passed: true };
	}

	// Find changed files since RED snapshot
	const changed = deps.changesSince(root, redHash);

	// Filter to only test files (match testFiles patterns)
	const testPatterns = config.testFiles;
	const changedTestFiles = changed.filter((f) => matchesAny(f, testPatterns));

	// No test files changed — nothing to verify
	if (changedTestFiles.length === 0) {
		return { passed: true };
	}

	const shortHash = redHash.slice(0, 8);
	const tmpDir = join(root, ".pi", "tdd", "tmp", shortHash);

	try {
		// Create temp dir
		deps.mkdirSync(tmpDir, { recursive: true });

		// Checkout RED state into temp dir
		const gitDir = join(root, ".pi", "tdd", ".git");
		deps.execSync(
			`git --git-dir="${gitDir}" --work-tree="${tmpDir}" checkout ${redHash} -- .`,
			{ stdio: "pipe" as const },
		);

		// Overlay changed test files
		for (const file of changedTestFiles) {
			const src = join(root, file);
			const dest = join(tmpDir, file);
			if (deps.existsSync(src)) {
				// File was modified or added — copy from working tree
				const dir = join(tmpDir, file.split("/").slice(0, -1).join("/"));
				deps.mkdirSync(dir, { recursive: true });
				deps.copyFileSync(src, dest);
			} else {
				// File was deleted — remove from RED checkout
				try {
					deps.rmSync(dest);
				} catch {
					// Already gone
				}
			}
		}

		// Run tests against the overlaid RED checkout
		let testResult: Awaited<ReturnType<typeof testRunner>>;
		try {
			testResult = await testRunner(config.testCommands, config.timeoutSeconds);
		} catch (e) {
			return {
				passed: false,
				message: `Cached check runner error: ${(e as Error).message}`,
			};
		}

		// If tests timed out or were cancelled — can't verify, block to be safe
		if (testResult.cancelled) {
			return { passed: false, cancelled: true, message: testResult.message };
		}
		if (testResult.timeout) {
			return { passed: false, timeout: true, message: testResult.message };
		}

		// If tests pass against RED code, the test changes are fraudulent
		if (testResult.passed) {
			return {
				passed: false,
				message:
					"Tests pass against RED code — test changes may be fraudulent. " +
					"Tests are expected to fail against the old implementation.",
			};
		}

		// Tests fail as expected — legitimate change
		return { passed: true };
	} finally {
		// Clean up temp dir
		try {
			deps.rmSync(tmpDir, { recursive: true, force: true });
		} catch {
			// Best-effort cleanup
		}
	}
}

/**
 * Check if a file path matches any of the given glob patterns (with !negation support).
 */
function matchesAny(filePath: string, patterns: string[]): boolean {
	const positive: string[] = [];
	const negative: string[] = [];

	for (const p of patterns) {
		if (p.startsWith("!")) {
			negative.push(p.slice(1));
		} else {
			positive.push(p);
		}
	}

	if (positive.length === 0) return false;

	const matchesPositive = positive.some((p) => picomatch(p)(filePath));
	if (!matchesPositive) return false;

	const matchesNegative = negative.some((p) => picomatch(p)(filePath));
	return !matchesNegative;
}

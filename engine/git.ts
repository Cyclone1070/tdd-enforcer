import { type ExecSyncOptions, execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
	GITIGNORE_FILE,
	RULES_FILE,
	resolveTddDir,
	STATE_FILE,
} from "./paths.js";

export type GitDeps = {
	execSync: (command: string, options?: ExecSyncOptions) => Buffer;
	existsSync: (path: string) => boolean;
	mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
	writeFileSync: (path: string, data: string, encoding: BufferEncoding) => void;
	unlinkSync: (path: string) => void;
	rmSync: (
		path: string,
		options?: { recursive?: boolean; force?: boolean },
	) => void;
};

const defaultDeps: GitDeps = {
	execSync: execSync as (command: string, options?: ExecSyncOptions) => Buffer,
	existsSync,
	mkdirSync,
	writeFileSync: writeFileSync as (
		path: string,
		data: string,
		encoding: BufferEncoding,
	) => void,
	unlinkSync,
	rmSync,
};

/** The resolved TDD directory: `.tdd/` normally, `.pi/tdd/` for legacy projects. */
function tddRoot(projectRoot: string, deps: GitDeps): string {
	return join(projectRoot, resolveTddDir(projectRoot, deps));
}

/** Bookkeeping files force-added to the private repo on every snapshot. */
function bookkeepingFiles(dir: string): string[] {
	return [
		`${dir}/${STATE_FILE}`,
		`${dir}/${RULES_FILE}`,
		`${dir}/${GITIGNORE_FILE}`,
	];
}

/**
 * Identity for the private repo's commits. The private repo is the plugin's own
 * bookkeeping, so it does not borrow the host's git identity — which also means
 * the plugin still works where no identity is configured at all, such as a bare
 * CI runner or a fresh container, instead of failing on its very first commit.
 */
const PRIVATE_REPO_IDENTITY = {
	name: "tdd-enforcer",
	email: "tdd-enforcer@localhost",
} as const;

function gitEnv(projectRoot: string, deps: GitDeps): NodeJS.ProcessEnv {
	const gitDir = join(tddRoot(projectRoot, deps), ".git");
	return {
		GIT_DIR: gitDir,
		GIT_WORK_TREE: projectRoot,
		GIT_AUTHOR_NAME: PRIVATE_REPO_IDENTITY.name,
		GIT_AUTHOR_EMAIL: PRIVATE_REPO_IDENTITY.email,
		GIT_COMMITTER_NAME: PRIVATE_REPO_IDENTITY.name,
		GIT_COMMITTER_EMAIL: PRIVATE_REPO_IDENTITY.email,
	};
}

function gitExec(
	args: string,
	projectRoot: string,
	deps: GitDeps,
	options?: ExecSyncOptions,
): string {
	const env = { ...process.env, ...gitEnv(projectRoot, deps) };
	return deps
		.execSync(`git ${args}`, {
			// Node sends a child's stderr to the parent's stderr unless `stdio`
			// says otherwise, so an unpiped failure prints raw git noise into
			// the host's console. Several callers treat a failure as an expected
			// outcome — a destroyed private store, a corrupt history — and
			// report it properly through tddLog, so the child must stay quiet.
			// A caller that wants something else still overrides this.
			stdio: "pipe",
			...options,
			env,
			// Every git call runs from the project root so path output and
			// pathspecs stay root-relative regardless of process cwd.
			cwd: projectRoot,
			encoding: "utf-8",
		} as ExecSyncOptions)
		.toString();
}

export function initGit(
	projectRoot: string,
	deps: GitDeps = defaultDeps,
): void {
	const dir = resolveTddDir(projectRoot, deps);
	const tddPath = tddRoot(projectRoot, deps);
	const gitDir = join(tddPath, ".git");
	if (deps.existsSync(gitDir)) return;

	deps.mkdirSync(tddPath, { recursive: true });
	gitExec(`init "${tddPath}"`, projectRoot, deps, { stdio: "pipe" as const });
	gitExec(`config core.worktree "${projectRoot}"`, projectRoot, deps, {
		stdio: "pipe" as const,
	});
	gitExec(
		`config core.excludesFile "${join(tddPath, ".gitignore")}"`,
		projectRoot,
		deps,
		{ stdio: "pipe" as const },
	);

	const gitignorePath = join(tddPath, ".gitignore");
	if (!deps.existsSync(gitignorePath)) {
		deps.writeFileSync(
			gitignorePath,
			[
				"node_modules/",
				".pnpm-store/",
				".next/",
				"dist/",
				"build/",
				".cache/",
				"*.log",
				".DS_Store",
				"Thumbs.db",
				"",
			].join("\n"),
			"utf-8",
		);
	}

	gitExec("add -A", projectRoot, deps, { stdio: "pipe" as const });
	stageFiles(projectRoot, bookkeepingFiles(dir), deps);
	gitExec('commit --allow-empty -m "tdd: init"', projectRoot, deps, {
		stdio: "pipe" as const,
	});
}

/** Destroy the private git repo and re-init from scratch. */
export function resetGit(
	projectRoot: string,
	deps: GitDeps = defaultDeps,
): void {
	const tddPath = tddRoot(projectRoot, deps);
	const gitDir = join(tddPath, ".git");
	if (deps.existsSync(gitDir)) {
		deps.rmSync(gitDir, { recursive: true, force: true });
	}
	initGit(projectRoot, deps);
}

/** Stage all + commit with --allow-empty so every phase transition has a labeled commit. */
export function snapshot(
	projectRoot: string,
	phase: string,
	deps: GitDeps = defaultDeps,
): string {
	gitExec("add -A", projectRoot, deps, { stdio: "pipe" as const });
	stageFiles(
		projectRoot,
		bookkeepingFiles(resolveTddDir(projectRoot, deps)),
		deps,
	);
	gitExec(`commit --allow-empty -m "tdd: ${phase}"`, projectRoot, deps, {
		stdio: "pipe" as const,
	});
	return gitExec("rev-parse HEAD", projectRoot, deps).trim();
}

export function modifiedFiles(
	projectRoot: string,
	deps: GitDeps = defaultDeps,
): string[] {
	const out = gitExec("diff --name-only HEAD", projectRoot, deps).trim();
	return out ? out.split("\n") : [];
}

export function untrackedFiles(
	projectRoot: string,
	deps: GitDeps = defaultDeps,
): string[] {
	const out = gitExec(
		"ls-files --others --exclude-standard",
		projectRoot,
		deps,
	).trim();
	return out ? out.split("\n") : [];
}

export function changesSinceSnapshot(
	projectRoot: string,
	deps: GitDeps = defaultDeps,
): string[] {
	return [
		...new Set([
			...modifiedFiles(projectRoot, deps),
			...untrackedFiles(projectRoot, deps),
		]),
	];
}

export function restoreFilesTo(
	projectRoot: string,
	files: string[],
	source?: string,
	deps: GitDeps = defaultDeps,
): void {
	if (files.length === 0) return;

	// A path the baseline captured is restored from it — including paths that
	// were untracked before the call. A path the baseline never saw was created
	// by the call itself, so it is removed.
	const captured =
		source === undefined
			? undefined
			: new Set(
					gitExec(`ls-tree -r --name-only ${source}`, projectRoot, deps)
						.trim()
						.split("\n")
						.filter(Boolean),
				);
	const restorable = files.filter((f) => captured?.has(f) ?? false);
	const removable = files.filter((f) => !restorable.includes(f));

	if (restorable.length > 0) {
		const escaped = restorable.map((f) => `"${f}"`).join(" ");
		// checkout (not restore) so a path that is absent from the current index
		// is still materialised from the source tree.
		gitExec(`checkout ${source} -- ${escaped}`, projectRoot, deps, {
			stdio: "pipe" as const,
		});
	}

	if (source !== undefined) {
		for (const f of removable) {
			try {
				deps.unlinkSync(join(projectRoot, f));
			} catch {
				// File may already be gone, ignore
			}
		}
		return;
	}

	// No baseline: restore tracked paths from the index and drop untracked ones.
	const tracked = new Set(
		gitExec("ls-files", projectRoot, deps).trim().split("\n").filter(Boolean),
	);
	const trackedFiles = removable.filter((f) => tracked.has(f));
	if (trackedFiles.length > 0) {
		const escaped = trackedFiles.map((f) => `"${f}"`).join(" ");
		gitExec(`restore --worktree -- ${escaped}`, projectRoot, deps, {
			stdio: "pipe" as const,
		});
	}
	for (const f of removable.filter((f) => !tracked.has(f))) {
		try {
			deps.unlinkSync(join(projectRoot, f));
		} catch {
			// File may already be gone, ignore
		}
	}
}

/**
 * Force-stage files in the private git repo, bypassing worktree .gitignore.
 * Does not commit — call snapshot() or commit separately to persist.
 */
export function stageFiles(
	projectRoot: string,
	files: string[],
	deps: GitDeps = defaultDeps,
): void {
	const existing = files.filter((f) => deps.existsSync(join(projectRoot, f)));
	if (existing.length === 0) return;
	const escaped = existing.map((f) => `"${f}"`).join(" ");
	gitExec(`add -f ${escaped}`, projectRoot, deps, { stdio: "pipe" as const });
}

/**
 * Write a baseline commit of the current working tree and return its hash. Used
 * as the pre-call baseline for the per-call diff.
 *
 * This deliberately avoids `git stash create --include-untracked`: that command
 * exits 1 with no output in some trees, and it does not capture untracked
 * content — which made a revert delete files that existed before the call.
 * Staging everything and writing an explicit commit captures tracked and
 * untracked content alike, so `restoreFilesTo` can bring either kind back.
 */
export function gitStashCreate(
	projectRoot: string,
	deps: GitDeps = defaultDeps,
): string {
	gitExec("add -A", projectRoot, deps, { stdio: "pipe" as const });
	const tree = gitExec("write-tree", projectRoot, deps).trim();
	const parent = headHash(projectRoot, deps);
	return gitExec(
		`commit-tree ${tree} -p ${parent} -m "tdd: baseline"`,
		projectRoot,
		deps,
	).trim();
}

export function headHash(
	projectRoot: string,
	deps: GitDeps = defaultDeps,
): string {
	return gitExec("rev-parse HEAD", projectRoot, deps).trim();
}

/** Get the commit message of HEAD. */
export function headMessage(
	projectRoot: string,
	deps: GitDeps = defaultDeps,
): string {
	// Callers treat an unreadable HEAD as a probe and repair the history, so the
	// expected failure must not print git's complaint at the user.
	return gitExec("log -1 --format=%s HEAD", projectRoot, deps, {
		stdio: "pipe" as const,
	}).trim();
}

/** Check if HEAD has a parent commit (i.e. can go back one). */
export function hasParent(
	projectRoot: string,
	deps: GitDeps = defaultDeps,
): boolean {
	try {
		// A fresh project has no parent commit. That is an answer, not an error,
		// so git's "unknown revision" complaint stays out of the terminal.
		gitExec("rev-parse HEAD~1", projectRoot, deps, { stdio: "pipe" as const });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get files changed since a specific commit (instead of HEAD).
 */
export function changesSince(
	projectRoot: string,
	commitHash: string,
	deps: GitDeps = defaultDeps,
): string[] {
	const out = gitExec(
		`diff --name-only ${commitHash} -- .`,
		projectRoot,
		deps,
	).trim();
	const files = out ? out.split("\n") : [];
	// Also include untracked files
	const untracked = untrackedFiles(projectRoot, deps);
	return [...new Set([...files, ...untracked])];
}

/** Hard reset — discard all uncommitted changes (tracked and untracked), keep HEAD. */
export function resetHard(
	projectRoot: string,
	deps: GitDeps = defaultDeps,
): void {
	gitExec("reset --hard", projectRoot, deps, { stdio: "pipe" as const });
	gitExec("clean -fd", projectRoot, deps, { stdio: "pipe" as const });
}

/** Soft reset — remove last commit, keep working tree content as unstaged. */
export function undoLastCommit(
	projectRoot: string,
	deps: GitDeps = defaultDeps,
): void {
	gitExec("reset --soft HEAD~1", projectRoot, deps, { stdio: "pipe" as const });
}

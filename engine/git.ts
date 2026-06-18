import { execSync, type ExecSyncOptions } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { join } from "node:path";

const TDD_DIR = ".pi/tdd";

export type GitDeps = {
  execSync: (command: string, options?: ExecSyncOptions) => Buffer;
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
  writeFileSync: (path: string, data: string, encoding: BufferEncoding) => void;
  unlinkSync: (path: string) => void;
  rmSync: (path: string, options?: { recursive?: boolean; force?: boolean }) => void;
};

const defaultDeps: GitDeps = {
  execSync: execSync as (command: string, options?: ExecSyncOptions) => Buffer,
  existsSync,
  mkdirSync,
  writeFileSync: writeFileSync as (path: string, data: string, encoding: BufferEncoding) => void,
  unlinkSync,
  rmSync,
};

function gitEnv(projectRoot: string): NodeJS.ProcessEnv {
  const gitDir = join(projectRoot, TDD_DIR, ".git");
  return {
    GIT_DIR: gitDir,
    GIT_WORK_TREE: projectRoot,
  };
}

function gitExec(args: string, projectRoot: string, deps: GitDeps, options?: ExecSyncOptions): string {
  const env = { ...process.env, ...gitEnv(projectRoot) };
  return deps.execSync(`git ${args}`, { ...options, env, encoding: "utf-8" } as ExecSyncOptions).toString();
}

export function initGit(projectRoot: string, deps: GitDeps = defaultDeps): void {
  const tddPath = join(projectRoot, TDD_DIR);
  const gitDir = join(tddPath, ".git");
  if (deps.existsSync(gitDir)) return;

  deps.mkdirSync(tddPath, { recursive: true });
  gitExec(`init "${tddPath}"`, projectRoot, deps, { stdio: "pipe" as const });
  gitExec(`config core.worktree "${projectRoot}"`, projectRoot, deps, { stdio: "pipe" as const });
  gitExec(`config core.excludesFile "${join(tddPath, ".gitignore")}"`, projectRoot, deps, { stdio: "pipe" as const });

  const gitignorePath = join(tddPath, ".gitignore");
  if (!deps.existsSync(gitignorePath)) {
    deps.writeFileSync(
      gitignorePath,
      ["node_modules/", ".pnpm-store/", ".next/", "dist/", "build/", ".cache/", "*.log", ".DS_Store", "Thumbs.db", ""].join("\n"),
      "utf-8",
    );
  }

  gitExec("add -A", projectRoot, deps, { stdio: "pipe" as const });
  gitExec('commit --allow-empty -m "tdd: init"', projectRoot, deps, { stdio: "pipe" as const });
}

/** Destroy the private git repo and re-init from scratch. */
export function resetGit(projectRoot: string, deps: GitDeps = defaultDeps): void {
  const tddPath = join(projectRoot, TDD_DIR);
  const gitDir = join(tddPath, ".git");
  if (deps.existsSync(gitDir)) {
    deps.rmSync(gitDir, { recursive: true, force: true });
  }
  initGit(projectRoot, deps);
}

/** Stage all + commit with --allow-empty so every phase transition has a labeled commit. */
export function snapshot(projectRoot: string, phase: string, deps: GitDeps = defaultDeps): string {
  gitExec("add -A", projectRoot, deps, { stdio: "pipe" as const });
  gitExec(`commit --allow-empty -m "tdd: ${phase}"`, projectRoot, deps, { stdio: "pipe" as const });
  return gitExec("rev-parse HEAD", projectRoot, deps).trim();
}

export function modifiedFiles(projectRoot: string, deps: GitDeps = defaultDeps): string[] {
  const out = gitExec("diff --name-only HEAD", projectRoot, deps).trim();
  return out ? out.split("\n") : [];
}

export function untrackedFiles(projectRoot: string, deps: GitDeps = defaultDeps): string[] {
  const out = gitExec("ls-files --others --exclude-standard", projectRoot, deps).trim();
  return out ? out.split("\n") : [];
}

export function changesSinceSnapshot(projectRoot: string, deps: GitDeps = defaultDeps): string[] {
  return [...new Set([...modifiedFiles(projectRoot, deps), ...untrackedFiles(projectRoot, deps)])];
}

export function restoreFilesTo(projectRoot: string, files: string[], source?: string, deps: GitDeps = defaultDeps): void {
  if (files.length === 0) return;

  // Separate tracked (git restore) from untracked (delete)
  const tracked = gitExec("ls-files", projectRoot, deps)
    .trim()
    .split("\n")
    .filter(Boolean);
  const trackedSet = new Set(tracked);

  const trackedFiles = files.filter((f) => trackedSet.has(f));
  const untrackedFilesList = files.filter((f) => !trackedSet.has(f));

  if (trackedFiles.length > 0) {
    const escaped = trackedFiles.map((f) => `"${f}"`).join(" ");
    const sourceFlag = source ? `--source=${source} ` : "";
    gitExec(`restore ${sourceFlag}--worktree -- ${escaped}`, projectRoot, deps, { stdio: "pipe" as const });
  }

  for (const f of untrackedFilesList) {
    try {
      deps.unlinkSync(f);
    } catch {
      // File may already be gone, ignore
    }
  }
}

/**
 * Create a lightweight commit of the current working tree without touching the stash ref.
 * Returns the commit hash. Used as a pre-bash baseline for per-command diff.
 */
export function gitStashCreate(projectRoot: string, deps: GitDeps = defaultDeps): string {
  const hash = gitExec("stash create --include-untracked", projectRoot, deps).trim();
  if (!hash) return "HEAD";
  return hash;
}

export function headHash(projectRoot: string, deps: GitDeps = defaultDeps): string {
  return gitExec("rev-parse HEAD", projectRoot, deps).trim();
}

/** Get the commit message of HEAD. */
export function headMessage(projectRoot: string, deps: GitDeps = defaultDeps): string {
  return gitExec("log -1 --format=%s HEAD", projectRoot, deps).trim();
}

/** Check if HEAD has a parent commit (i.e. can go back one). */
export function hasParent(projectRoot: string, deps: GitDeps = defaultDeps): boolean {
  try {
    gitExec("rev-parse HEAD~1", projectRoot, deps);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get files changed since a specific commit (instead of HEAD).
 */
export function changesSince(projectRoot: string, commitHash: string, deps: GitDeps = defaultDeps): string[] {
  const out = gitExec(`diff --name-only ${commitHash} -- .`, projectRoot, deps).trim();
  const files = out ? out.split("\n") : [];
  // Also include untracked files
  const untracked = untrackedFiles(projectRoot, deps);
  return [...new Set([...files, ...untracked])];
}

/** Hard reset — discard all uncommitted changes (tracked and untracked), keep HEAD. */
export function resetHard(projectRoot: string, deps: GitDeps = defaultDeps): void {
  gitExec("reset --hard", projectRoot, deps, { stdio: "pipe" as const });
  gitExec("clean -fd", projectRoot, deps, { stdio: "pipe" as const });
}

/** Soft reset — remove last commit, keep working tree content as unstaged. */
export function undoLastCommit(projectRoot: string, deps: GitDeps = defaultDeps): void {
  gitExec("reset --soft HEAD~1", projectRoot, deps, { stdio: "pipe" as const });
}

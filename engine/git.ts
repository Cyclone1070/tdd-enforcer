import { execSync, type ExecSyncOptions } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { join } from "node:path";

const TDD_DIR = ".pi/tdd";

function gitEnv(projectRoot: string): NodeJS.ProcessEnv {
  const gitDir = join(projectRoot, TDD_DIR, ".git");
  return {
    GIT_DIR: gitDir,
    GIT_WORK_TREE: projectRoot,
  };
}

function gitExec(args: string, projectRoot: string, options?: ExecSyncOptions): string {
  const env = { ...process.env, ...gitEnv(projectRoot) };
  return execSync(`git ${args}`, { ...options, env, encoding: "utf-8" } as ExecSyncOptions).toString();
}

export function initGit(projectRoot: string): void {
  const tddPath = join(projectRoot, TDD_DIR);
  const gitDir = join(tddPath, ".git");
  if (existsSync(gitDir)) return;

  mkdirSync(tddPath, { recursive: true });
  gitExec(`init "${tddPath}"`, projectRoot, { stdio: "pipe" as const });
  gitExec(`config core.worktree "${projectRoot}"`, projectRoot, { stdio: "pipe" as const });
  gitExec(`config core.excludesFile "${join(tddPath, ".gitignore")}"`, projectRoot, { stdio: "pipe" as const });

  const gitignorePath = join(tddPath, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(
      gitignorePath,
      ["node_modules/", ".pnpm-store/", ".next/", "dist/", "build/", ".cache/", "*.log", ".DS_Store", "Thumbs.db", ""].join("\n"),
      "utf-8",
    );
  }

  gitExec("add -A", projectRoot, { stdio: "pipe" as const });
  gitExec('commit --allow-empty -m "tdd: init"', projectRoot, { stdio: "pipe" as const });
}

/** Destroy the private git repo and re-init from scratch. */
export function resetGit(projectRoot: string): void {
  const tddPath = join(projectRoot, TDD_DIR);
  const gitDir = join(tddPath, ".git");
  if (existsSync(gitDir)) {
    rmSync(gitDir, { recursive: true, force: true });
  }
  initGit(projectRoot);
}

/** Stage all + commit with --allow-empty so every phase transition has a labeled commit. */
export function snapshot(projectRoot: string, phase: string): string {
  gitExec("add -A", projectRoot, { stdio: "pipe" as const });
  gitExec(`commit --allow-empty -m "tdd: ${phase}"`, projectRoot, { stdio: "pipe" as const });
  return gitExec("rev-parse HEAD", projectRoot).trim();
}

export function modifiedFiles(projectRoot: string): string[] {
  const out = gitExec("diff --name-only HEAD", projectRoot).trim();
  return out ? out.split("\n") : [];
}

export function untrackedFiles(projectRoot: string): string[] {
  const out = gitExec("ls-files --others --exclude-standard", projectRoot).trim();
  return out ? out.split("\n") : [];
}

export function changesSinceSnapshot(projectRoot: string): string[] {
  return [...new Set([...modifiedFiles(projectRoot), ...untrackedFiles(projectRoot)])];
}

export function restoreFilesTo(projectRoot: string, files: string[], source?: string): void {
  if (files.length === 0) return;

  // Separate tracked (git restore) from untracked (delete)
  const tracked = gitExec("ls-files", projectRoot)
    .trim()
    .split("\n")
    .filter(Boolean);
  const trackedSet = new Set(tracked);

  const trackedFiles = files.filter((f) => trackedSet.has(f));
  const untrackedFiles = files.filter((f) => !trackedSet.has(f));

  if (trackedFiles.length > 0) {
    const escaped = trackedFiles.map((f) => `"${f}"`).join(" ");
    const sourceFlag = source ? `--source=${source} ` : "";
    gitExec(`restore ${sourceFlag}--worktree -- ${escaped}`, projectRoot, { stdio: "pipe" as const });
  }

  for (const f of untrackedFiles) {
    try {
      unlinkSync(f);
    } catch {
      // File may already be gone, ignore
    }
  }
}

/**
 * Create a lightweight commit of the current working tree without touching the stash ref.
 * Returns the commit hash. Used as a pre-bash baseline for per-command diff.
 */
export function gitStashCreate(projectRoot: string): string {
  const hash = gitExec("stash create --include-untracked", projectRoot).trim();
  if (!hash) throw new Error("git stash create returned empty hash");
  return hash;
}

export function headHash(projectRoot: string): string {
  return gitExec("rev-parse HEAD", projectRoot).trim();
}

/** Get the commit message of HEAD. */
export function headMessage(projectRoot: string): string {
  return gitExec("log -1 --format=%s HEAD", projectRoot).trim();
}

/** Check if HEAD has a parent commit (i.e. can go back one). */
export function hasParent(projectRoot: string): boolean {
  try {
    gitExec("rev-parse HEAD~1", projectRoot);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get files changed since a specific commit (instead of HEAD).
 */
export function changesSince(projectRoot: string, commitHash: string): string[] {
  const out = gitExec(`diff --name-only ${commitHash} -- .`, projectRoot).trim();
  const files = out ? out.split("\n") : [];
  // Also include untracked files
  const untracked = untrackedFiles(projectRoot);
  return [...new Set([...files, ...untracked])];
}

/** Hard reset — discard all uncommitted changes (tracked and untracked), keep HEAD. */
export function resetHard(projectRoot: string): void {
  gitExec("reset --hard", projectRoot, { stdio: "pipe" as const });
  gitExec("clean -fd", projectRoot, { stdio: "pipe" as const });
}

/** Soft reset — remove last commit, keep working tree content as unstaged. */
export function undoLastCommit(projectRoot: string): void {
  gitExec("reset --soft HEAD~1", projectRoot, { stdio: "pipe" as const });
}

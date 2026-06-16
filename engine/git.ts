import { execSync, type ExecSyncOptions } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

export function restoreFiles(projectRoot: string, files: string[]): void {
  if (files.length === 0) return;
  const escaped = files.map((f) => `"${f}"`).join(" ");
  gitExec(`restore -- ${escaped}`, projectRoot, { stdio: "pipe" as const });
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

/** Hard reset — discard all uncommitted changes (tracked and untracked), keep HEAD. */
export function resetHard(projectRoot: string): void {
  gitExec("reset --hard", projectRoot, { stdio: "pipe" as const });
  gitExec("clean -fd", projectRoot, { stdio: "pipe" as const });
}

/** Soft reset — remove last commit, keep working tree content as unstaged. */
export function undoLastCommit(projectRoot: string): void {
  gitExec("reset --soft HEAD~1", projectRoot, { stdio: "pipe" as const });
}

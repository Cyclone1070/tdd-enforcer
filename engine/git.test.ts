import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initGit, snapshot, changesSinceSnapshot, modifiedFiles, untrackedFiles, restoreFiles, headHash } from "./git.js";

let testDir: string;

beforeAll(() => {
  testDir = join(tmpdir(), `tdd-git-test-${Date.now()}`);
  mkdirSync(join(testDir, ".pi", "tdd"), { recursive: true });
  mkdirSync(join(testDir, "src"), { recursive: true });
  writeFileSync(join(testDir, "src", "main.ts"), "// initial", "utf-8");
});

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("git operations", () => {
  it("initGit creates private git repo", () => {
    initGit(testDir);
    expect(existsSync(join(testDir, ".pi", "tdd", ".git"))).toBe(true);
    expect(existsSync(join(testDir, ".pi", "tdd", ".gitignore"))).toBe(true);
  });

  it("has initial commit after init", () => {
    const hash = headHash(testDir);
    expect(hash).toBeTruthy();
    expect(hash.length).toBeGreaterThan(10);
  });

  it("snapshot captures changes", () => {
    writeFileSync(join(testDir, "src", "main.ts"), "// modified", "utf-8");
    const hash = snapshot(testDir, "green");
    expect(hash).toBeTruthy();
  });

  it("modifiedFiles returns changed files", () => {
    writeFileSync(join(testDir, "src", "main.ts"), "// changed again", "utf-8");
    const modified = modifiedFiles(testDir);
    expect(modified).toContain("src/main.ts");
  });

  it("untrackedFiles returns new files", () => {
    writeFileSync(join(testDir, "newfile.ts"), "// new", "utf-8");
    const untracked = untrackedFiles(testDir);
    expect(untracked).toContain("newfile.ts");
  });

  it("changesSinceSnapshot combines modified + untracked", () => {
    writeFileSync(join(testDir, "src", "main.ts"), "// yet another change", "utf-8");
    writeFileSync(join(testDir, "another.ts"), "// also new", "utf-8");
    const changes = changesSinceSnapshot(testDir);
    expect(changes).toContain("src/main.ts");
    expect(changes).toContain("another.ts");
  });

  it("restoreFiles reverts specific files", () => {
    writeFileSync(join(testDir, "src", "main.ts"), "// to be reverted", "utf-8");
    expect(modifiedFiles(testDir)).toContain("src/main.ts");

    restoreFiles(testDir, ["src/main.ts"]);
    expect(modifiedFiles(testDir)).not.toContain("src/main.ts");
  });
});

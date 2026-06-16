import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initGit, snapshot, changesSinceSnapshot, modifiedFiles, untrackedFiles, restoreFiles, headHash, headMessage, hasParent, resetHard, undoLastCommit } from "./git.js";

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

  it("modifiedFiles returns empty when HEAD matches working tree", () => {
    expect(modifiedFiles(testDir)).not.toContain("src/main.ts");
  });

  it("untrackedFiles returns empty when no new files", () => {
    const untracked = untrackedFiles(testDir);
    expect(untracked).not.toContain("src/main.ts");
  });

  it("changesSinceSnapshot deduplicates when file is both modified and untracked", () => {
    // Write a file, snapshot it, then delete and recreate as different type
    const tmp = join(tmpdir(), `tdd-dedup-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    try {
      initGit(tmp);
      writeFileSync(join(tmp, "file.txt"), "original", "utf-8");
      snapshot(tmp, "red");
      // Delete tracked file — it's now a deletion (modified)
      rmSync(join(tmp, "file.txt"));
      // Recreate as untracked with same name
      writeFileSync(join(tmp, "file.txt"), "new content", "utf-8");
      const changes = changesSinceSnapshot(tmp);
      // Should appear exactly once despite matching both conditions
      const count = changes.filter((f) => f === "file.txt").length;
      expect(count).toBe(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("restoreFiles does nothing when files list is empty", () => {
    // Should not throw
    expect(() => restoreFiles(testDir, [])).not.toThrow();
  });
});

// ── Isolated tests for untested git functions ────────────────────────────────

function withTempDir(fn: (dir: string) => void) {
  const dir = join(tmpdir(), `tdd-git-extra-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("headMessage", () => {
  it("returns init commit message after initGit", () => {
    withTempDir((dir) => {
      initGit(dir);
      expect(headMessage(dir)).toBe("tdd: init");
    });
  });

  it("returns snapshot phase in commit message", () => {
    withTempDir((dir) => {
      initGit(dir);
      snapshot(dir, "green");
      expect(headMessage(dir)).toBe("tdd: green");
    });
  });

  it("updates after each snapshot", () => {
    withTempDir((dir) => {
      initGit(dir);
      snapshot(dir, "red");
      expect(headMessage(dir)).toBe("tdd: red");
      snapshot(dir, "green");
      expect(headMessage(dir)).toBe("tdd: green");
      snapshot(dir, "refactor");
      expect(headMessage(dir)).toBe("tdd: refactor");
    });
  });
});

describe("hasParent", () => {
  it("returns false when only init commit exists", () => {
    withTempDir((dir) => {
      initGit(dir);
      expect(hasParent(dir)).toBe(false);
    });
  });

  it("returns true after first snapshot", () => {
    withTempDir((dir) => {
      initGit(dir);
      snapshot(dir, "red");
      expect(hasParent(dir)).toBe(true);
    });
  });

  it("returns true after multiple snapshots", () => {
    withTempDir((dir) => {
      initGit(dir);
      snapshot(dir, "red");
      snapshot(dir, "green");
      snapshot(dir, "refactor");
      expect(hasParent(dir)).toBe(true);
    });
  });

  it("returns false after popping all snapshots back to init", () => {
    withTempDir((dir) => {
      initGit(dir);
      snapshot(dir, "red");
      expect(hasParent(dir)).toBe(true);
      undoLastCommit(dir);
      expect(hasParent(dir)).toBe(false);
    });
  });
});

describe("resetHard", () => {
  it("discards uncommitted changes", () => {
    withTempDir((dir) => {
      initGit(dir);
      writeFileSync(join(dir, "file.txt"), "original", "utf-8");
      snapshot(dir, "red");
      writeFileSync(join(dir, "file.txt"), "dirty", "utf-8");
      resetHard(dir);
      expect(readFileSync(join(dir, "file.txt"), "utf-8")).toBe("original");
    });
  });

  it("discards untracked files", () => {
    withTempDir((dir) => {
      initGit(dir);
      snapshot(dir, "red");
      writeFileSync(join(dir, "scratch.txt"), "should vanish", "utf-8");
      resetHard(dir);
      expect(existsSync(join(dir, "scratch.txt"))).toBe(false);
    });
  });

  it("leaves committed changes intact", () => {
    withTempDir((dir) => {
      initGit(dir);
      writeFileSync(join(dir, "stays.txt"), "persists", "utf-8");
      snapshot(dir, "red");
      resetHard(dir);
      expect(existsSync(join(dir, "stays.txt"))).toBe(true);
      expect(readFileSync(join(dir, "stays.txt"), "utf-8")).toBe("persists");
    });
  });

  it("does not throw when working tree matches HEAD", () => {
    withTempDir((dir) => {
      initGit(dir);
      writeFileSync(join(dir, "file.txt"), "content", "utf-8");
      snapshot(dir, "red");
      expect(() => resetHard(dir)).not.toThrow();
    });
  });
});

describe("undoLastCommit", () => {
  it("removes last commit and keeps its content as unstaged changes", () => {
    withTempDir((dir) => {
      initGit(dir);
      writeFileSync(join(dir, "file.txt"), "v1", "utf-8");
      snapshot(dir, "red");
      writeFileSync(join(dir, "file.txt"), "v2", "utf-8");
      snapshot(dir, "green");

      // No uncommitted changes before undo
      const before = changesSinceSnapshot(dir);
      expect(before).toHaveLength(0);

      undoLastCommit(dir);

      // HEAD is now red snapshot (v1), but WT still has v2
      expect(headMessage(dir)).toBe("tdd: red");
      expect(modifiedFiles(dir)).toContain("file.txt");
      expect(readFileSync(join(dir, "file.txt"), "utf-8")).toBe("v2");
    });
  });

  it("exposes popped content — new file stays in working tree and index", () => {
    withTempDir((dir) => {
      initGit(dir);
      snapshot(dir, "red");
      writeFileSync(join(dir, "new.txt"), "added in green", "utf-8");
      snapshot(dir, "green");

      expect(changesSinceSnapshot(dir)).toHaveLength(0);

      undoLastCommit(dir);

      // git reset --soft preserves the index, so new.txt is still staged
      // It shows as modified (added) against HEAD, not as untracked
      expect(headMessage(dir)).toBe("tdd: red");
      expect(changesSinceSnapshot(dir)).toContain("new.txt");
      expect(readFileSync(join(dir, "new.txt"), "utf-8")).toBe("added in green");
    });
  });

  it("errors when there is no parent commit", () => {
    withTempDir((dir) => {
      initGit(dir);
      expect(() => undoLastCommit(dir)).toThrow();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initGit,
  snapshot,
  modifiedFiles,
  untrackedFiles,
  changesSinceSnapshot,
  restoreFilesTo,
  headHash,
  headMessage,
  hasParent,
  resetHard,
  undoLastCommit,
  gitStashCreate,
} from "./git.js";
import type { GitDeps } from "./git.js";

describe("git operations", () => {
  let deps: GitDeps;
  let outputs: Record<string, string>;

  function makeDeps(): GitDeps {
    const mockExecSync = vi.fn((cmd: string) => {
      for (const [prefix, out] of Object.entries(outputs)) {
        if (cmd.includes(prefix)) return Buffer.from(out);
      }
      return Buffer.from("");
    });
    return {
      execSync: mockExecSync as any,
      existsSync: vi.fn().mockReturnValue(false),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      rmSync: vi.fn(),
    };
  }

  beforeEach(() => {
    outputs = {};
    deps = makeDeps();
  });

  it("initGit creates private git repo", () => {
    initGit("/test", deps);
    expect(deps.execSync).toHaveBeenCalledWith(
      expect.stringContaining("git init"),
      expect.any(Object),
    );
    expect(deps.execSync).toHaveBeenCalledWith(
      expect.stringContaining("git config core.worktree"),
      expect.any(Object),
    );
    expect(deps.mkdirSync).toHaveBeenCalled();
    expect(deps.writeFileSync).toHaveBeenCalled();
  });

  it("has initial commit after init", () => {
    outputs["rev-parse HEAD"] = "abc123def456\n";
    const hash = headHash("/test", deps);
    expect(hash).toBe("abc123def456");
  });

  it("snapshot captures changes", () => {
    outputs["rev-parse HEAD"] = "hash123\n";
    const hash = snapshot("/test", "green", deps);
    expect(hash).toBe("hash123");
    expect(deps.execSync).toHaveBeenCalledWith(
      expect.stringContaining('commit --allow-empty -m "tdd: green"'),
      expect.any(Object),
    );
  });

  it("modifiedFiles returns changed files", () => {
    outputs["diff --name-only HEAD"] = "src/main.ts\n";
    const modified = modifiedFiles("/test", deps);
    expect(modified).toContain("src/main.ts");
  });

  it("untrackedFiles returns new files", () => {
    outputs["ls-files --others --exclude-standard"] = "newfile.ts\n";
    const untracked = untrackedFiles("/test", deps);
    expect(untracked).toContain("newfile.ts");
  });

  it("changesSinceSnapshot combines modified + untracked", () => {
    outputs["diff --name-only HEAD"] = "src/main.ts\n";
    outputs["ls-files --others --exclude-standard"] = "newfile.ts\n";
    const changes = changesSinceSnapshot("/test", deps);
    expect(changes).toContain("src/main.ts");
    expect(changes).toContain("newfile.ts");
  });

  it("restoreFilesTo reverts specific files", () => {
    outputs["ls-files"] = "src/main.ts\n";
    restoreFilesTo("/test", ["src/main.ts"], undefined, deps);
    expect(deps.execSync).toHaveBeenCalledWith(
      expect.stringContaining("git restore"),
      expect.any(Object),
    );
  });

  it("modifiedFiles returns empty when HEAD matches working tree", () => {
    outputs["diff --name-only HEAD"] = "";
    const modified = modifiedFiles("/test", deps);
    expect(modified).not.toContain("src/main.ts");
  });

  it("untrackedFiles returns empty when no new files", () => {
    outputs["ls-files --others --exclude-standard"] = "";
    const untracked = untrackedFiles("/test", deps);
    expect(untracked).not.toContain("src/main.ts");
  });

  it("changesSinceSnapshot deduplicates when file is both modified and untracked", () => {
    outputs["diff --name-only HEAD"] = "file.txt\n";
    outputs["ls-files --others --exclude-standard"] = "file.txt\n";
    const changes = changesSinceSnapshot("/test", deps);
    const count = changes.filter((f) => f === "file.txt").length;
    expect(count).toBe(1);
  });

  it("restoreFilesTo does nothing when files list is empty", () => {
    expect(() => restoreFilesTo("/test", [], undefined, deps)).not.toThrow();
    expect(deps.execSync).not.toHaveBeenCalled();
  });
});

describe("headMessage", () => {
  let deps: GitDeps;
  let outputs: Record<string, string>;

  function makeDeps(): GitDeps {
    const mockExecSync = vi.fn((cmd: string) => {
      for (const [prefix, out] of Object.entries(outputs)) {
        if (cmd.includes(prefix)) return Buffer.from(out);
      }
      return Buffer.from("");
    });
    return {
      execSync: mockExecSync as any,
      existsSync: vi.fn().mockReturnValue(false),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      rmSync: vi.fn(),
    };
  }

  beforeEach(() => {
    outputs = {};
    deps = makeDeps();
  });

  it("returns init commit message after initGit", () => {
    outputs["log -1 --format=%s HEAD"] = "tdd: init\n";
    expect(headMessage("/test", deps)).toBe("tdd: init");
  });

  it("returns snapshot phase in commit message", () => {
    outputs["log -1 --format=%s HEAD"] = "tdd: green\n";
    expect(headMessage("/test", deps)).toBe("tdd: green");
  });

  it("updates after each snapshot", () => {
    outputs["rev-parse HEAD"] = "hash1\n";
    snapshot("/test", "red", deps);
    outputs["rev-parse HEAD"] = "hash2\n";
    snapshot("/test", "green", deps);
    outputs["log -1 --format=%s HEAD"] = "tdd: green\n";
    expect(headMessage("/test", deps)).toBe("tdd: green");
  });
});

describe("hasParent", () => {
  let deps: GitDeps;
  let outputs: Record<string, string>;

  function makeDeps(): GitDeps {
    const mockExecSync = vi.fn((cmd: string) => {
      for (const [prefix, out] of Object.entries(outputs)) {
        if (cmd.includes(prefix)) return Buffer.from(out);
      }
      return Buffer.from("");
    });
    return {
      execSync: mockExecSync as any,
      existsSync: vi.fn().mockReturnValue(false),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      rmSync: vi.fn(),
    };
  }

  beforeEach(() => {
    outputs = {};
    deps = makeDeps();
  });

  it("returns false when only init commit exists", () => {
    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd.includes("rev-parse HEAD~1")) throw new Error("unknown revision");
      return Buffer.from("");
    });
    deps = { ...deps, execSync: mockExecSync as any };
    expect(hasParent("/test", deps)).toBe(false);
  });

  it("returns true after first snapshot", () => {
    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd.includes("rev-parse HEAD~1")) return Buffer.from("abc123\n");
      return Buffer.from("");
    });
    deps = { ...deps, execSync: mockExecSync as any };
    expect(hasParent("/test", deps)).toBe(true);
  });

  it("returns true after multiple snapshots", () => {
    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd.includes("rev-parse HEAD~1")) return Buffer.from("abc123\n");
      return Buffer.from("");
    });
    deps = { ...deps, execSync: mockExecSync as any };
    expect(hasParent("/test", deps)).toBe(true);
  });

  it("returns false after popping all snapshots back to init", () => {
    let headExists = true;
    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd.includes("rev-parse HEAD~1")) {
        if (!headExists) throw new Error("unknown revision");
        return Buffer.from("abc123\n");
      }
      if (cmd.includes("reset --soft HEAD~1")) {
        headExists = false;
        return Buffer.from("");
      }
      return Buffer.from("");
    });
    deps = { ...deps, execSync: mockExecSync as any };

    expect(hasParent("/test", deps)).toBe(true);
    undoLastCommit("/test", deps);
    expect(hasParent("/test", deps)).toBe(false);
  });
});

describe("resetHard", () => {
  let deps: GitDeps;
  let outputs: Record<string, string>;

  function makeDeps(): GitDeps {
    const mockExecSync = vi.fn((cmd: string) => {
      for (const [prefix, out] of Object.entries(outputs)) {
        if (cmd.includes(prefix)) return Buffer.from(out);
      }
      return Buffer.from("");
    });
    return {
      execSync: mockExecSync as any,
      existsSync: vi.fn().mockReturnValue(false),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      rmSync: vi.fn(),
    };
  }

  beforeEach(() => {
    outputs = {};
    deps = makeDeps();
  });

  it("discards uncommitted changes", () => {
    resetHard("/test", deps);
    expect(deps.execSync).toHaveBeenCalledWith(
      expect.stringContaining("git reset --hard"),
      expect.any(Object),
    );
    expect(deps.execSync).toHaveBeenCalledWith(
      expect.stringContaining("git clean -fd"),
      expect.any(Object),
    );
  });

  it("discards untracked files", () => {
    resetHard("/test", deps);
    expect(deps.execSync).toHaveBeenCalledWith(
      expect.stringContaining("git clean -fd"),
      expect.any(Object),
    );
  });

  it("leaves committed changes intact", () => {
    resetHard("/test", deps);
    expect(deps.execSync).toHaveBeenCalledWith(
      expect.stringContaining("git reset --hard"),
      expect.any(Object),
    );
  });

  it("does not throw when working tree matches HEAD", () => {
    expect(() => resetHard("/test", deps)).not.toThrow();
  });
});

describe("undoLastCommit", () => {
  let deps: GitDeps;
  let outputs: Record<string, string>;

  function makeDeps(): GitDeps {
    const mockExecSync = vi.fn((cmd: string) => {
      for (const [prefix, out] of Object.entries(outputs)) {
        if (cmd.includes(prefix)) return Buffer.from(out);
      }
      return Buffer.from("");
    });
    return {
      execSync: mockExecSync as any,
      existsSync: vi.fn().mockReturnValue(false),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      rmSync: vi.fn(),
    };
  }

  beforeEach(() => {
    outputs = {};
    deps = makeDeps();
  });

  it("removes last commit and keeps its content as unstaged changes", () => {
    outputs["rev-parse HEAD"] = "hash1\n";
    snapshot("/test", "red", deps);
    outputs["rev-parse HEAD"] = "hash2\n";
    snapshot("/test", "green", deps);

    undoLastCommit("/test", deps);
    expect(deps.execSync).toHaveBeenCalledWith(
      expect.stringContaining("git reset --soft HEAD~1"),
      expect.any(Object),
    );

    outputs["diff --name-only HEAD"] = "file.txt\n";
    expect(modifiedFiles("/test", deps)).toContain("file.txt");
  });

  it("exposes popped content — new file stays in working tree and index", () => {
    outputs["rev-parse HEAD"] = "hash1\n";
    snapshot("/test", "red", deps);
    outputs["rev-parse HEAD"] = "hash2\n";
    snapshot("/test", "green", deps);

    undoLastCommit("/test", deps);

    outputs["diff --name-only HEAD"] = "new.txt\n";
    outputs["ls-files --others --exclude-standard"] = "";
    expect(changesSinceSnapshot("/test", deps)).toContain("new.txt");
  });

  it("errors when there is no parent commit", () => {
    const mockExecSync = vi.fn((cmd: string) => {
      if (cmd.includes("reset --soft HEAD~1")) throw new Error("unknown revision");
      return Buffer.from("");
    });
    deps = { ...deps, execSync: mockExecSync as any };
    expect(() => undoLastCommit("/test", deps)).toThrow();
  });
});

describe("gitStashCreate", () => {
  let deps: GitDeps;
  let outputs: Record<string, string>;

  function makeDeps(): GitDeps {
    const mockExecSync = vi.fn((cmd: string) => {
      for (const [prefix, out] of Object.entries(outputs)) {
        if (cmd.includes(prefix)) return Buffer.from(out);
      }
      return Buffer.from("");
    });
    return {
      execSync: mockExecSync as any,
      existsSync: vi.fn().mockReturnValue(false),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      rmSync: vi.fn(),
    };
  }

  beforeEach(() => {
    outputs = {};
    deps = makeDeps();
  });

  it("returns a hash when tracked file is modified", () => {
    outputs["stash create --include-untracked"] = "abc123\n";
    const result = gitStashCreate("/test", deps);
    expect(result).toBe("abc123");
  });

  it("returns HEAD when working tree is clean", () => {
    outputs["stash create --include-untracked"] = "";
    const result = gitStashCreate("/test", deps);
    expect(result).toBe("HEAD");
  });
});

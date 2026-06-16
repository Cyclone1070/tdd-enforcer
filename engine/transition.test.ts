import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { nextPhase, checkGate, getDisallowedChanges } from "./transition.js";
import type { Config, TestRunner } from "./types.js";
import { initGit, snapshot } from "./git.js";

// ── Pure unit tests: nextPhase ──────────────────────────────────────────────

describe("nextPhase", () => {
  it("returns green from red", () => {
    expect(nextPhase("red")).toBe("green");
  });

  it("returns refactor from green", () => {
    expect(nextPhase("green")).toBe("refactor");
  });

  it("returns red from refactor", () => {
    expect(nextPhase("refactor")).toBe("red");
  });

  it("returns null for unknown phase", () => {
    expect(nextPhase("blurple" as any)).toBeNull();
  });
});

// ── Pure unit tests: checkGate ──────────────────────────────────────────────

function makeRunner(passed: boolean): TestRunner {
  return async (_cmds, _timeout) => ({
    passed,
    message: passed ? "all ok" : "tests failed",
  });
}

const testConfig: Config = {
  allowedRedPhaseFiles: [],
  allowedGreenPhaseFiles: [],
  testCommands: ["npm test"],
  timeoutSeconds: 30,
};

const emptyConfig: Config = { ...testConfig, testCommands: [] };

describe("checkGate", () => {
  describe("empty test commands (gate skipped)", () => {
    it("passes every transition when no test commands configured", async () => {
      const r1 = await checkGate("red", "green", makeRunner(false), emptyConfig);
      expect(r1.passed).toBe(true);
      const r2 = await checkGate("red", "green", makeRunner(true), emptyConfig);
      expect(r2.passed).toBe(true);
    });
  });

  describe("red → green (tests must fail)", () => {
    it("allows when tests fail", async () => {
      const r = await checkGate("red", "green", makeRunner(false), testConfig);
      expect(r.passed).toBe(true);
      expect(r.message).toMatch(/proceed|fail/i);
    });

    it("blocks when tests pass", async () => {
      const r = await checkGate("red", "green", makeRunner(true), testConfig);
      expect(r.passed).toBe(false);
      expect(r.message).toMatch(/break a test/i);
    });
  });

  describe("green → refactor (tests must pass)", () => {
    it("allows when tests pass", async () => {
      const r = await checkGate("green", "refactor", makeRunner(true), testConfig);
      expect(r.passed).toBe(true);
      expect(r.message).toMatch(/pass/i);
    });

    it("blocks when tests fail", async () => {
      const r = await checkGate("green", "refactor", makeRunner(false), testConfig);
      expect(r.passed).toBe(false);
      expect(r.message).toMatch(/failing/i);
    });
  });

  describe("refactor → red (tests must pass)", () => {
    it("allows when tests pass", async () => {
      const r = await checkGate("refactor", "red", makeRunner(true), testConfig);
      expect(r.passed).toBe(true);
      expect(r.message).toMatch(/pass/i);
    });

    it("blocks when tests fail", async () => {
      const r = await checkGate("refactor", "red", makeRunner(false), testConfig);
      expect(r.passed).toBe(false);
      expect(r.message).toMatch(/failing/i);
    });
  });

  describe("unknown transition", () => {
    it("blocks with message containing the transition string", async () => {
      const r = await checkGate("green", "red" as any, makeRunner(true), testConfig);
      expect(r.passed).toBe(false);
      expect(r.message).toContain("green→red");
    });
  });

  it("passes test commands to the runner", async () => {
    let captured: string[] | undefined;
    const runner: TestRunner = async (cmds) => {
      captured = cmds;
      return { passed: true, message: "" };
    };
    await checkGate("red", "green", runner, testConfig);
    expect(captured).toEqual(["npm test"]);
  });

  it("passes timeoutSeconds to the runner", async () => {
    let captured: number | undefined;
    const runner: TestRunner = async (_cmds, t) => {
      captured = t;
      return { passed: true, message: "" };
    };
    await checkGate("red", "green", runner, testConfig);
    expect(captured).toBe(30);
  });

  it("passes multiple test commands to the runner", async () => {
    const multiConfig: Config = {
      ...testConfig,
      testCommands: ["npm run test:unit", "npm run test:integration"],
    };
    let captured: string[] | undefined;
    const runner: TestRunner = async (cmds) => {
      captured = cmds;
      return { passed: true, message: "" };
    };
    await checkGate("red", "green", runner, multiConfig);
    expect(captured).toHaveLength(2);
    expect(captured).toContain("npm run test:unit");
    expect(captured).toContain("npm run test:integration");
  });
});

// ── Integration tests: getDisallowedChanges ──────────────────────────────────

function withTempDir(fn: (dir: string) => void) {
  const dir = join(tmpdir(), `tdd-transition-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const denyConfig: Config = {
  allowedRedPhaseFiles: ["tests/**/*.test.ts"],
  allowedGreenPhaseFiles: ["src/**/*.ts"],
  testCommands: [],
  timeoutSeconds: 30,
};

describe("getDisallowedChanges", () => {
  it("returns empty for refactor phase regardless of git state", () => {
    withTempDir((dir) => {
      // No git at all — safe because refactor returns early
      expect(getDisallowedChanges(dir, "refactor", denyConfig)).toEqual([]);
    });
  });

  it("returns empty when no files changed", () => {
    withTempDir((dir) => {
      initGit(dir);
      snapshot(dir, "red");
      expect(getDisallowedChanges(dir, "red", denyConfig)).toEqual([]);
    });
  });

  it("returns disallowed files in red phase", () => {
    withTempDir((dir) => {
      initGit(dir);
      snapshot(dir, "red");
      mkdirSync(join(dir, "src"), { recursive: true });
      mkdirSync(join(dir, "tests"), { recursive: true });
      writeFileSync(join(dir, "src", "main.ts"), "// impl", "utf-8");
      writeFileSync(join(dir, "tests", "foo.test.ts"), "// test", "utf-8");
      writeFileSync(join(dir, "README.md"), "// docs", "utf-8");
      const violations = getDisallowedChanges(dir, "red", denyConfig);
      expect(violations).toContain("src/main.ts");
      expect(violations).not.toContain("tests/foo.test.ts");
      expect(violations).not.toContain("README.md");
    });
  });

  it("returns disallowed files in green phase", () => {
    withTempDir((dir) => {
      initGit(dir);
      snapshot(dir, "green");
      mkdirSync(join(dir, "tests"), { recursive: true });
      mkdirSync(join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "tests", "foo.test.ts"), "// test", "utf-8");
      writeFileSync(join(dir, "src", "main.ts"), "// impl", "utf-8");
      writeFileSync(join(dir, "package.json"), "{}", "utf-8");
      const violations = getDisallowedChanges(dir, "green", denyConfig);
      expect(violations).toContain("tests/foo.test.ts");
      expect(violations).not.toContain("src/main.ts");
      expect(violations).not.toContain("package.json");
    });
  });

  it("catches untracked files, not just modified", () => {
    withTempDir((dir) => {
      initGit(dir);
      snapshot(dir, "red");
      mkdirSync(join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "src", "new.ts"), "// brand new", "utf-8");
      const violations = getDisallowedChanges(dir, "red", denyConfig);
      expect(violations).toContain("src/new.ts");
    });
  });
});

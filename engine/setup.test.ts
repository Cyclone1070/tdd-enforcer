import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ensureReady } from "./setup.js";

let dirs: string[] = [];

function freshDir(): string {
  const d = join(tmpdir(), `tdd-setup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(d, { recursive: true });
  dirs.push(d);
  return d;
}

function writeRules(dir: string, overrides: Record<string, any> = {}) {
  const tddDir = join(dir, ".pi", "tdd");
  mkdirSync(tddDir, { recursive: true });
  writeFileSync(
    join(tddDir, "rules.json"),
    JSON.stringify({
      allowedRedPhaseFiles: ["tests/**/*.test.ts"],
      allowedGreenPhaseFiles: ["src/**/*.ts"],
      testCommands: ["npm test"],
      timeoutSeconds: 30,
      ...overrides,
    }),
    "utf-8",
  );
}

function writePhase(dir: string, overrides: Record<string, any> = {}) {
  const tddDir = join(dir, ".pi", "tdd");
  mkdirSync(tddDir, { recursive: true });
  writeFileSync(
    join(tddDir, "phase.json"),
    JSON.stringify({
      enabled: true,
      current: "red",
      ...overrides,
    }),
    "utf-8",
  );
}

afterEach(() => {
  for (const d of dirs) {
    rmSync(d, { recursive: true, force: true });
  }
  dirs = [];
});

describe("ensureReady", () => {
  it("returns false when .pi/tdd/ does not exist", () => {
    const dir = freshDir();
    expect(ensureReady(dir)).toBe(false);
  });

  it("returns false when rules.json is missing", () => {
    const dir = freshDir();
    mkdirSync(join(dir, ".pi", "tdd"), { recursive: true });
    writePhase(dir);
    expect(ensureReady(dir)).toBe(false);
  });

  it("returns false when phase.json is missing", () => {
    const dir = freshDir();
    writeRules(dir);
    expect(ensureReady(dir)).toBe(false);
  });

  it("returns false when rules.json has no allowedRedPhaseFiles", () => {
    const dir = freshDir();
    writeRules(dir, { allowedRedPhaseFiles: undefined });
    writePhase(dir);
    expect(ensureReady(dir)).toBe(false);
  });

  it("returns false when rules.json has no allowedGreenPhaseFiles", () => {
    const dir = freshDir();
    writeRules(dir, { allowedGreenPhaseFiles: undefined });
    writePhase(dir);
    expect(ensureReady(dir)).toBe(false);
  });

  it("returns false when rules.json has no testCommands", () => {
    const dir = freshDir();
    writeRules(dir, { testCommands: undefined });
    writePhase(dir);
    expect(ensureReady(dir)).toBe(false);
  });

  it("returns false when phase.json has invalid current phase", () => {
    const dir = freshDir();
    writeRules(dir);
    writePhase(dir, { current: "blurple" });
    expect(ensureReady(dir)).toBe(false);
  });

  it("returns false when phase.json has current: off (migrated format)", () => {
    const dir = freshDir();
    writeRules(dir);
    writePhase(dir, { current: "off" });
    expect(ensureReady(dir)).toBe(false);
  });

  it("returns true when all files exist and are valid, git init auto-heals", () => {
    const dir = freshDir();
    writeRules(dir);
    writePhase(dir);

    const result = ensureReady(dir);

    expect(result).toBe(true);
    // Must have created .git
    expect(existsSync(join(dir, ".pi", "tdd", ".git"))).toBe(true);
  });

  it("returns true when git already exists (idempotent)", () => {
    const dir = freshDir();
    writeRules(dir);
    writePhase(dir);

    // First call inits git
    expect(ensureReady(dir)).toBe(true);

    // Second call with git already present
    expect(ensureReady(dir)).toBe(true);
  });

  it("returns false when rules.json is malformed JSON", () => {
    const dir = freshDir();
    const tddDir = join(dir, ".pi", "tdd");
    mkdirSync(tddDir, { recursive: true });
    writeFileSync(join(tddDir, "rules.json"), "not valid json{{{", "utf-8");
    writePhase(dir);
    expect(ensureReady(dir)).toBe(false);
  });

  it("returns false when phase.json is malformed JSON", () => {
    const dir = freshDir();
    const tddDir = join(dir, ".pi", "tdd");
    mkdirSync(tddDir, { recursive: true });
    writeFileSync(join(tddDir, "phase.json"), "{{{bad", "utf-8");
    writeRules(dir);
    expect(ensureReady(dir)).toBe(false);
  });

  it("returns true for all valid phases: red, green, refactor", () => {
    for (const phase of ["red", "green", "refactor"] as const) {
      const dir = freshDir();
      writeRules(dir);
      writePhase(dir, { current: phase });
      expect(ensureReady(dir)).toBe(true);
      expect(existsSync(join(dir, ".pi", "tdd", ".git"))).toBe(true);
    }
  });
});

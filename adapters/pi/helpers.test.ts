import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadTddState } from "./helpers.js";

function withTempDir(fn: (dir: string) => void) {
  const dir = join(tmpdir(), `tdd-helpers-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const validRules = {
  allowedRedPhaseFiles: ["tests/**/*.test.ts"],
  allowedGreenPhaseFiles: ["src/**/*.ts"],
  testCommands: ["npm test"],
  timeoutSeconds: 30,
};

const validPhase = {
  enabled: true,
  current: "red",
};

describe("loadTddState", () => {
  it("returns missing dir error when .pi/tdd does not exist", () => {
    withTempDir((dir) => {
      const result = loadTddState(dir);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("Missing .pi/tdd/");
    });
  });

  it("returns missing rules.json error when only dir exists", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, ".pi", "tdd"), { recursive: true });
      const result = loadTddState(dir);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("rules.json");
    });
  });

  it("returns missing phase.json when rules exists but phase missing", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, ".pi", "tdd"), { recursive: true });
      writeFileSync(
        join(dir, ".pi", "tdd", "rules.json"),
        JSON.stringify(validRules),
        "utf-8",
      );
      const result = loadTddState(dir);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("phase.json");
    });
  });

  it("returns invalid phase.json error for malformed JSON", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, ".pi", "tdd"), { recursive: true });
      writeFileSync(
        join(dir, ".pi", "tdd", "rules.json"),
        JSON.stringify(validRules),
        "utf-8",
      );
      writeFileSync(join(dir, ".pi", "tdd", "phase.json"), "not json", "utf-8");
      const result = loadTddState(dir);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("Invalid .pi/tdd/phase.json");
    });
  });

  it("returns invalid rules.json error for malformed JSON", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, ".pi", "tdd"), { recursive: true });
      writeFileSync(
        join(dir, ".pi", "tdd", "rules.json"),
        "not json",
        "utf-8",
      );
      writeFileSync(
        join(dir, ".pi", "tdd", "phase.json"),
        JSON.stringify(validPhase),
        "utf-8",
      );
      const result = loadTddState(dir);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("Invalid .pi/tdd/rules.json");
    });
  });

  it("returns disabled error when phase.json has enabled: false", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, ".pi", "tdd"), { recursive: true });
      writeFileSync(
        join(dir, ".pi", "tdd", "rules.json"),
        JSON.stringify(validRules),
        "utf-8",
      );
      writeFileSync(
        join(dir, ".pi", "tdd", "phase.json"),
        JSON.stringify({ enabled: false, current: "red" }),
        "utf-8",
      );
      const result = loadTddState(dir);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("TDD is not enabled");
    });
  });

  it("returns ok with state and config when everything valid", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, ".pi", "tdd"), { recursive: true });
      writeFileSync(
        join(dir, ".pi", "tdd", "rules.json"),
        JSON.stringify(validRules),
        "utf-8",
      );
      writeFileSync(
        join(dir, ".pi", "tdd", "phase.json"),
        JSON.stringify(validPhase),
        "utf-8",
      );
      const result = loadTddState(dir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.current).toBe("red");
        expect(result.state.enabled).toBe(true);
        expect(result.config.testCommands).toEqual(["npm test"]);
        expect(result.config.allowedRedPhaseFiles).toEqual(["tests/**/*.test.ts"]);
      }
    });
  });

  it("heals missing git repo automatically", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, ".pi", "tdd"), { recursive: true });
      writeFileSync(
        join(dir, ".pi", "tdd", "rules.json"),
        JSON.stringify(validRules),
        "utf-8",
      );
      writeFileSync(
        join(dir, ".pi", "tdd", "phase.json"),
        JSON.stringify(validPhase),
        "utf-8",
      );

      const gitDir = join(dir, ".pi", "tdd", ".git");
      expect(existsSync(gitDir)).toBe(false);

      const result = loadTddState(dir);
      expect(result.ok).toBe(true);

      // Git should now exist
      expect(existsSync(gitDir)).toBe(true);
    });
  });

  it("handles multiple calls without error (existing git is reused)", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, ".pi", "tdd"), { recursive: true });
      writeFileSync(
        join(dir, ".pi", "tdd", "rules.json"),
        JSON.stringify(validRules),
        "utf-8",
      );
      writeFileSync(
        join(dir, ".pi", "tdd", "phase.json"),
        JSON.stringify(validPhase),
        "utf-8",
      );

      const r1 = loadTddState(dir);
      expect(r1.ok).toBe(true);

      const r2 = loadTddState(dir);
      expect(r2.ok).toBe(true);
    });
  });

  it("passes through the phase.json validation error for invalid current phase", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, ".pi", "tdd"), { recursive: true });
      writeFileSync(
        join(dir, ".pi", "tdd", "rules.json"),
        JSON.stringify(validRules),
        "utf-8",
      );
      writeFileSync(
        join(dir, ".pi", "tdd", "phase.json"),
        JSON.stringify({ enabled: true, current: "blurple" }),
        "utf-8",
      );
      const result = loadTddState(dir);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("Invalid .pi/tdd/phase.json");
    });
  });
});

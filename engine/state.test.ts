import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadPhaseState, savePhaseState } from "./state.js";

function withTempDir(fn: (dir: string) => void) {
  const dir = join(tmpdir(), `tdd-state-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("loadPhaseState", () => {
  it("throws when no file exists", () => {
    withTempDir((dir) => {
      expect(() => loadPhaseState(dir)).toThrow();
    });
  });

  it("returns parsed state from state.json", () => {
    withTempDir((dir) => {
      const tddDir = join(dir, ".pi", "tdd");
      mkdirSync(tddDir, { recursive: true });
      writeFileSync(
        join(tddDir, "state.json"),
        JSON.stringify({ enabled: true, current: "green" }),
        "utf-8",
      );
      const state = loadPhaseState(dir);
      expect(state.enabled).toBe(true);
      expect(state.current).toBe("green");
    });
  });

  it("throws when current is an invalid phase", () => {
    withTempDir((dir) => {
      const tddDir = join(dir, ".pi", "tdd");
      mkdirSync(tddDir, { recursive: true });
      writeFileSync(
        join(tddDir, "state.json"),
        JSON.stringify({ enabled: true, current: "blurple" }),
        "utf-8",
      );
      expect(() => loadPhaseState(dir)).toThrow();
    });
  });

  it("throws when current is the old 'off' value", () => {
    withTempDir((dir) => {
      const tddDir = join(dir, ".pi", "tdd");
      mkdirSync(tddDir, { recursive: true });
      writeFileSync(
        join(tddDir, "state.json"),
        JSON.stringify({ enabled: false, current: "off" }),
        "utf-8",
      );
      expect(() => loadPhaseState(dir)).toThrow();
    });
  });

  it("throws on malformed JSON", () => {
    withTempDir((dir) => {
      const tddDir = join(dir, ".pi", "tdd");
      mkdirSync(tddDir, { recursive: true });
      writeFileSync(join(tddDir, "state.json"), "not json{{{", "utf-8");
      expect(() => loadPhaseState(dir)).toThrow();
    });
  });
});

describe("savePhaseState", () => {
  it("writes state.json and can be read back", () => {
    withTempDir((dir) => {
      savePhaseState(dir, { enabled: true, current: "refactor" });
      const state = loadPhaseState(dir);
      expect(state.enabled).toBe(true);
      expect(state.current).toBe("refactor");
    });
  });
});

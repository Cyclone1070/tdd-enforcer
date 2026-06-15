import { describe, it, expect } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "./config.js";

function withTempDir(fn: (dir: string) => void) {
  const dir = join(tmpdir(), `tdd-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("loadConfig", () => {
  it("returns defaults when no config exists", () => {
    withTempDir((dir) => {
      const config = loadConfig(dir);
      expect(config.allowedRedPhaseFiles).toEqual([]);
      expect(config.allowedGreenPhaseFiles).toEqual([]);
      expect(config.testCommands).toEqual([]);
      expect(config.timeoutSeconds).toBe(120);
    });
  });

  it("loads config from rules.json", () => {
    withTempDir((dir) => {
      const tddDir = join(dir, ".pi", "tdd");
      mkdirSync(tddDir, { recursive: true });
      writeFileSync(
        join(tddDir, "rules.json"),
        JSON.stringify({
          allowedRedPhaseFiles: ["tests/**/*.test.ts"],
          allowedGreenPhaseFiles: ["src/**/*.ts"],
          testCommands: ["npm run test"],
          timeoutSeconds: 60,
        }),
        "utf-8",
      );

      const config = loadConfig(dir);
      expect(config.allowedRedPhaseFiles).toEqual(["tests/**/*.test.ts"]);
      expect(config.timeoutSeconds).toBe(60);
    });
  });

  it("supports multiple test commands", () => {
    withTempDir((dir) => {
      const tddDir = join(dir, ".pi", "tdd");
      mkdirSync(tddDir, { recursive: true });
      writeFileSync(
        join(tddDir, "rules.json"),
        JSON.stringify({
          testCommands: ["npm run test:unit", "npm run test:integration"],
        }),
        "utf-8",
      );

      const config = loadConfig(dir);
      expect(config.testCommands).toHaveLength(2);
    });
  });
});

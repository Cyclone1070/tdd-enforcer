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
  it("throws when no config exists", () => {
    withTempDir((dir) => {
      expect(() => loadConfig(dir)).toThrow();
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
          allowedRedPhaseFiles: ["tests/**/*.test.ts"],
          allowedGreenPhaseFiles: ["src/**/*.ts"],
          testCommands: ["npm run test:unit", "npm run test:integration"],
        }),
        "utf-8",
      );

      const config = loadConfig(dir);
      expect(config.testCommands).toHaveLength(2);
    });
  });

  describe("validation — throws on invalid content", () => {
    it("throws when allowedRedPhaseFiles is not an array", () => {
      withTempDir((dir) => {
        const tddDir = join(dir, ".pi", "tdd");
        mkdirSync(tddDir, { recursive: true });
        writeFileSync(
          join(tddDir, "rules.json"),
          JSON.stringify({
            allowedRedPhaseFiles: "not-an-array",
            allowedGreenPhaseFiles: ["src/**/*.ts"],
            testCommands: ["npm test"],
          }),
          "utf-8",
        );
        expect(() => loadConfig(dir)).toThrow();
      });
    });

    it("throws when allowedGreenPhaseFiles is not an array", () => {
      withTempDir((dir) => {
        const tddDir = join(dir, ".pi", "tdd");
        mkdirSync(tddDir, { recursive: true });
        writeFileSync(
          join(tddDir, "rules.json"),
          JSON.stringify({
            allowedRedPhaseFiles: ["tests/**/*.test.ts"],
            allowedGreenPhaseFiles: null,
            testCommands: ["npm test"],
          }),
          "utf-8",
        );
        expect(() => loadConfig(dir)).toThrow();
      });
    });

    it("throws when testCommands is not an array", () => {
      withTempDir((dir) => {
        const tddDir = join(dir, ".pi", "tdd");
        mkdirSync(tddDir, { recursive: true });
        writeFileSync(
          join(tddDir, "rules.json"),
          JSON.stringify({
            allowedRedPhaseFiles: ["tests/**/*.test.ts"],
            allowedGreenPhaseFiles: ["src/**/*.ts"],
            testCommands: "npm test",
          }),
          "utf-8",
        );
        expect(() => loadConfig(dir)).toThrow();
      });
    });

    it("throws on malformed JSON", () => {
      withTempDir((dir) => {
        const tddDir = join(dir, ".pi", "tdd");
        mkdirSync(tddDir, { recursive: true });
        writeFileSync(join(tddDir, "rules.json"), "not json{{", "utf-8");
        expect(() => loadConfig(dir)).toThrow();
      });
    });
  });
});

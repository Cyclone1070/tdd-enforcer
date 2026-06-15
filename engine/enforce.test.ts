import { describe, it, expect } from "vitest";
import { isAllowed } from "./enforce.js";
import type { Config } from "./types.js";

const testConfig: Config = {
  allowedRedPhaseFiles: ["tests/**/*.test.ts", "specs/**/*.spec.ts"],
  allowedGreenPhaseFiles: ["src/**/*.ts", "lib/**/*.ts"],
  testCommands: ["npm test"],
  timeoutSeconds: 30,
};

describe("isAllowed", () => {
  it("allows everything in refactor phase", () => {
    expect(isAllowed("any/file.ts", "refactor", testConfig)).toBe(true);
    expect(isAllowed("tests/foo.test.ts", "refactor", testConfig)).toBe(true);
  });

  describe("red phase", () => {
    it("allows red phase files", () => {
      expect(isAllowed("tests/unit/foo.test.ts", "red", testConfig)).toBe(true);
      expect(isAllowed("specs/api.spec.ts", "red", testConfig)).toBe(true);
    });

    it("blocks green phase files", () => {
      expect(isAllowed("src/main.ts", "red", testConfig)).toBe(false);
      expect(isAllowed("lib/helper.ts", "red", testConfig)).toBe(false);
    });

    it("allows free files (match neither)", () => {
      expect(isAllowed("README.md", "red", testConfig)).toBe(true);
      expect(isAllowed("package.json", "red", testConfig)).toBe(true);
    });
  });

  describe("green phase", () => {
    it("allows green phase files", () => {
      expect(isAllowed("src/main.ts", "green", testConfig)).toBe(true);
      expect(isAllowed("lib/helper.ts", "green", testConfig)).toBe(true);
    });

    it("blocks red phase files", () => {
      expect(isAllowed("tests/unit/foo.test.ts", "green", testConfig)).toBe(false);
      expect(isAllowed("specs/api.spec.ts", "green", testConfig)).toBe(false);
    });

    it("allows free files", () => {
      expect(isAllowed("README.md", "green", testConfig)).toBe(true);
    });
  });

  it("handles nested glob patterns", () => {
    expect(isAllowed("src/deep/nested/file.ts", "green", testConfig)).toBe(true);
    expect(isAllowed("tests/deep/nested/test.test.ts", "red", testConfig)).toBe(true);
  });
});

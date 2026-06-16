import { describe, it, expect } from "vitest";
import { isAllowed, disallowedFiles } from "./enforce.js";
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

describe("disallowedFiles", () => {
  it("returns empty for refactor phase", () => {
    expect(disallowedFiles(["src/main.ts", "tests/foo.test.ts"], "refactor", testConfig)).toEqual([]);
  });

  it("returns empty when input list is empty", () => {
    expect(disallowedFiles([], "red", testConfig)).toEqual([]);
    expect(disallowedFiles([], "green", testConfig)).toEqual([]);
  });

  it("filters out green files in red phase", () => {
    const files = ["src/main.ts", "README.md", "tests/foo.test.ts"];
    expect(disallowedFiles(files, "red", testConfig)).toEqual(["src/main.ts"]);
  });

  it("filters out red files in green phase", () => {
    const files = ["tests/foo.test.ts", "README.md", "src/main.ts"];
    expect(disallowedFiles(files, "green", testConfig)).toEqual(["tests/foo.test.ts"]);
  });

  it("allows free files in both phases", () => {
    const free = ["README.md", "package.json", "docs/guide.md"];
    expect(disallowedFiles(free, "red", testConfig)).toEqual([]);
    expect(disallowedFiles(free, "green", testConfig)).toEqual([]);
  });

  it("blocks everything when all files match the other phase", () => {
    const redFiles = ["tests/a.test.ts", "specs/b.spec.ts"];
    const greenFiles = ["src/c.ts", "lib/d.ts"];
    expect(disallowedFiles(redFiles, "green", testConfig)).toEqual(redFiles);
    expect(disallowedFiles(greenFiles, "red", testConfig)).toEqual(greenFiles);
  });
});

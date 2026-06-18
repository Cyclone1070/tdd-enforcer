import { describe, it, expect } from "vitest";
import { getNudgePrompt } from "./prompts.js";
import type { Config } from "../../engine/types.js";

const config: Config = {
  allowedRedPhaseFiles: ["tests/**/*.test.ts"],
  allowedGreenPhaseFiles: ["src/**/*.ts"],
  testCommands: ["npm test"],
  timeoutSeconds: 30,
};

describe("getNudgePrompt", () => {
  it("returns RED prompt with config patterns by default", () => {
    const result = getNudgePrompt("red", config);
    expect(result).toContain("RED");
    expect(result).toContain("tests/**/*.test.ts");
  });

  it("returns RED prompt with custom matchedFiles override", () => {
    const result = getNudgePrompt("red", config, ["custom/**/*.test.ts"]);
    expect(result).toContain("RED");
    expect(result).toContain("custom/**/*.test.ts");
    expect(result).not.toContain("tests/**/*.test.ts");
  });

  it("returns GREEN prompt with both red and green patterns", () => {
    const result = getNudgePrompt("green", config);
    expect(result).toContain("GREEN");
    expect(result).toContain("tests/**/*.test.ts");
    expect(result).toContain("src/**/*.ts");
  });

  it("returns REFACTOR prompt", () => {
    const result = getNudgePrompt("refactor", config);
    expect(result).toContain("REFACTOR");
    expect(result).toContain("free to modify");
  });

  it("returns empty string for unknown phase", () => {
    const result = getNudgePrompt("blurple" as any, config);
    expect(result).toBe("");
  });
});

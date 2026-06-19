import { describe, expect, it } from "vitest";
import type { Config } from "../../engine/types.js";
import { getNudgePrompt } from "./prompts.js";

const config: Config = {
	blockedInRed: ["tests/**/*.test.ts"],
	blockedInGreen: ["src/**/*.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

describe("getNudgePrompt", () => {
	it("returns RED prompt with blocked files", () => {
		const result = getNudgePrompt("red", config);
		expect(result).toContain("RED");
		expect(result).toContain("Blocked files: tests/**/*.test.ts");
	});

	it("returns GREEN prompt with blocked files", () => {
		const result = getNudgePrompt("green", config);
		expect(result).toContain("GREEN");
		expect(result).toContain("Blocked files: src/**/*.ts");
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

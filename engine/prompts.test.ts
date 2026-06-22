import { describe, expect, it } from "vitest";
import { getNudgePrompt } from "./prompts.js";
import type { Config } from "./types.js";

const config: Config = {
	blockedInRed: ["tests/**/*.test.ts"],
	blockedInGreen: ["src/**/*.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

const emptyConfig: Config = {
	blockedInRed: [],
	blockedInGreen: [],
	testCommands: [],
	timeoutSeconds: 30,
};

describe("getNudgePrompt", () => {
	it("returns RED prompt with blocked files when phase is red", () => {
		const result = getNudgePrompt("red", config);
		expect(result).toBe(
			"You are now in **RED** phase. Write failing tests.\n" +
				"Blocked files: tests/**/*.test.ts\n" +
				"All other files are free to modify. Call `next_tdd_phase` to proceed to GREEN.\n" +
				"Think about what could go wrong and test for it — don't just verify the happy path, " +
				"cover unhappy paths and edge cases too.\n" +
				"Minimise the scope of each TDD cycle so reverting is cheap.",
		);
	});

	it("returns GREEN prompt with blocked files when phase is green", () => {
		const result = getNudgePrompt("green", config);
		expect(result).toBe(
			"You are now in **GREEN** phase. Implement features.\n" +
				"Blocked files: src/**/*.ts\n" +
				"All other files are free to modify. Call `next_tdd_phase` to proceed to REFACTOR.\n" +
				"Write minimal code to make the failing tests pass — nothing more.\n" +
				"If the RED phase tests were wrong, call `previous_tdd_phase` to go back and fix them.",
		);
	});

	it("returns REFACTOR prompt when phase is refactor", () => {
		const result = getNudgePrompt("refactor", config);
		expect(result).toBe(
			"You are now in **REFACTOR** phase. Both test and implementation files are free to modify. " +
				"Refactor without changing behavior. Call `next_tdd_phase` to start a new RED cycle.",
		);
	});

	it("returns empty string for unknown phase", () => {
		const result = getNudgePrompt("blurple" as any, config);
		expect(result).toBe("");
	});

	it("shows empty blocked files list when no blocks configured", () => {
		const result = getNudgePrompt("red", emptyConfig);
		expect(result).toContain("Blocked files: ");
	});

	it("shows multiple blocked files comma-separated in RED", () => {
		const cfg: Config = {
			...config,
			blockedInRed: ["*.ts", "*.json", "src/**"],
		};
		const result = getNudgePrompt("red", cfg);
		expect(result).toContain("Blocked files: *.ts, *.json, src/**");
	});

	it("shows multiple blocked files comma-separated in GREEN", () => {
		const cfg: Config = {
			...config,
			blockedInGreen: ["*.test.ts", "*.spec.ts"],
		};
		const result = getNudgePrompt("green", cfg);
		expect(result).toContain("Blocked files: *.test.ts, *.spec.ts");
	});

	it("includes RED keyword in red phase prompt", () => {
		expect(getNudgePrompt("red", config)).toContain("RED");
	});

	it("includes GREEN keyword in green phase prompt", () => {
		expect(getNudgePrompt("green", config)).toContain("GREEN");
	});

	it("includes REFACTOR keyword in refactor phase prompt", () => {
		expect(getNudgePrompt("refactor", config)).toContain("REFACTOR");
	});
});

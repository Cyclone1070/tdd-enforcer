import type { Config, Phase } from "../../engine/types.js";

export function getNudgePrompt(phase: Phase, config: Config): string {
	const redBlock = config.blockedInRed.join(", ");
	const greenBlock = config.blockedInGreen.join(", ");

	switch (phase) {
		case "red":
			return (
				`You are now in **RED** phase. Write failing tests.\n` +
				`Blocked files: ${redBlock}\n` +
				"All other files are free to modify. Call `next_tdd_phase` to proceed to GREEN.\n" +
				"Think about what could go wrong and test for it — don't just verify the happy path, " +
				"cover unhappy paths and edge cases too. Keep cycles small so reverting is cheap."
			);
		case "green":
			return (
				`You are now in **GREEN** phase. Implement features.\n` +
				`Blocked files: ${greenBlock}\n` +
				"All other files are free to modify. Call `next_tdd_phase` to proceed to REFACTOR.\n" +
				"Write minimal code to make the failing tests pass — nothing more.\n" +
				"If the RED phase tests were wrong, call `previous_tdd_phase` to go back and fix them."
			);
		case "refactor":
			return (
				"You are now in **REFACTOR** phase. Both test and implementation files are free to modify. " +
				"Refactor without changing behavior. Call `next_tdd_phase` to start a new RED cycle."
			);
		default:
			return "";
	}
}

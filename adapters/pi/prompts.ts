import type { Phase, Config } from "../../engine/types.js";

export function getNudgePrompt(phase: Phase, config: Config, matchedFiles?: string[]): string {
  const redPatterns = (matchedFiles ?? config.allowedRedPhaseFiles).join(", ");
  const greenPatterns = config.allowedGreenPhaseFiles.join(", ");

  switch (phase) {
    case "red":
      return (
        `You are now in **RED** phase. Write failing tests matching: ${redPatterns}\n` +
        "Only these files can be modified. Once tests fail, call `next_tdd_phase` to proceed to GREEN."
      );
    case "green":
      return (
        `You are now in **GREEN** phase. Test files (${redPatterns}) are locked.\n` +
        `Implement features matching: ${greenPatterns}\n` +
        "Call `next_tdd_phase` to proceed to REFACTOR."
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



import type { Phase, Config } from "../../engine/types.js";

function listMatched(files: string[]): string {
  if (files.length === 0) return "";
  return "\nMatched files: " + files.join(", ");
}

export function getNudgePrompt(phase: Phase, config: Config, matchedFiles?: string[]): string {
  switch (phase) {
    case "red":
      return (
        "You are now in **RED** phase. Write failing tests matching `allowedRedPhaseFiles` patterns. " +
        "Only these files can be modified. Once tests fail, call `next_tdd_phase` to proceed to GREEN." +
        listMatched(matchedFiles ?? config.allowedRedPhaseFiles)
      );
    case "green":
      return (
        "You are now in **GREEN** phase. Files matching `allowedRedPhaseFiles` are locked. " +
        "Implement features in `allowedGreenPhaseFiles` to make tests pass. " +
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

export function buildPhasePrompt(phase: Phase, config: Config): string {
  const redPatterns = config.allowedRedPhaseFiles.join(", ") || "(none)";
  const greenPatterns = config.allowedGreenPhaseFiles.join(", ") || "(none)";

  let allowed: string;
  let locked: string;

  switch (phase) {
    case "red":
      allowed = `Test files (${redPatterns})`;
      locked = `Implementation files (${greenPatterns})`;
      break;
    case "green":
      allowed = `Implementation files (${greenPatterns})`;
      locked = `Test files (${redPatterns})`;
      break;
    case "refactor":
      return (
        "**TDD phase: REFACTOR** — All files are free to modify. " +
        "Do not change behavior. When done, call `next_tdd_phase`."
      );
    default:
      return "";
  }

  return (
    `**TDD phase: ${phase.toUpperCase()}**\n` +
    `- Allowed: ${allowed}\n` +
    `- Locked: ${locked}\n` +
    "Files not matching either pattern are free to modify.\n" +
    "Call `next_tdd_phase` to advance the cycle."
  );
}

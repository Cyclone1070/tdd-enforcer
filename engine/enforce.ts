import picomatch from "picomatch";
import type { Phase, Config } from "./types.js";

/**
 * Check if a file path is allowed to be modified in the current phase.
 *
 * Rules:
 * - REFACTOR: everything allowed
 * - RED: files matching allowedRedPhaseFiles + free files (match neither set)
 * - GREEN: files matching allowedGreenPhaseFiles + free files
 * - Free files (matching neither glob set) are always allowed in all phases
 */
export function isAllowed(filePath: string, phase: Phase, config: Config): boolean {
  if (phase === "refactor") return true;

  const matchesRed = config.allowedRedPhaseFiles.some((p) => picomatch(p)(filePath));
  const matchesGreen = config.allowedGreenPhaseFiles.some((p) => picomatch(p)(filePath));

  if (phase === "red") return matchesRed || (!matchesRed && !matchesGreen);
  if (phase === "green") return matchesGreen || (!matchesRed && !matchesGreen);

  return true;
}

/**
 * Filter a list of file paths to those that are disallowed in the current phase.
 */
export function disallowedFiles(files: string[], phase: Phase, config: Config): string[] {
  if (phase === "refactor") return [];
  return files.filter((f) => !isAllowed(f, phase, config));
}

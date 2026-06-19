import picomatch from "picomatch";
import type { Phase, Config } from "./types.js";

/**
 * Match a file path against a list of glob patterns with !exclusion support.
 *
 * Positive patterns (no ! prefix) include a file in the match.
 * Negative patterns (! prefix) exclude a file from the match.
 * A file matches if it matches any positive pattern AND no negative pattern.
 * Empty pattern list = no match.
 */
function matchPatterns(patterns: string[], filePath: string): boolean {
  const positive: string[] = [];
  const negative: string[] = [];

  for (const p of patterns) {
    if (p.startsWith("!")) {
      negative.push(p.slice(1));
    } else {
      positive.push(p);
    }
  }

  if (positive.length === 0) return false;

  const matchesPositive = positive.some((p) => picomatch(p)(filePath));
  if (!matchesPositive) return false;

  const matchesNegative = negative.some((p) => picomatch(p)(filePath));
  return !matchesNegative;
}

/**
 * Check if a file path is allowed to be modified in the current phase.
 *
 * Rules:
 * - REFACTOR: everything allowed
 * - RED: files in blockedInRed are blocked, everything else is free
 * - GREEN: files in blockedInGreen are blocked, everything else is free
 * - ! negation patterns exclude subsets from a block list
 */
export function isAllowed(filePath: string, phase: Phase, config: Config): boolean {
  if (phase === "refactor") return true;

  const blocked = phase === "red" ? config.blockedInRed : config.blockedInGreen;
  return !matchPatterns(blocked, filePath);
}

/**
 * Filter a list of file paths to those that are disallowed in the current phase.
 */
export function disallowedFiles(files: string[], phase: Phase, config: Config): string[] {
  if (phase === "refactor") return [];
  return files.filter((f) => !isAllowed(f, phase, config));
}

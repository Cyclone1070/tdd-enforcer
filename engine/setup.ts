import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initGit } from "./git.js";

const VALID_PHASES = new Set(["red", "green", "refactor"]);

/**
 * Check if TDD setup is complete and valid.
 * - .pi/tdd/ must exist
 * - rules.json must exist with required arrays
 * - phase.json must exist with a recognised current phase and enabled===true
 * - If .git is missing, auto-init it
 *
 * Returns true only when enforcement can proceed safely.
 */
export function ensureReady(projectRoot: string): boolean {
  const tddDir = join(projectRoot, ".pi", "tdd");
  if (!existsSync(tddDir)) return false;

  // Validate rules.json — must have the three required arrays
  const rulesPath = join(tddDir, "rules.json");
  if (!existsSync(rulesPath)) return false;

  let rules: Record<string, unknown>;
  try {
    rules = JSON.parse(readFileSync(rulesPath, "utf-8"));
  } catch {
    return false;
  }

  if (!Array.isArray(rules.allowedRedPhaseFiles)) return false;
  if (!Array.isArray(rules.allowedGreenPhaseFiles)) return false;
  if (!Array.isArray(rules.testCommands)) return false;

  // Validate phase.json — must have a recognised current and be enabled
  const phasePath = join(tddDir, "phase.json");
  if (!existsSync(phasePath)) return false;

  let phase: Record<string, unknown>;
  try {
    phase = JSON.parse(readFileSync(phasePath, "utf-8"));
  } catch {
    return false;
  }

  if (phase.enabled !== true) return false;
  if (typeof phase.current !== "string" || !VALID_PHASES.has(phase.current)) return false;

  // Heal git if missing — caller will run enforcement after this
  const gitDir = join(tddDir, ".git");
  if (!existsSync(gitDir)) {
    try {
      initGit(projectRoot);
    } catch {
      return false;
    }
  }

  return true;
}

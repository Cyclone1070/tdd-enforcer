import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { PhaseState } from "./types.js";

const TDD_DIR = ".pi/tdd";
const VALID_PHASES = new Set(["red", "green", "refactor"]);

export function phaseStatePath(projectRoot: string): string {
  return join(projectRoot, TDD_DIR, "phase.json");
}

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadPhaseState(projectRoot: string): PhaseState {
  const path = phaseStatePath(projectRoot);
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as PhaseState;

  if (typeof parsed.current !== "string" || !VALID_PHASES.has(parsed.current)) {
    throw new Error(`phase.json: invalid phase "${String(parsed.current)}". Must be red, green, or refactor.`);
  }

  return {
    enabled: parsed.enabled === true,
    current: parsed.current,
  };
}

export function savePhaseState(projectRoot: string, state: PhaseState): void {
  const path = phaseStatePath(projectRoot);
  ensureDir(path);
  writeFileSync(path, JSON.stringify(state, null, 2), "utf-8");
}

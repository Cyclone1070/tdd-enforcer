import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { PhaseState } from "./types.js";

const TDD_DIR = ".pi/tdd";

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
  if (!existsSync(path)) {
    return { enabled: false, current: "red" };
  }

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as PhaseState;
    // Migrate old format (current: "off") to new format
    if ((parsed as any).current === "off") {
      return { enabled: false, current: "red" };
    }
    return parsed;
  } catch {
    return { enabled: false, current: "red" };
  }
}

export function savePhaseState(projectRoot: string, state: PhaseState): void {
  const path = phaseStatePath(projectRoot);
  ensureDir(path);
  writeFileSync(path, JSON.stringify(state, null, 2), "utf-8");
}

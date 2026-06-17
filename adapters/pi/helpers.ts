import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadPhaseState, savePhaseState, loadConfig, headMessage, nextPhase, initGit } from "../../engine/index.js";
import type { PhaseState, Config, Phase } from "../../engine/types.js";

export type TddLoadResult =
  | { ok: true; state: PhaseState; config: Config }
  | { ok: false; reason: string };

/**
 * Recover state.json from private git HEAD, or create default.
 * Returns the state (does not save to disk — caller does that).
 */
function recoverState(root: string, tddDir: string): PhaseState {
  const gitDir = join(tddDir, ".git");
  if (existsSync(gitDir)) {
    try {
      const msg = headMessage(root);
      const m = msg.match(/^tdd: (red|green|refactor|init)$/);
      if (m) {
        const headPhase = m[1] as Phase;
        if (headPhase === "init") {
          return { enabled: false, current: "red" };
        }
        const next = nextPhase(headPhase);
        return { enabled: true, current: next ?? "red" };
      }
    } catch {
      // No commits or bad HEAD — fall through to default
    }
  }
  return { enabled: false, current: "red" };
}

/**
 * Load TDD state + config in one go.
 * Auto-creates state.json from private git HEAD when missing or corrupted.
 * Returns ok:true with state and config when rules.json is valid.
 * Returns ok:false with a specific reason string otherwise.
 *
 * Callers must check state.enabled themselves if they need active enforcement.
 */
export function loadTddState(root: string): TddLoadResult {
  const tddDir = join(root, ".pi", "tdd");
  if (!existsSync(tddDir)) {
    return { ok: false, reason: "Missing .pi/tdd/ directory. See the tdd-enforcer skill to learn how to set up TDD configs." };
  }

  const rulesPath = join(tddDir, "rules.json");
  if (!existsSync(rulesPath)) {
    return { ok: false, reason: "Missing .pi/tdd/rules.json. See the tdd-enforcer skill to learn how to set up TDD configs." };
  }

  let config: Config;
  try {
    config = loadConfig(root);
  } catch (e) {
    return { ok: false, reason: `Invalid .pi/tdd/rules.json: ${(e as Error).message}. See the tdd-enforcer skill.` };
  }

  // Init git if missing — required for state recovery and all consumers
  const gitDir = join(tddDir, ".git");
  if (!existsSync(gitDir)) {
    try {
      initGit(root);
    } catch (e) {
      return { ok: false, reason: `Failed to initialise private git repo: ${(e as Error).message}` };
    }
  }

  // Auto-create state.json if missing or corrupted
  const phasePath = join(tddDir, "state.json");
  let state: PhaseState | undefined;
  if (existsSync(phasePath)) {
    try {
      state = loadPhaseState(root);
    } catch {
      // Corrupted — recover below
    }
  }
  if (!state) {
    state = recoverState(root, tddDir);
    savePhaseState(root, state);
  }

  return { ok: true, state, config };
}

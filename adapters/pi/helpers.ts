import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadPhaseState, loadConfig, initGit } from "../../engine/index.js";
import type { PhaseState, Config } from "../../engine/types.js";

export type TddLoadResult =
  | { ok: true; state: PhaseState; config: Config }
  | { ok: false; reason: string };

/**
 * Load TDD state + config in one go.
 * Returns ok:true with state and config when everything is valid and ready.
 * Returns ok:false with a specific reason string otherwise.
 */
export function loadTddState(root: string): TddLoadResult {
  const tddDir = join(root, ".pi", "tdd");
  if (!existsSync(tddDir)) {
    return { ok: false, reason: "Missing .pi/tdd/ directory. See the tdd-init skill to learn how to set up TDD configs." };
  }

  const rulesPath = join(tddDir, "rules.json");
  if (!existsSync(rulesPath)) {
    return { ok: false, reason: "Missing .pi/tdd/rules.json. See the tdd-init skill to learn how to set up TDD configs." };
  }

  const phasePath = join(tddDir, "state.json");
  if (!existsSync(phasePath)) {
    return { ok: false, reason: "Missing .pi/tdd/state.json. See the tdd-init skill to learn how to set up TDD configs." };
  }

  let state: PhaseState;
  try {
    state = loadPhaseState(root);
  } catch (e) {
    return { ok: false, reason: `Invalid .pi/tdd/state.json: ${(e as Error).message}` };
  }

  let config: Config;
  try {
    config = loadConfig(root);
  } catch (e) {
    return { ok: false, reason: `Invalid .pi/tdd/rules.json: ${(e as Error).message}` };
  }

  if (!state.enabled) {
    return { ok: false, reason: "TDD is not enabled. Run /tdd:on to enable it." };
  }

  // Heal git if missing
  const gitDir = join(tddDir, ".git");
  if (!existsSync(gitDir)) {
    try {
      initGit(root);
    } catch (e) {
      return { ok: false, reason: `Failed to initialise private git repo: ${(e as Error).message}` };
    }
  }

  return { ok: true, state, config };
}

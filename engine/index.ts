export { isAllowed, disallowedFiles } from "./enforce.js";
export { initGit, snapshot, changesSinceSnapshot, modifiedFiles, untrackedFiles, restoreFiles, headHash, hasParent, resetHard, undoLastCommit } from "./git.js";
export { ensureReady } from "./setup.js";
export { loadConfig } from "./config.js";
export { loadPhaseState, savePhaseState } from "./state.js";
export { nextPhase, checkGate, getDisallowedChanges } from "./transition.js";
export type { Phase, PhaseState, Config, Transition, GateResult, TestRunner } from "./types.js";

export { loadConfig } from "./config.js";
export { disallowedFiles, isAllowed } from "./enforce.js";
export {
	changesSince,
	changesSinceSnapshot,
	gitStashCreate,
	hasParent,
	headHash,
	headMessage,
	initGit,
	modifiedFiles,
	resetGit,
	resetHard,
	restoreFilesTo,
	snapshot,
	stageFiles,
	undoLastCommit,
	untrackedFiles,
} from "./git.js";
export { loadPhaseState, savePhaseState } from "./state.js";
export { checkGate, getDisallowedChanges, nextPhase } from "./transition.js";
export type {
	Config,
	GateResult,
	Phase,
	PhaseState,
	TestRunner,
	Transition,
} from "./types.js";

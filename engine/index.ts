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
export { tddLog } from "./log.js";
export type { AdvanceResult } from "./orchestrate.js";
export { advancePhase, getStatusInfo, revertPhase } from "./orchestrate.js";
export type { TddLayout } from "./paths.js";
export {
	GITIGNORE_FILE,
	isTddPath,
	LEGACY_TDD_DIR,
	LOCKED_DIRS,
	LOG_FILE,
	legacyDirWarning,
	lockedDirFor,
	RULES_FILE,
	resolveTddDir,
	resolveTddLayout,
	STATE_FILE,
	TDD_DIR,
	tddPath,
} from "./paths.js";
export { getNudgePrompt } from "./prompts.js";
export type { TddLoadResult } from "./state.js";
export { loadPhaseState, loadTddState, savePhaseState } from "./state.js";
export { checkGate, getDisallowedChanges, nextPhase } from "./transition.js";
export type {
	Config,
	GateResult,
	Phase,
	PhaseState,
	TestRunner,
	Transition,
} from "./types.js";
export { isPhase, parseTddLabel } from "./types.js";

import {
	hasParent as realHasParent,
	headMessage as realHeadMessage,
	resetGit as realResetGit,
	resetHard as realResetHard,
	snapshot as realSnapshot,
	stageFiles as realStageFiles,
	undoLastCommit as realUndoLastCommit,
} from "./git.js";
import { resolveTddDir } from "./paths.js";
import {
	savePhaseState as realSavePhaseState,
	repairHistory,
} from "./state.js";
import {
	checkGate as realCheckGate,
	getDisallowedChanges as realGetDisallowedChanges,
	nextPhase as realNextPhase,
} from "./transition.js";
import type { Config, Phase, PhaseState } from "./types.js";
import { parseTddLabel } from "./types.js";

export interface AdvanceResult {
	ok: boolean;
	message: string;
	newState?: PhaseState;
}

export interface AdvanceDeps {
	nextPhase?: typeof realNextPhase;
	getDisallowedChanges?: typeof realGetDisallowedChanges;
	checkGate?: typeof realCheckGate;
	snapshot?: typeof realSnapshot;
	savePhaseState?: typeof realSavePhaseState;
}

export interface RevertDeps {
	hasParent?: typeof realHasParent;
	headMessage?: typeof realHeadMessage;
	resetHard?: typeof realResetHard;
	undoLastCommit?: typeof realUndoLastCommit;
	savePhaseState?: typeof realSavePhaseState;
	resetGit?: typeof realResetGit;
	snapshot?: typeof realSnapshot;
	stageFiles?: typeof realStageFiles;
}

/**
 * Advance to the next phase in the RED→GREEN cycle.
 * Runs allowlist check and transition gate before advancing.
 * Returns a result object — caller (adapter) handles logging and formatting.
 */
export async function advancePhase(
	root: string,
	state: PhaseState,
	config: Config,
	deps: AdvanceDeps & {
		testRunner: (
			commands: string[],
			timeoutSeconds: number,
		) => Promise<{ passed: boolean; message: string }>;
	},
): Promise<AdvanceResult> {
	const np = deps.nextPhase ?? realNextPhase;
	const gdc = deps.getDisallowedChanges ?? realGetDisallowedChanges;
	const cg = deps.checkGate ?? realCheckGate;
	const snap = deps.snapshot ?? realSnapshot;
	const sps = deps.savePhaseState ?? realSavePhaseState;

	const from = state.current;
	const to = np(from) as Phase;

	// 1. Allowlist check
	const violations = gdc(root, from, config);
	if (violations.length > 0) {
		return {
			ok: false,
			message:
				`BLOCKED: files not allowed in ${from.toUpperCase()} phase:\n` +
				violations.map((f) => `  - ${f}`).join("\n") +
				`\nRevert or remove them before proceeding.\n\nInspect with: cd ${resolveTddDir(root)} && git diff HEAD -- ${violations[0]}`,
		};
	}

	// 2. Gate check
	const gate = await cg(from, to, deps.testRunner, config);
	if (!gate.passed) {
		return { ok: false, message: gate.message };
	}

	// 3. Snapshot
	snap(root, from);

	// 4. Save state
	const newState: PhaseState = { ...state, current: to };
	sps(root, newState);

	return { ok: true, message: "", newState };
}

/**
 * Revert to the previous phase using the private git snapshot log.
 * Untrustworthy history is nuked and replaced with a clean RED baseline.
 * Returns a result object — caller (adapter) handles logging and formatting.
 */
export async function revertPhase(
	root: string,
	state: PhaseState,
	deps?: RevertDeps,
): Promise<AdvanceResult> {
	const hp = deps?.hasParent ?? realHasParent;
	const hm = deps?.headMessage ?? realHeadMessage;
	const rh = deps?.resetHard ?? realResetHard;
	const ulc = deps?.undoLastCommit ?? realUndoLastCommit;
	const sps = deps?.savePhaseState ?? realSavePhaseState;
	const rg = deps?.resetGit ?? realResetGit;
	const snap = deps?.snapshot ?? realSnapshot;
	const stf = deps?.stageFiles ?? realStageFiles;

	const repair = (): AdvanceResult => ({
		ok: true,
		message: "Private git history was corrupt — reset to a clean RED baseline.",
		newState: repairHistory(root, state.enabled, {
			resetGit: rg,
			snapshot: snap,
			savePhaseState: sps,
			stageFiles: stf,
		}),
	});

	let headMsg: string;
	try {
		headMsg = hm(root);
	} catch {
		// Broken git — there is no history to roll back to, so start clean.
		return repair();
	}

	if (!hp(root)) {
		return { ok: false, message: "No previous phase to revert to." };
	}

	const label = parseTddLabel(headMsg);
	if (!label) return repair();

	// Nuke uncommitted changes
	rh(root);

	// Pop last snapshot
	ulc(root);

	// Update phase
	const newState: PhaseState = { ...state, current: label };
	sps(root, newState);

	return {
		ok: true,
		message: `Reverted to ${label.toUpperCase()}.`,
		newState,
	};
}

/**
 * Get a human-readable status string from current state and config.
 */
export function getStatusInfo(state: PhaseState, config: Config): string {
	const enabledStr = state.enabled ? "enabled" : "disabled";
	const phaseStr = state.current.toUpperCase();
	const redBlk = config.blockedInRed.join(", ") || "(none)";
	const greenBlk = config.blockedInGreen.join(", ") || "(none)";
	const commands = config.testCommands.join(", ") || "(none)";

	return (
		`TDD enforcer ${enabledStr}\n` +
		`Current phase: ${phaseStr}\n` +
		`Blocked in RED: ${redBlk}\n` +
		`Blocked in GREEN: ${greenBlk}\n` +
		`Test commands: ${commands}`
	);
}

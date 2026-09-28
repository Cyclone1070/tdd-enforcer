import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadConfig } from "./config.js";
import {
	hasParent,
	headMessage,
	initGit,
	resetGit,
	snapshot,
	stageFiles,
} from "./git.js";
import {
	legacyDirWarning,
	RULES_FILE,
	resolveTddDir,
	resolveTddLayout,
	STATE_FILE,
	tddPath,
} from "./paths.js";
import { nextPhase } from "./transition.js";
import type { Config, Phase, PhaseState } from "./types.js";
import { isPhase, parseTddLabel } from "./types.js";

export type TddLoadResult =
	| {
			ok: true;
			state: PhaseState;
			config: Config;
			repaired?: string;
			/** Set when both `.tdd/` and `.pi/tdd/` exist; `.tdd/` wins. */
			warning?: string;
	  }
	| { ok: false; reason: string };

export function phaseStatePath(projectRoot: string): string {
	return tddPath(projectRoot, STATE_FILE);
}

function ensureDir(path: string): void {
	const dir = dirname(path);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/** Fields read from state.json, normalised so callers never validate. */
export interface ParsedPhaseState {
	/** Parsed phase, or null when the file is missing, malformed, or invalid. */
	current: Phase | null;
	/** true only when the file contains a literal boolean true. */
	enabled: boolean;
}

/**
 * Read state.json without throwing. Missing files, malformed JSON, and invalid
 * fields all normalise — callers fall back to private-git recovery.
 */
export function loadPhaseState(projectRoot: string): ParsedPhaseState {
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(phaseStatePath(projectRoot), "utf-8"));
	} catch {
		return { current: null, enabled: false };
	}
	if (typeof raw !== "object" || raw === null) {
		return { current: null, enabled: false };
	}
	const parsed = raw as { current?: unknown; enabled?: unknown };
	return {
		current: isPhase(parsed.current) ? parsed.current : null,
		enabled: parsed.enabled === true,
	};
}

export function savePhaseState(projectRoot: string, state: PhaseState): void {
	const path = phaseStatePath(projectRoot);
	ensureDir(path);
	writeFileSync(path, JSON.stringify(state, null, 2), "utf-8");
}

type GitProbe =
	| { kind: "baseline" }
	| { kind: "phase"; phase: Phase }
	| { kind: "unusable"; reason: string };

/**
 * Inspect the private git repo.
 * - baseline: repo is healthy but has only the initial commit
 * - phase: HEAD is a TDD snapshot carrying a valid phase label
 * - unusable: git threw, or HEAD is not a TDD snapshot
 */
function probeGit(
	root: string,
	deps: { headMessage: typeof headMessage; hasParent: typeof hasParent },
): GitProbe {
	let message: string;
	try {
		message = deps.headMessage(root);
	} catch (e) {
		return { kind: "unusable", reason: (e as Error).message };
	}
	if (!deps.hasParent(root)) return { kind: "baseline" };

	const phase = parseTddLabel(message);
	if (!phase) {
		return {
			kind: "unusable",
			reason: `HEAD commit "${message}" is not a TDD snapshot.`,
		};
	}
	return { kind: "phase", phase };
}

/** Nuke untrustworthy history and leave a clean RED baseline behind. */
export function repairHistory(
	root: string,
	enabled: boolean,
	deps: {
		resetGit: typeof resetGit;
		snapshot: typeof snapshot;
		savePhaseState: typeof savePhaseState;
		stageFiles: typeof stageFiles;
	},
): PhaseState {
	deps.resetGit(root);
	deps.snapshot(root, "red");
	const state: PhaseState = { enabled, current: "red" };
	deps.savePhaseState(root, state);
	deps.stageFiles(root, [`${resolveTddDir(root)}/${STATE_FILE}`]);
	return state;
}

/**
 * Load TDD state + config in one go.
 *
 * Resolution order:
 * 1. An unusable private git repo is repaired by nuking it and snapshotting RED.
 * 2. A valid state.json phase wins.
 * 3. Otherwise the phase is recovered from the private git history.
 *
 * Returns ok:true with state and config when rules.json is valid.
 * Returns ok:false with a specific reason string otherwise.
 *
 * Callers must check state.enabled themselves if they need active enforcement.
 */
export function loadTddState(
	root: string,
	deps: {
		existsSync: typeof existsSync;
		loadConfig: typeof loadConfig;
		initGit: typeof initGit;
		loadPhaseState: typeof loadPhaseState;
		savePhaseState: typeof savePhaseState;
		headMessage: typeof headMessage;
		hasParent: typeof hasParent;
		resetGit: typeof resetGit;
		snapshot: typeof snapshot;
		stageFiles: typeof stageFiles;
	} = {
		existsSync,
		loadConfig,
		initGit,
		loadPhaseState,
		savePhaseState,
		headMessage,
		hasParent,
		resetGit,
		snapshot,
		stageFiles,
	},
): TddLoadResult {
	const layout = resolveTddLayout(root, deps);
	const warning = legacyDirWarning(layout);
	const tddDir = join(root, layout.dir);
	if (!deps.existsSync(tddDir)) {
		return {
			ok: false,
			reason: `Missing ${layout.dir}/ directory. See the tdd-enforcer skill to learn how to set up TDD configs.`,
		};
	}

	const rulesPath = join(tddDir, RULES_FILE);
	if (!deps.existsSync(rulesPath)) {
		return {
			ok: false,
			reason: `Missing ${layout.dir}/${RULES_FILE}. See the tdd-enforcer skill to learn how to set up TDD configs.`,
		};
	}

	let config: Config;
	try {
		config = deps.loadConfig(root);
	} catch (e) {
		return {
			ok: false,
			reason: `Invalid ${layout.dir}/${RULES_FILE}: ${(e as Error).message}. See the tdd-enforcer skill.`,
		};
	}

	// Init git if missing — required for state recovery and all consumers
	const gitDir = join(tddDir, ".git");
	if (!deps.existsSync(gitDir)) {
		try {
			deps.initGit(root);
		} catch (e) {
			return {
				ok: false,
				reason: `Failed to initialise private git repo: ${(e as Error).message}`,
			};
		}
	}

	const fileState = deps.loadPhaseState(root);

	// Broken or unrecognisable history is never trusted — nuke and start clean.
	const probe = probeGit(root, {
		headMessage: deps.headMessage,
		hasParent: deps.hasParent,
	});
	if (probe.kind === "unusable") {
		const state = repairHistory(root, fileState.enabled, deps);
		return { ok: true, state, config, repaired: probe.reason, warning };
	}

	// A valid state.json phase is authoritative.
	if (fileState.current) {
		return {
			ok: true,
			state: { enabled: fileState.enabled, current: fileState.current },
			config,
			warning,
		};
	}

	// No usable state.json — rebuild it from the private git history.
	const state: PhaseState =
		probe.kind === "baseline"
			? { enabled: false, current: "red" }
			: { enabled: true, current: nextPhase(probe.phase) ?? "red" };
	deps.savePhaseState(root, state);
	deps.stageFiles(root, [`${layout.dir}/${STATE_FILE}`]);
	return { ok: true, state, config, warning };
}

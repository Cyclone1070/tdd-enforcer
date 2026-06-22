import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadConfig } from "./config.js";
import { headMessage, initGit, stageFiles } from "./git.js";
import { nextPhase } from "./transition.js";
import type { Config, PhaseState } from "./types.js";

const TDD_DIR = ".pi/tdd";
const VALID_PHASES = new Set(["red", "green", "refactor"]);

export type TddLoadResult =
	| { ok: true; state: PhaseState; config: Config }
	| { ok: false; reason: string };

export function phaseStatePath(projectRoot: string): string {
	return join(projectRoot, TDD_DIR, "state.json");
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
		throw new Error(
			`state.json: invalid phase "${String(parsed.current)}". Must be red, green, or refactor.`,
		);
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

/**
 * Recover state.json from private git HEAD, or create default.
 * Returns the state (does not save to disk — caller does that).
 */
function recoverState(
	root: string,
	tddDir: string,
	deps: {
		existsSync: typeof existsSync;
		headMessage: typeof headMessage;
		nextPhase: typeof nextPhase;
	} = { existsSync, headMessage, nextPhase },
): PhaseState {
	const gitDir = join(tddDir, ".git");
	if (deps.existsSync(gitDir)) {
		try {
			const msg = deps.headMessage(root);
			const m = msg.match(/^tdd: (red|green|refactor|init)$/);
			if (m) {
				const label = m[1];
				if (label === "init") {
					return { enabled: false, current: "red" };
				}
				const next = deps.nextPhase(label);
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
export function loadTddState(
	root: string,
	deps: {
		existsSync: typeof existsSync;
		loadConfig: typeof loadConfig;
		initGit: typeof initGit;
		loadPhaseState: typeof loadPhaseState;
		savePhaseState: typeof savePhaseState;
		headMessage: typeof headMessage;
		nextPhase: typeof nextPhase;
		stageFiles: typeof stageFiles;
	} = {
		existsSync,
		loadConfig,
		initGit,
		loadPhaseState,
		savePhaseState,
		headMessage,
		nextPhase,
		stageFiles,
	},
): TddLoadResult {
	const tddDir = join(root, ".pi", "tdd");
	if (!deps.existsSync(tddDir)) {
		return {
			ok: false,
			reason:
				"Missing .pi/tdd/ directory. See the tdd-enforcer skill to learn how to set up TDD configs.",
		};
	}

	const rulesPath = join(tddDir, "rules.json");
	if (!deps.existsSync(rulesPath)) {
		return {
			ok: false,
			reason:
				"Missing .pi/tdd/rules.json. See the tdd-enforcer skill to learn how to set up TDD configs.",
		};
	}

	let config: Config;
	try {
		config = deps.loadConfig(root);
	} catch (e) {
		return {
			ok: false,
			reason: `Invalid .pi/tdd/rules.json: ${(e as Error).message}. See the tdd-enforcer skill.`,
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

	// Auto-create state.json if missing or corrupted
	const phasePath = join(tddDir, "state.json");
	let state: PhaseState | undefined;
	if (deps.existsSync(phasePath)) {
		try {
			state = deps.loadPhaseState(root);
		} catch {
			// Corrupted — recover below
		}
	}
	if (!state) {
		state = recoverState(root, tddDir, {
			existsSync: deps.existsSync,
			headMessage: deps.headMessage,
			nextPhase: deps.nextPhase,
		});
		deps.savePhaseState(root, state);
		deps.stageFiles(root, [".pi/tdd/state.json"]);
	}

	return { ok: true, state, config };
}

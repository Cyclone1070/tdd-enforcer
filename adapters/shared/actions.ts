/**
 * Adapter-neutral TDD actions shared by the pi and DSH adapters.
 *
 * Everything here takes a project root and a plain `AbortSignal` instead of an
 * agent-framework context, so both adapters delegate to one implementation.
 */

import { exec } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Phase, TestRunner } from "../../engine/index.js";
import {
	advancePhase,
	checkGate,
	getDisallowedChanges,
	getNudgePrompt,
	getStatusInfo,
	hasParent,
	headMessage,
	loadTddState,
	nextPhase,
	resetGit,
	resetHard,
	resolveTddDir,
	revertPhase,
	savePhaseState,
	snapshot,
	stageFiles,
	tddLog,
	undoLastCommit,
} from "../../engine/index.js";

const asyncExec = promisify(exec);

/** Text a host with slash commands can point the model at. */
export interface ActionHints {
	/** Sentence naming the command that enables TDD. */
	enableHint: string;
}

/** pi uses `:` in command names; DSH forbids it. */
export const PI_HINTS: ActionHints = {
	enableHint: "Run /tdd:on to enable it.",
};

/** DSH command-name grammar is `/^[a-z][a-z0-9_-]*$/u`. */
export const DSH_HINTS: ActionHints = {
	enableHint: "Run /tdd-on to enable it.",
};

export interface NextPhaseDeps {
	loadTddState: typeof loadTddState;
	nextPhase: typeof nextPhase;
	getDisallowedChanges: typeof getDisallowedChanges;
	checkGate: typeof checkGate;
	snapshot: typeof snapshot;
	savePhaseState: typeof savePhaseState;
	getNudgePrompt: typeof getNudgePrompt;
	asyncExec: (
		command: string,
		options?: { cwd?: string; timeout?: number; signal?: AbortSignal },
	) => Promise<{ stdout: string; stderr: string }>;
	tddLog: typeof tddLog;
}

export interface PreviousPhaseDeps {
	loadTddState: typeof loadTddState;
	hasParent: typeof hasParent;
	headMessage: typeof headMessage;
	resetHard: typeof resetHard;
	undoLastCommit: typeof undoLastCommit;
	savePhaseState: typeof savePhaseState;
	resetGit: typeof resetGit;
	snapshot: typeof snapshot;
	stageFiles: typeof stageFiles;
	tddLog: typeof tddLog;
}

export interface TddStatusDeps {
	loadTddState: typeof loadTddState;
	tddLog: typeof tddLog;
}

export const defaultNextPhaseDeps: NextPhaseDeps = {
	loadTddState,
	nextPhase,
	getDisallowedChanges,
	checkGate,
	snapshot,
	savePhaseState,
	getNudgePrompt,
	asyncExec,
	tddLog,
};

export const defaultPreviousPhaseDeps: PreviousPhaseDeps = {
	loadTddState,
	hasParent,
	headMessage,
	resetHard,
	undoLastCommit,
	savePhaseState,
	resetGit,
	snapshot,
	stageFiles,
	tddLog,
};

export const defaultTddStatusDeps: TddStatusDeps = {
	loadTddState,
	tddLog,
};

export interface ActionOutput {
	content: Array<{ type: string; text: string }>;
	details?: Record<string, unknown>;
}

export async function runNextPhase(
	root: string,
	signal: AbortSignal | undefined,
	deps: NextPhaseDeps = defaultNextPhaseDeps,
	hints: ActionHints = PI_HINTS,
): Promise<ActionOutput> {
	const tddDir = join(root, resolveTddDir(root));
	const tdd = deps.loadTddState(root);
	if (!tdd.ok) {
		deps.tddLog(tddDir, "WARN", "next_tdd_phase: TDD not active", {
			reason: tdd.reason,
		});
		throw new Error(`TDD: ${tdd.reason}`);
	}
	if (!tdd.state.enabled) {
		deps.tddLog(tddDir, "WARN", "next_tdd_phase: TDD disabled");
		throw new Error(`TDD is not enabled. ${hints.enableHint}`);
	}

	const { state, config } = tdd;
	const repairNote = tdd.repaired
		? `NOTE: private git history was corrupt and has been reset (${tdd.repaired})\n`
		: "";
	if (tdd.repaired) {
		deps.tddLog(tddDir, "WARN", "next_tdd_phase: git history repaired", {
			reason: tdd.repaired,
		});
	}
	const from = state.current;
	const to = deps.nextPhase(from) as Phase;

	deps.tddLog(tddDir, "INFO", "next_tdd_phase: starting", { from, to });

	const testRunner: TestRunner = async (commands, timeout) => {
		const results = await Promise.all(
			commands.map(async (cmd) => {
				try {
					await deps.asyncExec(cmd, {
						cwd: root,
						timeout: timeout * 1000,
						signal,
					});
					return { command: cmd, passed: true, timedOut: false } as const;
				} catch (err) {
					const killed = (err as any)?.killed === true;
					const cancelled = signal?.aborted === true;
					const timedOut = killed && !cancelled;
					return {
						command: cmd,
						passed: false,
						timedOut,
						cancelled,
					} as const;
				}
			}),
		);

		const cancelled = results.filter((r) => (r as any).cancelled === true);
		const timedOut = results.filter((r) => r.timedOut);
		const failed = results.filter(
			(r) => !r.passed && !r.timedOut && !(r as any).cancelled,
		);

		if (cancelled.length > 0) {
			return {
				passed: false,
				cancelled: true,
				message: `\nTest execution was cancelled.\n${cancelled.map((f) => `  - ${f.command}`).join("\n")}`,
			};
		}

		if (timedOut.length > 0) {
			return {
				passed: false,
				timeout: true,
				message: `Tests timed out after ${timeout}s:\n${timedOut.map((f) => `  - ${f.command}`).join("\n")}`,
			};
		}

		if (failed.length > 0) {
			return {
				passed: false,
				message: `Tests failed:\n${failed.map((f) => `  - ${f.command}`).join("\n")}`,
			};
		}
		return { passed: true, message: "All tests passed." };
	};

	const result = await advancePhase(root, state, config, {
		nextPhase: deps.nextPhase,
		getDisallowedChanges: deps.getDisallowedChanges,
		checkGate: deps.checkGate,
		snapshot: deps.snapshot,
		savePhaseState: deps.savePhaseState,
		testRunner,
	});

	if (!result.ok) {
		deps.tddLog(tddDir, "WARN", "next_tdd_phase: blocked by allowlist", {
			from,
			violations: result.message,
		});
		throw new Error(result.message);
	}

	deps.tddLog(tddDir, "INFO", "next_tdd_phase: complete", {
		from,
		to,
	});

	return {
		content: [
			{
				type: "text",
				text: `${repairNote}\n${deps.getNudgePrompt(to, config)}`,
			},
		],
		details: {},
	};
}

export async function runPreviousPhase(
	root: string,
	deps: PreviousPhaseDeps = defaultPreviousPhaseDeps,
	hints: ActionHints = PI_HINTS,
): Promise<ActionOutput> {
	const tddDir = join(root, resolveTddDir(root));
	const tdd = deps.loadTddState(root);
	if (!tdd.ok) {
		deps.tddLog(tddDir, "WARN", "previous_tdd_phase: TDD not active", {
			reason: tdd.reason,
		});
		throw new Error(`TDD: ${tdd.reason}`);
	}
	if (!tdd.state.enabled) {
		deps.tddLog(tddDir, "WARN", "previous_tdd_phase: TDD disabled");
		throw new Error(`TDD is not enabled. ${hints.enableHint}`);
	}

	const { state } = tdd;
	const repairNote = tdd.repaired
		? ` NOTE: private git history was corrupt and has been reset (${tdd.repaired}).`
		: "";
	if (tdd.repaired) {
		deps.tddLog(tddDir, "WARN", "previous_tdd_phase: git history repaired", {
			reason: tdd.repaired,
		});
	}

	const result = await revertPhase(root, state, {
		hasParent: deps.hasParent,
		headMessage: deps.headMessage,
		resetHard: deps.resetHard,
		undoLastCommit: deps.undoLastCommit,
		savePhaseState: deps.savePhaseState,
		resetGit: deps.resetGit,
		snapshot: deps.snapshot,
		stageFiles: deps.stageFiles,
	});

	if (!result.ok) {
		throw new Error(result.message);
	}

	deps.tddLog(tddDir, "INFO", "previous_tdd_phase: complete", {
		from: state.current,
		to: result.newState?.current,
	});

	return {
		content: [
			{
				type: "text",
				text: `\n${result.message} Working tree has the previous snapshot content as unstaged changes.${repairNote}`,
			},
		],
		details: {},
	};
}

export async function runTddStatus(
	root: string,
	deps: TddStatusDeps = defaultTddStatusDeps,
): Promise<ActionOutput> {
	const tddDir = join(root, resolveTddDir(root));
	const result = deps.loadTddState(root);

	if (!result.ok) {
		deps.tddLog(tddDir, "WARN", "tdd_status: TDD not active", {
			reason: result.reason,
		});
		throw new Error(`TDD: ${result.reason}`);
	}
	const { state, config } = result;
	const info = getStatusInfo(state, config);
	const warningNote =
		result.warning !== undefined ? `\n\n⚠️ ${result.warning}` : "";

	deps.tddLog(tddDir, "INFO", "tdd_status: queried", {
		enabled: state.enabled,
		phase: state.current,
	});

	return {
		content: [{ type: "text", text: `\n${info}${warningNote}` }],
		details: {
			enabled: state.enabled,
			phase: state.current,
			blockedInRed: config.blockedInRed,
			blockedInGreen: config.blockedInGreen,
			testCommands: config.testCommands,
		},
	};
}

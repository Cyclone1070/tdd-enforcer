import { exec } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { Type } from "typebox";

const asyncExec = promisify(exec);

import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
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
	resetHard,
	revertPhase,
	savePhaseState,
	snapshot,
	tddLog,
	undoLastCommit,
} from "../../engine/index.js";

// ── De dependency types ─────────────────────────────────────────────────────

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
	tddLog: typeof tddLog;
}

export interface TddStatusDeps {
	loadTddState: typeof loadTddState;
	tddLog: typeof tddLog;
}

// ── Default deps ────────────────────────────────────────────────────────────

const defaultNextPhaseDeps: NextPhaseDeps = {
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

const defaultPreviousPhaseDeps: PreviousPhaseDeps = {
	loadTddState,
	hasParent,
	headMessage,
	resetHard,
	undoLastCommit,
	savePhaseState,
	tddLog,
};

const defaultTddStatusDeps: TddStatusDeps = {
	loadTddState,
	tddLog,
};

// ── executeNextPhase ────────────────────────────────────────────────────────

export async function executeNextPhase(
	ctx: ExtensionContext,
	deps: NextPhaseDeps = defaultNextPhaseDeps,
): Promise<{
	content: Array<{ type: string; text: string }>;
	details?: Record<string, unknown>;
}> {
	const root = ctx.cwd;
	const tddDir = join(root, ".pi", "tdd");
	const tdd = deps.loadTddState(root);
	if (!tdd.ok) {
		deps.tddLog(tddDir, "WARN", "next_tdd_phase: TDD not active", {
			reason: tdd.reason,
		});
		throw new Error(`TDD: ${tdd.reason}`);
	}
	if (!tdd.state.enabled) {
		deps.tddLog(tddDir, "WARN", "next_tdd_phase: TDD disabled");
		throw new Error("TDD is not enabled. Run /tdd:on to enable it.");
	}

	const { state, config } = tdd;
	const from = state.current;
	const to = deps.nextPhase(from) as Phase;

	deps.tddLog(tddDir, "INFO", "next_tdd_phase: starting", { from, to });

	const signal = ctx.signal;
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
		// advancePhase already returns the exact error message with revert hint
		// Log the failure at adapter level
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
		content: [{ type: "text", text: `\n${deps.getNudgePrompt(to, config)}` }],
		details: {},
	};
}

// ── executePreviousPhase ────────────────────────────────────────────────────

export async function executePreviousPhase(
	ctx: ExtensionContext,
	deps: PreviousPhaseDeps = defaultPreviousPhaseDeps,
): Promise<{
	content: Array<{ type: string; text: string }>;
	details?: Record<string, unknown>;
}> {
	const root = ctx.cwd;
	const tddDir = join(root, ".pi", "tdd");
	const tdd = deps.loadTddState(root);
	if (!tdd.ok) {
		deps.tddLog(tddDir, "WARN", "previous_tdd_phase: TDD not active", {
			reason: tdd.reason,
		});
		throw new Error(`TDD: ${tdd.reason}`);
	}
	if (!tdd.state.enabled) {
		deps.tddLog(tddDir, "WARN", "previous_tdd_phase: TDD disabled");
		throw new Error("TDD is not enabled. Run /tdd:on to enable it.");
	}

	const { state } = tdd;

	const result = await revertPhase(root, state, {
		hasParent: deps.hasParent,
		headMessage: deps.headMessage,
		resetHard: deps.resetHard,
		undoLastCommit: deps.undoLastCommit,
		savePhaseState: deps.savePhaseState,
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
				text: `\n${result.message} Working tree has the previous snapshot content as unstaged changes.`,
			},
		],
		details: {},
	};
}

// ── executeTddStatus ────────────────────────────────────────────────────────

export async function executeTddStatus(
	ctx: ExtensionContext,
	deps: TddStatusDeps = defaultTddStatusDeps,
): Promise<{
	content: Array<{ type: string; text: string }>;
	details?: Record<string, unknown>;
}> {
	const root = ctx.cwd;
	const tddDir = join(root, ".pi", "tdd");
	const result = deps.loadTddState(root);

	if (!result.ok) {
		deps.tddLog(tddDir, "WARN", "tdd_status: TDD not active", {
			reason: result.reason,
		});
		throw new Error(`TDD: ${result.reason}`);
	}
	const { state, config } = result;
	const info = getStatusInfo(state, config);

	deps.tddLog(tddDir, "INFO", "tdd_status: queried", {
		enabled: state.enabled,
		phase: state.current,
	});

	return {
		content: [{ type: "text", text: `\n${info}` }],
		details: {
			enabled: state.enabled,
			phase: state.current,
			blockedInRed: config.blockedInRed,
			blockedInGreen: config.blockedInGreen,
			testCommands: config.testCommands,
		},
	};
}

// ── registerTools ───────────────────────────────────────────────────────────

export function registerTools(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "next_tdd_phase",
		label: "Next TDD Phase",
		description:
			"Advance to the next TDD phase. Runs transition gates (test pass/fail checks) " +
			"and allowlist validation (no forbidden files modified).",
		parameters: Type.Object({}),
		execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			return executeNextPhase(ctx, defaultNextPhaseDeps);
		},
	});

	pi.registerTool({
		name: "previous_tdd_phase",
		label: "Previous TDD Phase",
		description:
			"WARNING: Discards ALL changes made in the current phase and reverts the working tree " +
			"to what it was when the last phase ended. Use when the previous phase's work was wrong " +
			"and this phase cannot proceed.",
		parameters: Type.Object({}),
		execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			return executePreviousPhase(ctx, defaultPreviousPhaseDeps);
		},
	});

	pi.registerTool({
		name: "tdd_status",
		label: "TDD Status",
		description:
			"Show the current TDD enforcement status: enabled/disabled, current phase, " +
			"blocked file globs per phase, and test commands.",
		parameters: Type.Object({}),
		execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			return executeTddStatus(ctx, defaultTddStatusDeps);
		},
	});
}

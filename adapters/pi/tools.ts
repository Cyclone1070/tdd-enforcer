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
	checkGate,
	getDisallowedChanges,
	hasParent,
	headMessage,
	nextPhase,
	resetHard,
	savePhaseState,
	snapshot,
	undoLastCommit,
} from "../../engine/index.js";
import { loadTddState } from "./helpers.js";
import { tddLog } from "./log.js";
import { getNudgePrompt } from "./prompts.js";

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
		options?: { cwd?: string; timeout?: number },
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
		return {
			content: [{ type: "text", text: `TDD: ${tdd.reason}` }],
			details: {},
		};
	}
	if (!tdd.state.enabled) {
		deps.tddLog(tddDir, "WARN", "next_tdd_phase: TDD disabled");
		return {
			content: [
				{ type: "text", text: "TDD is not enabled. Run /tdd:on to enable it." },
			],
			details: {},
		};
	}

	const { state, config } = tdd;
	const from = state.current;
	const to = deps.nextPhase(from) as Phase;

	deps.tddLog(tddDir, "INFO", "next_tdd_phase: starting", { from, to });

	// 1. Allowlist check
	const violations = deps.getDisallowedChanges(root, from, config);
	if (violations.length > 0) {
		deps.tddLog(tddDir, "WARN", "next_tdd_phase: blocked by allowlist", {
			from,
			violations,
		});
		return {
			content: [
				{
					type: "text",
					text:
						`BLOCKED: files not allowed in ${from.toUpperCase()} phase:\n` +
						violations.map((f) => `  - ${f}`).join("\n") +
						`\nRevert or remove them before proceeding.\n\nInspect with: cd .pi/tdd && git diff HEAD -- ${violations[0]}`,
				},
			],
			details: {},
		};
	}

	// 2. Gate check
	const testRunner: TestRunner = async (commands, timeout) => {
		const results = await Promise.all(
			commands.map(async (cmd) => {
				try {
					await deps.asyncExec(cmd, { cwd: root, timeout: timeout * 1000 });
					return { command: cmd, passed: true };
				} catch {
					return { command: cmd, passed: false };
				}
			}),
		);

		const failed = results.filter((r) => !r.passed);
		if (failed.length > 0) {
			return {
				passed: false,
				message: `Tests failed:\n${failed.map((f) => `  - ${f.command}`).join("\n")}`,
			};
		}
		return { passed: true, message: "All tests passed." };
	};

	const gate = await deps.checkGate(from, to, testRunner, config);
	deps.tddLog(tddDir, "DEBUG", "next_tdd_phase: gate result", {
		from,
		to,
		passed: gate.passed,
		message: gate.message,
	});

	if (!gate.passed) {
		return { content: [{ type: "text", text: gate.message }], details: {} };
	}

	// 3. Snapshot — label with the phase the work was done in
	const hash = deps.snapshot(root, from);
	deps.tddLog(tddDir, "INFO", "next_tdd_phase: snapshot created", {
		from,
		to,
		hash,
	});

	// 4. Save state
	state.current = to;
	deps.savePhaseState(root, state);
	deps.tddLog(tddDir, "INFO", "next_tdd_phase: complete", { from, to });

	return {
		content: [{ type: "text", text: deps.getNudgePrompt(to, config) }],
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
		return {
			content: [{ type: "text", text: `TDD: ${tdd.reason}` }],
			details: {},
		};
	}
	if (!tdd.state.enabled) {
		deps.tddLog(tddDir, "WARN", "previous_tdd_phase: TDD disabled");
		return {
			content: [
				{ type: "text", text: "TDD is not enabled. Run /tdd:on to enable it." },
			],
			details: {},
		};
	}

	const { state } = tdd;

	if (!deps.hasParent(root)) {
		deps.tddLog(tddDir, "WARN", "previous_tdd_phase: no parent commit", {
			phase: state.current,
		});
		return {
			content: [{ type: "text", text: "No previous phase to revert to." }],
			details: {},
		};
	}

	// Read phase from HEAD snapshot commit message (source of truth).
	// Snapshot is labeled with the phase the work was done in, so we use
	// it directly — no hardcoded phase map needed.
	const headMsg = deps.headMessage(root);
	const phaseMatch = headMsg.match(/^tdd: (red|green|refactor)/);
	if (!phaseMatch) {
		deps.tddLog(tddDir, "ERROR", "previous_tdd_phase: invalid HEAD message", {
			headMsg,
		});
		return {
			content: [
				{
					type: "text",
					text:
						`HEAD commit "${headMsg}" is not a TDD snapshot. Cannot determine previous phase.\n` +
						`The private git repo at .pi/tdd must not be manually modified. ` +
						`Tampering with it will cause TDD state corruption.`,
				},
			],
			details: {},
		};
	}
	const label = phaseMatch[1];
	if (label !== "red" && label !== "green" && label !== "refactor") {
		deps.tddLog(tddDir, "ERROR", "previous_tdd_phase: invalid phase label", {
			headMsg,
			label,
		});
		return {
			content: [
				{
					type: "text",
					text: `HEAD commit "${headMsg}" has unexpected label. Cannot determine previous phase.`,
				},
			],
			details: {},
		};
	}
	const prevPhase: Phase = label;
	deps.tddLog(tddDir, "INFO", "previous_tdd_phase: reverting", {
		from: state.current,
		to: prevPhase,
		headMsg,
	});

	// 1. Nuke any uncommitted changes, WT matches HEAD
	deps.resetHard(root);
	deps.tddLog(tddDir, "DEBUG", "previous_tdd_phase: resetHard done");

	// 2. Pop last snapshot commit, keep its content as unstaged
	deps.undoLastCommit(root);
	deps.tddLog(tddDir, "DEBUG", "previous_tdd_phase: undoLastCommit done");

	// 3. Update phase label from the snapshot's own label
	state.current = prevPhase;
	deps.savePhaseState(root, state);
	deps.tddLog(tddDir, "INFO", "previous_tdd_phase: complete", {
		to: prevPhase,
	});

	return {
		content: [
			{
				type: "text",
				text: `Reverted to ${prevPhase.toUpperCase()}. Working tree has the previous snapshot content as unstaged changes.`,
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
		return {
			content: [{ type: "text", text: `TDD: ${result.reason}` }],
			details: {},
		};
	}
	if (!result.state.enabled) {
		deps.tddLog(tddDir, "WARN", "tdd_status: TDD disabled");
		return {
			content: [
				{ type: "text", text: "TDD is not enabled. Run /tdd:on to enable it." },
			],
			details: {},
		};
	}

	const { state, config } = result;
	const phaseStr = state.current.toUpperCase();
	const redBlk = config.blockedInRed.join(", ") || "(none)";
	const greenBlk = config.blockedInGreen.join(", ") || "(none)";
	const commands = config.testCommands.join(", ") || "(none)";

	deps.tddLog(tddDir, "INFO", "tdd_status: queried", {
		phase: state.current,
	});

	return {
		content: [
			{
				type: "text",
				text:
					`TDD enforcer enabled\n` +
					`Current phase: ${phaseStr}\n` +
					`Blocked in RED: ${redBlk}\n` +
					`Blocked in GREEN: ${greenBlk}\n` +
					`Test commands: ${commands}`,
			},
		],
		details: {
			enabled: true,
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

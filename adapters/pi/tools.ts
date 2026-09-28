import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
	type ActionOutput,
	defaultNextPhaseDeps,
	defaultPreviousPhaseDeps,
	defaultTddStatusDeps,
	type NextPhaseDeps,
	PI_HINTS,
	type PreviousPhaseDeps,
	runNextPhase,
	runPreviousPhase,
	runTddStatus,
	type TddStatusDeps,
} from "../shared/actions.js";

export type {
	NextPhaseDeps,
	PreviousPhaseDeps,
	TddStatusDeps,
} from "../shared/actions.js";

// ── Action wrappers ─────────────────────────────────────────────────────────
// The implementations live in adapters/shared/actions.ts so the DSH adapter
// runs the exact same phase logic.

export async function executeNextPhase(
	ctx: ExtensionContext,
	deps: NextPhaseDeps = defaultNextPhaseDeps,
): Promise<ActionOutput> {
	return runNextPhase(ctx.cwd, ctx.signal, deps, PI_HINTS);
}

export async function executePreviousPhase(
	ctx: ExtensionContext,
	deps: PreviousPhaseDeps = defaultPreviousPhaseDeps,
): Promise<ActionOutput> {
	return runPreviousPhase(ctx.cwd, deps, PI_HINTS);
}

export async function executeTddStatus(
	ctx: ExtensionContext,
	deps: TddStatusDeps = defaultTddStatusDeps,
): Promise<ActionOutput> {
	return runTddStatus(ctx.cwd, deps);
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

/**
 * The three model-facing TDD tools, registered through `ctx.tools.register`.
 */

import {
	DSH_HINTS,
	defaultNextPhaseDeps,
	defaultPreviousPhaseDeps,
	defaultTddStatusDeps,
	runNextPhase,
	runPreviousPhase,
	runTddStatus,
} from "../shared/actions.js";
import { projectRootOf } from "./root.js";
import type { HostContext, ToolDefinition, ToolRunContext } from "./types.js";

const NO_ARGUMENTS = {
	type: "object",
	properties: {},
	additionalProperties: false,
} as const;

const TEXT_OUTPUT = {
	schema: {
		type: "object",
		properties: { text: { type: "string" } },
		required: ["text"],
	},
	render(_args: unknown, value: unknown) {
		const text =
			value !== null && typeof value === "object"
				? String((value as { text?: unknown }).text ?? "")
				: "";
		return [{ type: "text", text }];
	},
} as const;

async function asText(
	action: Promise<{ content: Array<{ type: string; text: string }> }>,
): Promise<{ text: string }> {
	const output = await action;
	return { text: output.content.map((block) => block.text).join("") };
}

export function registerTddTools(ctx: HostContext): void {
	const definitions: ToolDefinition[] = [
		{
			name: "next_tdd_phase",
			description:
				"Advance to the next TDD phase. Runs transition gates (test pass/fail checks) " +
				"and allowlist validation (no forbidden files modified).",
			parameters: NO_ARGUMENTS,
			output: TEXT_OUTPUT,
			execute(_args: unknown, exec: ToolRunContext) {
				const root = projectRootOf(ctx, exec);
				return asText(
					runNextPhase(root, exec.signal, defaultNextPhaseDeps, DSH_HINTS),
				);
			},
		},
		{
			name: "previous_tdd_phase",
			description:
				"WARNING: Discards ALL changes made in the current phase and reverts the working tree " +
				"to what it was when the last phase ended. Use when the previous phase's work was wrong " +
				"and this phase cannot proceed.",
			parameters: NO_ARGUMENTS,
			output: TEXT_OUTPUT,
			execute(_args: unknown, exec: ToolRunContext) {
				const root = projectRootOf(ctx, exec);
				return asText(
					runPreviousPhase(root, defaultPreviousPhaseDeps, DSH_HINTS),
				);
			},
		},
		{
			name: "tdd_status",
			description:
				"Show the current TDD enforcement status: enabled/disabled, current phase, " +
				"blocked file globs per phase, and test commands.",
			parameters: NO_ARGUMENTS,
			output: TEXT_OUTPUT,
			execute(_args: unknown, exec: ToolRunContext) {
				const root = projectRootOf(ctx, exec);
				return asText(runTddStatus(root, defaultTddStatusDeps));
			},
		},
	];

	for (const definition of definitions) ctx.tools.register(definition);
}

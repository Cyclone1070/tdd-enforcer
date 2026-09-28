/**
 * tdd-enforcer for the DeepSeek Harness.
 *
 * Host plugin entry point: `apply(ctx, config)` plus an `inject` declaration.
 * The enforcement design and its limits are documented in the shipped
 * `skills/tdd-enforcer/SKILL.md`.
 */

import { registerTddCommands } from "./commands.js";
import { TddEnforcer } from "./enforcement.js";
import { registerTddSkill } from "./skill.js";
import { registerTddTools } from "./tools.js";
import type {
	HostContext,
	PostToolDecision,
	PreToolDecision,
	ToolExecution,
	ToolExecutionResult,
} from "./types.js";

export const name = "tdd-enforcer";

/** Everything below `apply` needs; the plugin stays inactive without them. */
export const inject = ["tools", "sessions"];

export function apply(ctx: HostContext): void {
	const enforcer = new TddEnforcer(ctx);

	// write/edit: precise, synchronous, order-independent denial.
	ctx.tools.guard((exec: Readonly<ToolExecution>) =>
		enforcer.guardExecution(exec),
	);

	// bash/MCP/unknown tools: snapshot before, diff and revert after.
	ctx.on(
		"tools/pre-execute",
		async (
			exec: Readonly<ToolExecution>,
			next: () => Promise<PreToolDecision>,
		) => {
			enforcer.beginBracket(exec);
			return next();
		},
	);

	ctx.on(
		"tools/post-execute",
		async (
			exec: Readonly<ToolExecution>,
			result: Readonly<ToolExecutionResult>,
			next: () => Promise<PostToolDecision>,
		) => {
			const warning = enforcer.finishBracket(exec, result);
			if (warning !== undefined) {
				return {
					kind: "block",
					feedback: enforcer.feedback(result, warning),
				} satisfies PostToolDecision;
			}

			const decision = await next();
			const notices = enforcer.drainNotices(exec);
			if (notices.length > 0 && decision.kind === "accept") {
				return {
					kind: "accept",
					content: [...(result.content ?? []), ...notices],
				} satisfies PostToolDecision;
			}
			return decision;
		},
	);

	// Background bash: the bracket is settled when the tracked job settles.
	ctx.inject(["jobs"], (jobCtx: HostContext) => {
		jobCtx.jobs?.events.subscribe(
			{ owners: "all" },
			(event: { type?: string; job?: { id?: string } }) => {
				if (event.type !== "settled") return;
				const jobId = event.job?.id;
				if (typeof jobId === "string") enforcer.handleJobSettled(jobId);
			},
		);
	});

	registerTddTools(ctx);

	// Optional services: Cordis throws on reading an undeclared service, so
	// each registration happens inside its own inject callback.
	ctx.inject(["commands"], (commandCtx: HostContext) => {
		registerTddCommands(commandCtx);
	});
	ctx.inject(["skills"], (skillCtx: HostContext) => {
		registerTddSkill(skillCtx, import.meta.url);
	});

	announceActivation(ctx);
}

/**
 * One log line at startup. Host logs are where a user looks when a plugin
 * silently does nothing, so say that this one loaded and what it added.
 */
function announceActivation(ctx: HostContext): void {
	try {
		const logger = ctx.logger;
		if (logger === undefined) return;
		const named =
			typeof logger === "function" ? logger("tdd-enforcer") : logger;
		named?.info?.(
			"active: 3 tools, 6 commands, guard on write/edit, snapshot brackets on other tools",
		);
	} catch {
		// Logging must never be the reason a plugin fails to load.
	}
}

export { TddEnforcer };

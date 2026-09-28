/**
 * Slash commands. DSH command names must match `/^[a-z][a-z0-9_-]*$/u`, so the
 * pi names (`/tdd:on`) become `/tdd-on` and friends.
 */

import { join } from "node:path";
import {
	loadTddState,
	resetGit,
	resolveTddDir,
	savePhaseState,
	snapshot,
	tddLog,
} from "../../engine/index.js";
import { projectRootOf } from "./root.js";
import type { CommandInvocation, CommandResult, HostContext } from "./types.js";

type Phase = "red" | "green";

const ok = (text: string): CommandResult => ({ kind: "success", text });
const fail = (text: string): CommandResult => ({ kind: "error", text });

function rootOf(ctx: HostContext, invocation: CommandInvocation): string {
	return projectRootOf(ctx, invocation);
}

async function enableTdd(
	ctx: HostContext,
	invocation: CommandInvocation,
): Promise<CommandResult> {
	const root = rootOf(ctx, invocation);
	const tddDir = join(root, resolveTddDir(root));
	tddLog(tddDir, "INFO", "tdd-on: starting");

	const setup = loadTddState(root);
	if (!setup.ok) {
		tddLog(tddDir, "WARN", "tdd-on: setup invalid", { reason: setup.reason });
		return fail(setup.reason);
	}
	const { state } = setup;
	if (state.enabled) {
		tddLog(tddDir, "INFO", "tdd-on: already enabled", { phase: state.current });
		return ok(`TDD already enabled — ${state.current.toUpperCase()} phase`);
	}

	snapshot(root, state.current);
	tddLog(tddDir, "INFO", "tdd-on: snapshot taken", { phase: state.current });

	state.enabled = true;
	savePhaseState(root, state);
	tddLog(tddDir, "INFO", "tdd-on: enabled", { phase: state.current });
	return ok(`TDD enabled — ${state.current.toUpperCase()} phase`);
}

async function disableTdd(
	ctx: HostContext,
	invocation: CommandInvocation,
): Promise<CommandResult> {
	const root = rootOf(ctx, invocation);
	const tddDir = join(root, resolveTddDir(root));

	const setup = loadTddState(root);
	if (!setup.ok) {
		tddLog(tddDir, "WARN", "tdd-off: setup invalid", { reason: setup.reason });
		return fail(setup.reason);
	}
	const { state } = setup;
	if (!state.enabled) {
		tddLog(tddDir, "INFO", "tdd-off: already disabled");
		return ok("TDD already disabled");
	}

	state.enabled = false;
	savePhaseState(root, state);
	tddLog(tddDir, "INFO", "tdd-off: disabled", { was: state.current });
	return ok("TDD disabled");
}

async function showStatus(
	ctx: HostContext,
	invocation: CommandInvocation,
): Promise<CommandResult> {
	const root = rootOf(ctx, invocation);
	const tddDir = join(root, resolveTddDir(root));
	const result = loadTddState(root);
	if (!result.ok) {
		tddLog(tddDir, "WARN", "tdd-status: setup invalid", {
			reason: result.reason,
		});
		return fail(`TDD: ${result.reason}`);
	}

	const { state, config } = result;
	tddLog(tddDir, "INFO", "tdd-status: queried", {
		enabled: state.enabled,
		phase: state.current,
	});

	return ok(
		`TDD enforcer ${state.enabled ? "enabled" : "disabled"}\n` +
			`Current phase: ${state.current.toUpperCase()}\n` +
			`Blocked in RED: ${config.blockedInRed.join(", ") || "(none)"}\n` +
			`Blocked in GREEN: ${config.blockedInGreen.join(", ") || "(none)"}\n` +
			`Test commands: ${config.testCommands.join(", ") || "(none)"}` +
			(result.warning !== undefined ? `\n\n⚠️ ${result.warning}` : ""),
	);
}

async function resetTdd(
	ctx: HostContext,
	invocation: CommandInvocation,
): Promise<CommandResult> {
	const root = rootOf(ctx, invocation);
	const tddDir = join(root, resolveTddDir(root));
	tddLog(tddDir, "INFO", "tdd-reset: starting");

	const setup = loadTddState(root);
	if (!setup.ok) {
		tddLog(tddDir, "WARN", "tdd-reset: setup invalid", {
			reason: setup.reason,
		});
		return fail(setup.reason);
	}

	try {
		resetGit(root);
		tddLog(tddDir, "INFO", "tdd-reset: git reset and re-initialised");
	} catch (error) {
		tddLog(tddDir, "ERROR", "tdd-reset: git reset failed", {
			error: (error as Error).message,
		});
		return fail("Failed to reset private git repo.");
	}

	snapshot(root, "red");
	savePhaseState(root, { enabled: false, current: "red" });
	tddLog(tddDir, "INFO", "tdd-reset: complete");

	return ok(
		"TDD snapshot history reset. Working tree left untouched. Run /tdd-on to re-enable enforcement.",
	);
}

async function jumpTo(
	phase: Phase,
	ctx: HostContext,
	invocation: CommandInvocation,
): Promise<CommandResult> {
	const root = rootOf(ctx, invocation);
	const tddDir = join(root, resolveTddDir(root));

	const setup = loadTddState(root);
	if (!setup.ok) {
		tddLog(tddDir, "WARN", `tdd-${phase}: setup invalid`, {
			reason: setup.reason,
		});
		return fail(setup.reason);
	}
	const { state } = setup;

	if (state.current === phase) {
		tddLog(tddDir, "INFO", `tdd-${phase}: already in ${phase}`, { phase });
		return ok(`TDD: already in ${phase.toUpperCase()} phase.`);
	}

	snapshot(root, state.current);
	tddLog(tddDir, "INFO", `tdd-${phase}: snapshot taken`, {
		from: state.current,
	});

	state.enabled = true;
	state.current = phase;
	savePhaseState(root, state);
	tddLog(tddDir, "INFO", `tdd-${phase}: jumped`);
	return ok(`Skipped to ${phase.toUpperCase()} phase.`);
}

const COMMANDS = [
	{
		name: "tdd-on",
		description: "Enable TDD enforcement for this project",
		run: enableTdd,
	},
	{
		name: "tdd-off",
		description: "Disable TDD enforcement (keeps state and snapshot history)",
		run: disableTdd,
	},
	{
		name: "tdd-status",
		description: "Show TDD enforcement status",
		run: showStatus,
	},
	{
		name: "tdd-reset",
		description:
			"WARNING: Destroys ALL TDD snapshot history and resets to RED phase. " +
			"Working tree is preserved. Run /tdd-on to re-enable after reset.",
		run: resetTdd,
	},
	{
		name: "tdd-red",
		description:
			"Skip to RED phase. Snapshot working tree, auto-enable TDD, set phase. No gate checks.",
		run: (ctx: HostContext, invocation: CommandInvocation) =>
			jumpTo("red", ctx, invocation),
	},
	{
		name: "tdd-green",
		description:
			"Skip to GREEN phase. Snapshot working tree, auto-enable TDD, set phase. No gate checks.",
		run: (ctx: HostContext, invocation: CommandInvocation) =>
			jumpTo("green", ctx, invocation),
	},
] as const;

export function registerTddCommands(ctx: HostContext): void {
	const commands = ctx.commands;
	if (commands === undefined) return;
	for (const command of COMMANDS) {
		commands.register({
			name: command.name,
			description: command.description,
			handler: (invocation: CommandInvocation) => command.run(ctx, invocation),
		});
	}
}

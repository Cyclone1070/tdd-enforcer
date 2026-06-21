import { join } from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { resetGit, savePhaseState, snapshot } from "../../engine/index.js";
import { loadTddState } from "./helpers.js";
import { registerHooks } from "./hooks.js";
import { tddLog } from "./log.js";
import { registerTools } from "./tools.js";

export async function handleTddOn(
	ctx: ExtensionContext,
	deps: {
		loadTddState: typeof loadTddState;
		snapshot: typeof snapshot;
		savePhaseState: typeof savePhaseState;
		tddLog: typeof tddLog;
	} = {
		loadTddState,
		snapshot,
		savePhaseState,
		tddLog,
	},
): Promise<void> {
	const root = ctx.cwd;
	const tddDir = join(root, ".pi", "tdd");

	deps.tddLog(tddDir, "INFO", "tdd:on: starting");

	const setup = deps.loadTddState(root);
	if (!setup.ok) {
		deps.tddLog(tddDir, "WARN", "tdd:on: setup invalid", {
			reason: setup.reason,
		});
		ctx.ui.notify(setup.reason, "error");
		return;
	}

	const { state } = setup;

	if (state.enabled) {
		deps.tddLog(tddDir, "INFO", "tdd:on: already enabled", {
			phase: state.current,
		});
		ctx.ui.notify(
			`TDD already enabled — ${state.current.toUpperCase()} phase`,
			"info",
		);
		return;
	}

	// Snapshot working tree so stale baseline doesn't nuke user changes
	deps.snapshot(root, state.current);
	deps.tddLog(tddDir, "INFO", "tdd:on: snapshot taken", {
		phase: state.current,
	});

	state.enabled = true;
	deps.savePhaseState(root, state);
	deps.tddLog(tddDir, "INFO", "tdd:on: enabled", {
		phase: state.current,
	});
	ctx.ui.notify(`TDD enabled — ${state.current.toUpperCase()} phase`, "info");
}

export async function handleTddOff(
	ctx: ExtensionContext,
	deps: {
		loadTddState: typeof loadTddState;
		savePhaseState: typeof savePhaseState;
		tddLog: typeof tddLog;
	} = {
		loadTddState,
		savePhaseState,
		tddLog,
	},
): Promise<void> {
	const root = ctx.cwd;
	const tddDir = join(root, ".pi", "tdd");

	const setup = deps.loadTddState(root);
	if (!setup.ok) {
		deps.tddLog(tddDir, "WARN", "tdd:off: setup invalid", {
			reason: setup.reason,
		});
		ctx.ui.notify(setup.reason, "error");
		return;
	}

	const { state } = setup;

	if (!state.enabled) {
		deps.tddLog(tddDir, "INFO", "tdd:off: already disabled");
		ctx.ui.notify("TDD already disabled", "info");
		return;
	}

	state.enabled = false;
	deps.savePhaseState(root, state);
	deps.tddLog(tddDir, "INFO", "tdd:off: disabled", {
		was: state.current,
	});
	ctx.ui.notify("TDD disabled", "info");
}

export async function handleTddStatus(
	ctx: ExtensionContext,
	deps: {
		loadTddState: typeof loadTddState;
		tddLog: typeof tddLog;
	} = {
		loadTddState,
		tddLog,
	},
): Promise<void> {
	const root = ctx.cwd;
	const tddDir = join(root, ".pi", "tdd");
	const result = deps.loadTddState(root);

	if (!result.ok) {
		deps.tddLog(tddDir, "WARN", "tdd:status: setup invalid", {
			reason: result.reason,
		});
		ctx.ui.notify(`TDD: ${result.reason}`, "error");
		return;
	}

	const { state, config } = result;
	const enabledStr = state.enabled ? "enabled" : "disabled";
	const phaseStr = state.current.toUpperCase();
	const redBlk = config.blockedInRed.join(", ") || "(none)";
	const greenBlk = config.blockedInGreen.join(", ") || "(none)";
	const commands = config.testCommands.join(", ") || "(none)";

	deps.tddLog(tddDir, "INFO", "tdd:status: queried", {
		enabled: state.enabled,
		phase: state.current,
	});

	ctx.ui.notify(
		`TDD enforcer ${enabledStr}\n` +
			`Current phase: ${phaseStr}\n` +
			`Blocked in RED: ${redBlk}\n` +
			`Blocked in GREEN: ${greenBlk}\n` +
			`Test commands: ${commands}`,
		"info",
	);
}

export async function handleBeforeAgentStart(
	event: { systemPrompt: string },
	ctx: { cwd: string },
	deps: {
		loadTddState: typeof loadTddState;
	},
): Promise<void> {
	const tdd = deps.loadTddState(ctx.cwd);
	if (!tdd.ok) return;

	if (tdd.state.enabled) {
		event.systemPrompt +=
			"\n\nYou are working under TDD enforcement. Each phase restricts which files you can modify — locked files will be blocked automatically.\n" +
			"Minimise the scope of each TDD cycle so reverting is cheap.";
	} else {
		event.systemPrompt +=
			"\n\nTDD enforcement was disabled. File restrictions are no longer enforced.";
	}
}

export async function handleTddJump(
	phase: "red" | "green" | "refactor",
	ctx: ExtensionContext,
	deps: {
		loadTddState: typeof loadTddState;
		snapshot: typeof snapshot;
		savePhaseState: typeof savePhaseState;
		tddLog: typeof tddLog;
	} = {
		loadTddState,
		snapshot,
		savePhaseState,
		tddLog,
	},
): Promise<void> {
	const root = ctx.cwd;
	const tddDir = join(root, ".pi", "tdd");

	const setup = deps.loadTddState(root);
	if (!setup.ok) {
		deps.tddLog(tddDir, "WARN", `tdd:${phase}: setup invalid`, {
			reason: setup.reason,
		});
		ctx.ui.notify(setup.reason, "error");
		return;
	}

	const { state } = setup;

	if (state.current === phase) {
		deps.tddLog(tddDir, "INFO", `tdd:${phase}: already in ${phase}`, {
			phase,
		});
		ctx.ui.notify(`TDD: already in ${phase.toUpperCase()} phase.`, "info");
		return;
	}

	// Snapshot the current phase's work before jumping
	deps.snapshot(root, state.current);
	deps.tddLog(tddDir, "INFO", `tdd:${phase}: snapshot taken`, {
		from: state.current,
	});

	// Auto-enable if disabled, set phase
	state.enabled = true;
	state.current = phase;
	deps.savePhaseState(root, state);

	deps.tddLog(tddDir, "INFO", `tdd:${phase}: jumped`);
	ctx.ui.notify(`Skipped to ${phase.toUpperCase()} phase.`, "info");
}

export async function handleTddReset(
	ctx: ExtensionContext,
	deps: {
		loadTddState: typeof loadTddState;
		resetGit: typeof resetGit;
		snapshot: typeof snapshot;
		savePhaseState: typeof savePhaseState;
		tddLog: typeof tddLog;
	} = {
		loadTddState,
		resetGit,
		snapshot,
		savePhaseState,
		tddLog,
	},
): Promise<void> {
	const root = ctx.cwd;
	const tddDir = join(root, ".pi", "tdd");

	deps.tddLog(tddDir, "INFO", "tdd:reset: starting");

	const setup = deps.loadTddState(root);
	if (!setup.ok) {
		deps.tddLog(tddDir, "WARN", "tdd:reset: setup invalid", {
			reason: setup.reason,
		});
		ctx.ui.notify(setup.reason, "error");
		return;
	}

	// Nuke git history and re-init
	try {
		deps.resetGit(root);
		deps.tddLog(tddDir, "INFO", "tdd:reset: git reset and re-initialised");
	} catch (e) {
		deps.tddLog(tddDir, "ERROR", "tdd:reset: git reset failed", {
			error: (e as Error).message,
		});
		ctx.ui.notify("Failed to reset private git repo.", "error");
		return;
	}

	// Snapshot current working tree
	deps.snapshot(root, "red");
	deps.tddLog(tddDir, "INFO", "tdd:reset: snapshot taken");

	// Reset state to RED (disabled, user must run /tdd:on)
	deps.savePhaseState(root, { enabled: false, current: "red" });
	deps.tddLog(tddDir, "INFO", "tdd:reset: complete");

	ctx.ui.notify(
		"TDD snapshot history reset. Run /tdd:on to re-enable enforcement.",
		"warning",
	);
}

export default function (pi: ExtensionAPI) {
	const defaultDeps = {
		loadTddState,
		snapshot,
		savePhaseState,
		tddLog,
		resetGit,
	};

	pi.registerCommand("tdd:on", {
		description: "Enable TDD enforcement",
		handler: (_args: string, ctx: ExtensionContext) =>
			handleTddOn(ctx, defaultDeps),
	});

	pi.registerCommand("tdd:off", {
		description: "Disable TDD enforcement",
		handler: (_args: string, ctx: ExtensionContext) =>
			handleTddOff(ctx, defaultDeps),
	});

	pi.registerCommand("tdd:status", {
		description: "Show TDD enforcement status",
		handler: (_args: string, ctx: ExtensionContext) =>
			handleTddStatus(ctx, defaultDeps),
	});

	pi.registerCommand("tdd:reset", {
		description:
			"WARNING: Destroys ALL TDD snapshot history and resets to RED phase. " +
			"Working tree is preserved. Run /tdd:on to re-enable after reset.",
		handler: (_args: string, ctx: ExtensionContext) =>
			handleTddReset(ctx, { ...defaultDeps, resetGit }),
	});

	for (const phase of ["red", "green", "refactor"] as const) {
		pi.registerCommand(`tdd:${phase}`, {
			description:
				`Skip to ${phase.toUpperCase()} phase. ` +
				"Snapshot working tree, auto-enable TDD, set phase. No gate checks.",
			handler: (_args: string, ctx: ExtensionContext) =>
				handleTddJump(phase, ctx, defaultDeps),
		});
	}

	registerTools(pi);
	registerHooks(pi);

	pi.on("before_agent_start", (event, ctx) =>
		handleBeforeAgentStart(event, ctx, { loadTddState }),
	);
}

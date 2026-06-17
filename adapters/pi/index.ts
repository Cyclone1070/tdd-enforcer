import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { savePhaseState, resetGit, snapshot } from "../../engine/index.js";
import { registerTools } from "./tools.js";
import { registerHooks } from "./hooks.js";
import { loadTddState } from "./helpers.js";
import { tddLog } from "./log.js";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("tdd:on", {
    description: "Enable TDD enforcement",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const root = ctx.cwd;
      const tddDir = join(root, ".pi", "tdd");

      tddLog(tddDir, "INFO", "tdd:on: starting");

      const setup = loadTddState(root);
      if (!setup.ok) {
        tddLog(tddDir, "WARN", "tdd:on: setup invalid", { reason: setup.reason });
        ctx.ui.notify(setup.reason, "error");
        return;
      }

      const { state } = setup;

      if (state.enabled) {
        tddLog(tddDir, "INFO", "tdd:on: already enabled", {
          phase: state.current,
        });
        ctx.ui.notify(`TDD already enabled — ${state.current.toUpperCase()} phase`, "info");
        return;
      }

      // Snapshot working tree so stale baseline doesn't nuke user changes
      snapshot(root, state.current);
      tddLog(tddDir, "INFO", "tdd:on: snapshot taken", {
        phase: state.current,
      });

      state.enabled = true;
      savePhaseState(root, state);
      tddLog(tddDir, "INFO", "tdd:on: enabled", {
        phase: state.current,
      });
      ctx.ui.notify(`TDD enabled — ${state.current.toUpperCase()} phase`, "info");
    },
  });

  pi.registerCommand("tdd:off", {
    description: "Disable TDD enforcement",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const root = ctx.cwd;
      const tddDir = join(root, ".pi", "tdd");

      const setup = loadTddState(root);
      if (!setup.ok) {
        tddLog(tddDir, "WARN", "tdd:off: setup invalid", { reason: setup.reason });
        ctx.ui.notify(setup.reason, "error");
        return;
      }

      const { state } = setup;

      if (!state.enabled) {
        tddLog(tddDir, "INFO", "tdd:off: already disabled");
        ctx.ui.notify("TDD already disabled", "info");
        return;
      }

      state.enabled = false;
      savePhaseState(root, state);
      tddLog(tddDir, "INFO", "tdd:off: disabled", {
        was: state.current,
      });
      ctx.ui.notify("TDD disabled", "info");
    },
  });

  pi.registerCommand("tdd:status", {
    description: "Show TDD enforcement status",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const root = ctx.cwd;
      const tddDir = join(root, ".pi", "tdd");
      const result = loadTddState(root);

      if (!result.ok) {
        tddLog(tddDir, "WARN", "tdd:status: setup invalid", {
          reason: result.reason,
        });
        ctx.ui.notify(`TDD: ${result.reason}`, "error");
        return;
      }

      const { state, config } = result;
      const enabledStr = state.enabled ? "enabled" : "disabled";
      const phaseStr = state.current.toUpperCase();
      const redGlobs = config.allowedRedPhaseFiles.join(", ") || "(none)";
      const greenGlobs = config.allowedGreenPhaseFiles.join(", ") || "(none)";
      const commands = config.testCommands.join(", ") || "(none)";

      tddLog(tddDir, "INFO", "tdd:status: queried", {
        enabled: state.enabled,
        phase: state.current,
      });

      ctx.ui.notify(
        `TDD enforcer ${enabledStr}\n` +
        `Current phase: ${phaseStr}\n` +
        `Test files: ${redGlobs}\n` +
        `Impl files: ${greenGlobs}\n` +
        `Test commands: ${commands}`,
        "info"
      );
    },
  });

  pi.registerCommand("tdd:reset", {
    description:
      "WARNING: Destroys ALL TDD snapshot history and resets to RED phase. " +
      "Working tree is preserved. Run /tdd:on to re-enable after reset.",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const root = ctx.cwd;
      const tddDir = join(root, ".pi", "tdd");

      tddLog(tddDir, "INFO", "tdd:reset: starting");

      const setup = loadTddState(root);
      if (!setup.ok) {
        tddLog(tddDir, "WARN", "tdd:reset: setup invalid", { reason: setup.reason });
        ctx.ui.notify(setup.reason, "error");
        return;
      }

      // Nuke git history and re-init
      try {
        resetGit(root);
        tddLog(tddDir, "INFO", "tdd:reset: git reset and re-initialised");
      } catch (e) {
        tddLog(tddDir, "ERROR", "tdd:reset: git reset failed", {
          error: (e as Error).message,
        });
        ctx.ui.notify("Failed to reset private git repo.", "error");
        return;
      }

      // Snapshot current working tree
      snapshot(root, "red");
      tddLog(tddDir, "INFO", "tdd:reset: snapshot taken");

      // Reset state to RED (disabled, user must run /tdd:on)
      savePhaseState(root, { enabled: false, current: "red" });
      tddLog(tddDir, "INFO", "tdd:reset: complete");

      ctx.ui.notify(
        "TDD snapshot history reset. Run /tdd:on to re-enable enforcement.",
        "warning",
      );
    },
  });

  registerTools(pi);
  registerHooks(pi);
}

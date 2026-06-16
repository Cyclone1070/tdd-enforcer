import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadPhaseState, loadConfig, savePhaseState, initGit, resetGit, snapshot } from "../../engine/index.js";
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

      if (!existsSync(tddDir)) {
        tddLog(tddDir, "WARN", "tdd:on: missing .pi/tdd/ directory");
        ctx.ui.notify("Missing .pi/tdd/ directory. See the tdd-init skill to learn how to set up TDD configs.", "error");
        return;
      }

      const rulesPath = join(tddDir, "rules.json");
      if (!existsSync(rulesPath)) {
        tddLog(tddDir, "WARN", "tdd:on: missing rules.json");
        ctx.ui.notify("Missing .pi/tdd/rules.json. See the tdd-init skill to learn how to set up TDD configs.", "error");
        return;
      }

      const phasePath = join(tddDir, "state.json");
      if (!existsSync(phasePath)) {
        tddLog(tddDir, "WARN", "tdd:on: missing state.json");
        ctx.ui.notify("Missing .pi/tdd/state.json. See the tdd-init skill to learn how to set up TDD configs.", "error");
        return;
      }

      let state;
      try {
        state = loadPhaseState(root);
      } catch (e) {
        tddLog(tddDir, "WARN", "tdd:on: invalid state.json", {
          error: (e as Error).message,
        });
        ctx.ui.notify("Invalid .pi/tdd/state.json. Fix or delete it, then run /tdd:on again.", "error");
        return;
      }

      try {
        loadConfig(root);
      } catch (e) {
        tddLog(tddDir, "WARN", "tdd:on: invalid rules.json", {
          error: (e as Error).message,
        });
        ctx.ui.notify("Invalid .pi/tdd/rules.json. Fix or delete it, then run /tdd:on again.", "error");
        return;
      }

      if (state.enabled) {
        tddLog(tddDir, "INFO", "tdd:on: already enabled", {
          phase: state.current,
        });
        ctx.ui.notify(`TDD already enabled — ${state.current.toUpperCase()} phase`, "info");
        return;
      }

      if (!existsSync(join(tddDir, ".git", "HEAD"))) {
        try {
          initGit(root);
          tddLog(tddDir, "INFO", "tdd:on: git initialised");
        } catch (e) {
          tddLog(tddDir, "ERROR", "tdd:on: git init failed", {
            error: (e as Error).message,
          });
          ctx.ui.notify("Failed to initialise private git repo.", "error");
          return;
        }
      } else {
        tddLog(tddDir, "DEBUG", "tdd:on: git repo already exists");
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

      let state;
      try {
        state = loadPhaseState(root);
      } catch (e) {
        tddLog(tddDir, "WARN", "tdd:off: invalid state.json", {
          error: (e as Error).message,
        });
        ctx.ui.notify("Invalid .pi/tdd/state.json. Fix or delete it, then run /tdd:off again.", "error");
        return;
      }

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
        tddLog(tddDir, "WARN", "tdd:status: TDD not active", {
          reason: result.reason,
        });
        ctx.ui.notify(`TDD: ${result.reason}`, "error");
        return;
      }

      const { state, config } = result;
      const phaseStr = state.current.toUpperCase();
      const redGlobs = config.allowedRedPhaseFiles.join(", ") || "(none)";
      const greenGlobs = config.allowedGreenPhaseFiles.join(", ") || "(none)";
      const commands = config.testCommands.join(", ") || "(none)";

      tddLog(tddDir, "INFO", "tdd:status: queried", {
        phase: state.current,
      });

      ctx.ui.notify(
        `TDD enforcer enabled\n` +
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

      if (!existsSync(tddDir)) {
        tddLog(tddDir, "WARN", "tdd:reset: missing .pi/tdd/ directory");
        ctx.ui.notify("No .pi/tdd/ directory found — nothing to reset.", "error");
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

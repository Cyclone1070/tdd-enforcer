import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadPhaseState, loadConfig, savePhaseState, initGit } from "../../engine/index.js";
import { registerTools } from "./tools.js";
import { registerHooks } from "./hooks.js";
import { loadTddState } from "./helpers.js";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("tdd:on", {
    description: "Enable TDD enforcement",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const root = ctx.cwd;
      const tddDir = join(root, ".pi", "tdd");

      if (!existsSync(tddDir)) {
        ctx.ui.notify("Missing .pi/tdd/ directory. See the tdd-init skill to learn how to set up TDD configs.", "error");
        return;
      }

      const rulesPath = join(tddDir, "rules.json");
      if (!existsSync(rulesPath)) {
        ctx.ui.notify("Missing .pi/tdd/rules.json. See the tdd-init skill to learn how to set up TDD configs.", "error");
        return;
      }

      const phasePath = join(tddDir, "phase.json");
      if (!existsSync(phasePath)) {
        ctx.ui.notify("Missing .pi/tdd/phase.json. See the tdd-init skill to learn how to set up TDD configs.", "error");
        return;
      }

      let state;
      try {
        state = loadPhaseState(root);
      } catch {
        ctx.ui.notify("Invalid .pi/tdd/phase.json. Fix or delete it, then run /tdd:on again.", "error");
        return;
      }

      try {
        loadConfig(root);
      } catch {
        ctx.ui.notify("Invalid .pi/tdd/rules.json. Fix or delete it, then run /tdd:on again.", "error");
        return;
      }

      if (state.enabled) {
        ctx.ui.notify(`TDD already enabled — ${state.current.toUpperCase()} phase`, "info");
        return;
      }

      if (!existsSync(join(tddDir, ".git", "HEAD"))) {
        try {
          initGit(root);
        } catch {
          ctx.ui.notify("Failed to initialise private git repo.", "error");
          return;
        }
      }

      state.enabled = true;
      savePhaseState(root, state);
      ctx.ui.notify(`TDD enabled — ${state.current.toUpperCase()} phase`, "info");
    },
  });

  pi.registerCommand("tdd:off", {
    description: "Disable TDD enforcement",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const root = ctx.cwd;

      let state;
      try {
        state = loadPhaseState(root);
      } catch {
        ctx.ui.notify("Invalid .pi/tdd/phase.json. Fix or delete it, then run /tdd:off again.", "error");
        return;
      }

      if (!state.enabled) {
        ctx.ui.notify("TDD already disabled", "info");
        return;
      }

      state.enabled = false;
      savePhaseState(root, state);
      ctx.ui.notify("TDD disabled", "info");
    },
  });

  pi.registerCommand("tdd:status", {
    description: "Show TDD enforcement status",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const root = ctx.cwd;
      const result = loadTddState(root);

      if (!result.ok) {
        ctx.ui.notify(`TDD: ${result.reason}`, "error");
        return;
      }

      const { state, config } = result;
      const phaseStr = state.current.toUpperCase();
      const redGlobs = config.allowedRedPhaseFiles.join(", ") || "(none)";
      const greenGlobs = config.allowedGreenPhaseFiles.join(", ") || "(none)";
      const commands = config.testCommands.join(", ") || "(none)";

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

  registerTools(pi);
  registerHooks(pi);
}

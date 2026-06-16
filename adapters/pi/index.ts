import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadPhaseState, loadConfig, savePhaseState, initGit } from "../../engine/index.js";
import { registerTools } from "./tools.js";
import { registerHooks } from "./hooks.js";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("tdd", {
    description: "Toggle TDD enforcement on/off",
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
        ctx.ui.notify("Invalid .pi/tdd/phase.json. Fix or delete it, then run /tdd again.", "error");
        return;
      }

      try {
        loadConfig(root);
      } catch {
        ctx.ui.notify("Invalid .pi/tdd/rules.json. Fix or delete it, then run /tdd again.", "error");
        return;
      }

      if (!state.enabled) {
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
      } else {
        state.enabled = false;
        savePhaseState(root, state);
        ctx.ui.notify("TDD disabled", "info");
      }
    },
  });

  registerTools(pi);
  registerHooks(pi);
}

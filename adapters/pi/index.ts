import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadPhaseState, savePhaseState } from "../../engine/index.js";
import { registerTools } from "./tools.js";
import { registerHooks } from "./hooks.js";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("tdd", {
    description: "Toggle TDD enforcement on/off",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const root = ctx.cwd;
      const tddDir = join(root, ".pi", "tdd");
      const state = loadPhaseState(root);

      if (!state.enabled) {
        if (!existsSync(tddDir)) {
          ctx.ui.notify("Run the tdd-init skill first to create .pi/tdd/ with rules.json.", "error");
          return;
        }
        if (!existsSync(join(tddDir, ".git", "HEAD"))) {
          ctx.ui.notify("Run the tdd-init skill first to set up the private git repo.", "error");
          return;
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

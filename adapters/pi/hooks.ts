import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, isBashToolResult } from "@earendil-works/pi-coding-agent";
import { isAllowed } from "../../engine/enforce.js";
import { changesSinceSnapshot, restoreFiles } from "../../engine/git.js";
import { loadTddState } from "./helpers.js";

export function registerHooks(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx: ExtensionContext) => {
    const root = ctx.cwd;
    const tdd = loadTddState(root);
    if (!tdd.ok) return;

    const { state, config } = tdd;
    const phase = state.current;

    // write/edit pre-block
    let filePath: string | undefined;
    if (isToolCallEventType("write", event)) filePath = event.input.path;
    else if (isToolCallEventType("edit", event)) filePath = event.input.path;
    else return;

    if (!filePath) return;

    if (!isAllowed(filePath, phase, config)) {
      return {
        block: true,
        reason: `TDD ${phase.toUpperCase()}: "${filePath}" is locked in this phase.`,
      };
    }
  });

  pi.on("tool_result", async (event, ctx: ExtensionContext) => {
    if (!isBashToolResult(event)) return;

    const root = ctx.cwd;
    const tdd = loadTddState(root);
    if (!tdd.ok) return;

    const { state, config } = tdd;
    const phase = state.current;
    if (phase === "refactor") return;

    const changed = changesSinceSnapshot(root);
    if (changed.length === 0) return;

    const violations = changed.filter((f) => !isAllowed(f, phase, config));
    if (violations.length === 0) return;

    restoreFiles(root, violations);

    const existingText = event.content.map((c) => ("text" in c ? c.text : "")).join("");
    return {
      content: [
        { type: "text", text: existingText + `\n\n⚠️ TDD: Bash modified files locked in ${phase.toUpperCase()} phase. Reverted: ${violations.join(", ")}` },
      ],
    };
  });

}

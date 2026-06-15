import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, isBashToolResult } from "@earendil-works/pi-coding-agent";
import { ensureReady, loadPhaseState, loadConfig } from "../../engine/index.js";
import { isAllowed } from "../../engine/enforce.js";
import { changesSinceSnapshot, restoreFiles } from "../../engine/git.js";
import type { Phase } from "../../engine/types.js";
import { buildPhasePrompt } from "./prompts.js";

export function registerHooks(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx: ExtensionContext) => {
    const root = ctx.cwd;
    if (!ensureReady(root)) return;

    const state = loadPhaseState(root);
    const phase = state.current as Phase;
    const config = loadConfig(root);

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
    if (!ensureReady(root)) return;

    const state = loadPhaseState(root);
    const phase = state.current as Phase;
    if (phase === "refactor") return;

    const config = loadConfig(root);

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

  pi.on("before_agent_start", async (event, ctx: ExtensionContext) => {
    const root = ctx.cwd;
    if (!ensureReady(root)) return;

    const state = loadPhaseState(root);
    const phase = state.current as Phase;
    const config = loadConfig(root);
    const phaseInfo = buildPhasePrompt(phase, config);

    if (!phaseInfo) return;

    return {
      systemPrompt: event.systemPrompt + "\n\n" + phaseInfo,
    };
  });
}

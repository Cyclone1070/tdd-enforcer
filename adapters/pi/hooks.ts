import { join, relative } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, isBashToolResult } from "@earendil-works/pi-coding-agent";
import { isAllowed } from "../../engine/enforce.js";
import { changesSinceSnapshot } from "../../engine/git.js";
import { loadTddState } from "./helpers.js";
import { tddLog } from "./log.js";

export function registerHooks(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx: ExtensionContext) => {
    const root = ctx.cwd;
    const tddDir = join(root, ".pi", "tdd");
    const tdd = loadTddState(root);
    if (!tdd.ok) {
      tddLog(tddDir, "WARN", "tool_call: TDD not active, edit passes through", {
        toolName: (event as any).toolName,
        reason: tdd.reason,
      });
      return;
    }

    const { state, config } = tdd;
    const phase = state.current;

    let filePath: string | undefined;
    let toolName: string | undefined;
    if (isToolCallEventType("write", event)) {
      toolName = "write";
      filePath = (event as any).input?.path;
    } else if (isToolCallEventType("edit", event)) {
      toolName = "edit";
      filePath = (event as any).input?.path;
    } else {
      tddLog(tddDir, "DEBUG", "tool_call: non-file tool, ignored", {
        toolName: (event as any).toolName,
      });
      return;
    }

    if (!filePath) {
      tddLog(tddDir, "WARN", "tool_call: no path in input, cannot block", {
        toolName,
      });
      return;
    }

    // Patterns in rules.json are relative to repo root; convert absolute path
    const relPath = relative(root, filePath);
    const allowed = isAllowed(relPath, phase, config);
    tddLog(tddDir, "DEBUG", "tool_call: check", { toolName, relPath, phase, allowed });

    if (!allowed) {
      tddLog(tddDir, "INFO", "tool_call: blocked file modification", {
        toolName,
        relPath,
        phase,
      });
      return {
        block: true,
        reason: `TDD ${phase.toUpperCase()}: "${relPath}" is locked in this phase.`,
      };
    }

    tddLog(tddDir, "DEBUG", "tool_call: allowed", { toolName, relPath, phase });
  });

  pi.on("tool_result", async (event, ctx: ExtensionContext) => {
    if (!isBashToolResult(event)) return;

    const root = ctx.cwd;
    const tddDir = join(root, ".pi", "tdd");
    const tdd = loadTddState(root);
    if (!tdd.ok) {
      tddLog(tddDir, "WARN", "tool_result: TDD not active, bash passes through", {
        reason: tdd.reason,
      });
      return;
    }

    const { state, config } = tdd;
    const phase = state.current;
    if (phase === "refactor") {
      tddLog(tddDir, "DEBUG", "tool_result: refactor phase, no check");
      return;
    }

    const changed = changesSinceSnapshot(root);
    if (changed.length === 0) {
      tddLog(tddDir, "DEBUG", "tool_result: no changes since snapshot");
      return;
    }

    const violations = changed.filter((f) => !isAllowed(f, phase, config));
    if (violations.length === 0) {
      tddLog(tddDir, "DEBUG", "tool_result: no violations among changed files", {
        changed,
      });
      return;
    }

    tddLog(tddDir, "WARN", "tool_result: locked files modified by bash", {
      phase,
      violations,
    });

    const existingText = event.content.map((c) => ("text" in c ? c.text : "")).join("");
    return {
      content: [
        {
          type: "text",
          text:
            existingText +
            `\n\n⚠️ ${phase.toUpperCase()}: bash modified locked files: ${violations.join(", ")}\n` +
            `next_tdd_phase blocked until reverted. ` +
            `Inspect with: cd .pi/tdd && git diff HEAD -- ${violations[0]}`,
        },
      ],
    };
  });
}

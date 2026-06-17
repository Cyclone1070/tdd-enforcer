import { join, relative } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, isBashToolResult } from "@earendil-works/pi-coding-agent";
import { isAllowed } from "../../engine/enforce.js";
import { changesSince, restoreFilesTo, gitStashCreate } from "../../engine/git.js";
import { loadTddState } from "./helpers.js";
import { tddLog } from "./log.js";

// Correlates tool_call → tool_result for per-command bash diff
const preBashStashes = new Map<string, string>();

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

    // Bash: stash pre-command state for per-command diff later
    if ((event as any).toolName === "bash") {
      try {
        const hash = gitStashCreate(root);
        preBashStashes.set(event.toolCallId, hash);
        tddLog(tddDir, "DEBUG", "tool_call: bash pre-stash created", {
          toolCallId: event.toolCallId,
          hash,
        });
      } catch (e) {
        tddLog(tddDir, "ERROR", "tool_call: bash pre-stash failed", {
          toolCallId: event.toolCallId,
          error: (e as Error).message,
        });
      }
      return;
    }

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

    // Never allow writes to .pi/tdd/ when TDD is active
    if (relPath.startsWith(".pi/tdd/")) {
      tddLog(tddDir, "INFO", "tool_call: blocked .pi/tdd/ file", { toolName, relPath });
      return {
        block: true,
        reason: "TDD: Config files are locked. No bypassing TDD allowed. If bypassing is justified, ask the user: turn TDD off (/tdd:off), reset (/tdd:reset), or change phase via /tdd commands.",
      };
    }

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

    // Get the pre-bash stash for this tool call
    const stashHash = preBashStashes.get(event.toolCallId);
    preBashStashes.delete(event.toolCallId);
    if (!stashHash) {
      tddLog(tddDir, "WARN", "tool_result: no pre-bash stash found", {
        toolCallId: event.toolCallId,
      });
      return;
    }

    const tdd = loadTddState(root);
    if (!tdd.ok) {
      tddLog(tddDir, "WARN", "tool_result: TDD not active, bash passes through", {
        reason: tdd.reason,
      });
      return;
    }

    const { state, config } = tdd;
    const phase = state.current;

    // Diff against pre-bash stash — only changes from THIS command
    const changed = changesSince(root, stashHash);

    if (changed.length === 0) {
      tddLog(tddDir, "DEBUG", "tool_result: no changes in this bash command");
      return;
    }

    // Config files (.pi/tdd/) are always violations when TDD is active
    const tddViolations = changed.filter((f) => f.startsWith(".pi/tdd/"));

    if (phase === "refactor") {
      // In refactor, only .pi/tdd/ files are violations
      if (tddViolations.length === 0) {
        tddLog(tddDir, "DEBUG", "tool_result: refactor phase, no TDD dir violations");
        return;
      }
    }

    const phaseViolations =
      phase === "refactor" ? [] : changed.filter((f) => !isAllowed(f, phase, config));

    const cmdViolations = [...new Set([...tddViolations, ...phaseViolations])];

    if (cmdViolations.length === 0) {
      tddLog(tddDir, "DEBUG", "tool_result: no violations among changed files", {
        changed,
      });
      return;
    }

    tddLog(tddDir, "WARN", "tool_result: locked files modified by bash", {
      phase,
      violations: cmdViolations,
    });

    // Revert only this command's violations back to pre-bash state
    restoreFilesTo(root, cmdViolations, stashHash);

    // Find remaining allowed changes from this command (exclude .pi/tdd/)
    const cmdAllowed = changed.filter(
      (f) => isAllowed(f, phase, config) && !f.startsWith(".pi/tdd/"),
    );

    const existingText = event.content.map((c) => ("text" in c ? c.text : "")).join("");
    let warning = `\n\n⛔ ${phase.toUpperCase()}: reverted locked files modified by bash:`;
    cmdViolations.forEach((f) => (warning += `\n  - ${f}`));
    if (cmdAllowed.length > 0) {
      warning += `\n\nAllowed changes retained:`;
      cmdAllowed.forEach((f) => (warning += `\n  - ${f}`));
    }

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: existingText + warning,
        },
      ],
    };
  });
}

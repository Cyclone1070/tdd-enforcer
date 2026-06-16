import { Type } from "typebox";
import { execSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  savePhaseState,
  nextPhase,
  checkGate,
  getDisallowedChanges,
  snapshot,
  hasParent,
  resetHard,
  undoLastCommit,
} from "../../engine/index.js";
import type { TestRunner, Phase } from "../../engine/index.js";
import { getNudgePrompt } from "./prompts.js";
import { loadTddState } from "./helpers.js";

const PREV: Record<string, Phase> = { green: "red", refactor: "green", red: "refactor" };

export function registerTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "next_tdd_phase",
    label: "Next TDD Phase",
    description:
      "Advance to the next TDD phase. Runs transition gates (test pass/fail checks) " +
      "and allowlist validation (no forbidden files modified).",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const root = ctx.cwd;
      const tdd = loadTddState(root);
      if (!tdd.ok) {
        return { content: [{ type: "text", text: `TDD: ${tdd.reason}` }], details: {} };
      }

      const { state, config } = tdd;
      const from = state.current;
      const to = nextPhase(from);
      if (!to) {
        return { content: [{ type: "text", text: `No next phase from ${from}.` }], details: {} };
      }

      // 1. Allowlist check
      const violations = getDisallowedChanges(root, from, config);
      if (violations.length > 0) {
        return {
          content: [
            {
              type: "text",
              text:
                `BLOCKED: files not allowed in ${from.toUpperCase()} phase:\n` +
                violations.map((f) => `  - ${f}`).join("\n") +
                "\nRevert or remove them before proceeding.",
            },
          ],
          details: {},
        };
      }

      // 2. Gate check
      const testRunner: TestRunner = async (commands, timeout) => {
        const results = await Promise.all(
          commands.map(async (cmd) => {
            try {
              execSync(cmd, { cwd: root, stdio: "pipe", timeout: timeout * 1000 });
              return { command: cmd, passed: true };
            } catch {
              return { command: cmd, passed: false };
            }
          }),
        );

        const failed = results.filter((r) => !r.passed);
        if (failed.length > 0) {
          return {
            passed: false,
            message: "Tests failed:\n" + failed.map((f) => `  - ${f.command}`).join("\n"),
          };
        }
        return { passed: true, message: "All tests passed." };
      };

      const gate = await checkGate(from, to, testRunner, config);
      if (!gate.passed) {
        return { content: [{ type: "text", text: gate.message }], details: {} };
      }

      // 3. Snapshot
      snapshot(root, to);

      // 4. Save state
      state.current = to;
      savePhaseState(root, state);

      return {
        content: [{ type: "text", text: getNudgePrompt(to, config) }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "previous_tdd_phase",
    label: "Previous TDD Phase",
    description:
      "WARNING: Destroys ALL uncommitted changes and pops the last snapshot commit. " +
      "Working tree keeps the popped commit's content as unstaged changes.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const root = ctx.cwd;
      const tdd = loadTddState(root);
      if (!tdd.ok) {
        return { content: [{ type: "text", text: `TDD: ${tdd.reason}` }], details: {} };
      }

      const { state } = tdd;

      if (!hasParent(root)) {
        return {
          content: [{ type: "text", text: "No previous phase to revert to." }],
          details: {},
        };
      }

      const prevPhase = PREV[state.current];
      if (!prevPhase) {
        return {
          content: [{ type: "text", text: "Already at RED — no previous phase." }],
          details: {},
        };
      }

      // 1. Nuke any uncommitted changes, WT matches HEAD
      resetHard(root);

      // 2. Pop last snapshot commit, keep its content as unstaged
      undoLastCommit(root);

      // 3. Update phase label
      state.current = prevPhase;
      savePhaseState(root, state);

      return {
        content: [
          {
            type: "text",
            text: `Reverted to ${prevPhase.toUpperCase()}. Working tree has the previous snapshot content as unstaged changes.`,
          },
        ],
        details: {},
      };
    },
  });
}

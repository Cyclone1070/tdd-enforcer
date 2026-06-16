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
  headMessage,
} from "../../engine/index.js";
import type { TestRunner, Phase } from "../../engine/index.js";
import { getNudgePrompt } from "./prompts.js";
import { loadTddState } from "./helpers.js";


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
      const tddDir = join(root, ".pi", "tdd");
      const tdd = loadTddState(root);
      if (!tdd.ok) {
        tddLog(tddDir, "WARN", "next_tdd_phase: TDD not active", { reason: tdd.reason });
        return { content: [{ type: "text", text: `TDD: ${tdd.reason}` }], details: {} };
      }

      const { state, config } = tdd;
      const from = state.current;
      const to = nextPhase(from);
      if (!to) {
        tddLog(tddDir, "WARN", "next_tdd_phase: no next phase", { from });
        return { content: [{ type: "text", text: `No next phase from ${from}.` }], details: {} };
      }

      tddLog(tddDir, "INFO", "next_tdd_phase: starting", { from, to });

      // 1. Allowlist check
      const violations = getDisallowedChanges(root, from, config);
      if (violations.length > 0) {
        tddLog(tddDir, "WARN", "next_tdd_phase: blocked by allowlist", {
          from,
          violations,
        });
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
      tddLog(tddDir, "DEBUG", "next_tdd_phase: gate result", {
        from,
        to,
        passed: gate.passed,
        message: gate.message,
      });

      if (!gate.passed) {
        return { content: [{ type: "text", text: gate.message }], details: {} };
      }

      // 3. Snapshot — label with the phase the work was done in
      const hash = snapshot(root, from);
      tddLog(tddDir, "INFO", "next_tdd_phase: snapshot created", {
        from,
        to,
        hash,
      });

      // 4. Save state
      state.current = to;
      savePhaseState(root, state);
      tddLog(tddDir, "INFO", "next_tdd_phase: complete", { from, to });

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
      const tddDir = join(root, ".pi", "tdd");
      const tdd = loadTddState(root);
      if (!tdd.ok) {
        tddLog(tddDir, "WARN", "previous_tdd_phase: TDD not active", {
          reason: tdd.reason,
        });
        return { content: [{ type: "text", text: `TDD: ${tdd.reason}` }], details: {} };
      }

      const { state } = tdd;

      if (!hasParent(root)) {
        tddLog(tddDir, "WARN", "previous_tdd_phase: no parent commit", {
          phase: state.current,
        });
        return {
          content: [{ type: "text", text: "No previous phase to revert to." }],
          details: {},
        };
      }

      // Read phase from HEAD snapshot commit message (source of truth).
      // Snapshot is labeled with the phase the work was done in, so we use
      // it directly — no hardcoded phase map needed.
      const headMsg = headMessage(root);
      const phaseMatch = headMsg.match(/^tdd: (red|green|refactor)/);
      if (!phaseMatch) {
        tddLog(tddDir, "ERROR", "previous_tdd_phase: invalid HEAD message", {
          headMsg,
        });
        return {
          content: [
            {
              type: "text",
              text: `HEAD commit "${headMsg}" is not a TDD snapshot. Cannot determine previous phase.\n` +
                    `The private git repo at .pi/tdd must not be manually modified. ` +
                    `Tampering with it will cause TDD state corruption.`,
            },
          ],
          details: {},
        };
      }
      const prevPhase = phaseMatch[1] as Phase;
      tddLog(tddDir, "INFO", "previous_tdd_phase: reverting", {
        from: state.current,
        to: prevPhase,
        headMsg,
      });

      // 1. Nuke any uncommitted changes, WT matches HEAD
      resetHard(root);
      tddLog(tddDir, "DEBUG", "previous_tdd_phase: resetHard done");

      // 2. Pop last snapshot commit, keep its content as unstaged
      undoLastCommit(root);
      tddLog(tddDir, "DEBUG", "previous_tdd_phase: undoLastCommit done");

      // 3. Update phase label from the snapshot's own label
      state.current = prevPhase;
      savePhaseState(root, state);
      tddLog(tddDir, "INFO", "previous_tdd_phase: complete", {
        to: prevPhase,
      });

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

  pi.registerTool({
    name: "tdd_status",
    label: "TDD Status",
    description:
      "Show the current TDD enforcement status: enabled/disabled, current phase, " +
      "allowed file globs, and test commands.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const root = ctx.cwd;
      const tddDir = join(root, ".pi", "tdd");
      const result = loadTddState(root);

      if (!result.ok) {
        tddLog(tddDir, "WARN", "tdd_status: TDD not active", {
          reason: result.reason,
        });
        return { content: [{ type: "text", text: `TDD: ${result.reason}` }], details: {} };
      }

      const { state, config } = result;
      const phaseStr = state.current.toUpperCase();
      const redGlobs = config.allowedRedPhaseFiles.join(", ") || "(none)";
      const greenGlobs = config.allowedGreenPhaseFiles.join(", ") || "(none)";
      const commands = config.testCommands.join(", ") || "(none)";

      tddLog(tddDir, "INFO", "tdd_status: queried", {
        phase: state.current,
      });

      return {
        content: [
          {
            type: "text",
            text:
              `TDD enforcer enabled\n` +
              `Current phase: ${phaseStr}\n` +
              `Test files: ${redGlobs}\n` +
              `Impl files: ${greenGlobs}\n` +
              `Test commands: ${commands}`,
          },
        ],
        details: {
          enabled: true,
          phase: state.current,
          allowedRedPhaseFiles: config.allowedRedPhaseFiles,
          allowedGreenPhaseFiles: config.allowedGreenPhaseFiles,
          testCommands: config.testCommands,
        },
      };
    },
  });
}

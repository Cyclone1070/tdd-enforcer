import type { Phase, Config, Transition } from "./types.js";
import { PHASE_CYCLE } from "./types.js";
import { changesSinceSnapshot } from "./git.js";
import { disallowedFiles } from "./enforce.js";

/**
 * Get the next phase in the cycle.
 */
export function nextPhase(current: Phase): Phase | null {
  return PHASE_CYCLE[current] ?? null;
}

export interface GateResult {
  passed: boolean;
  message: string;
}

export type TestRunner = (commands: string[], timeoutSeconds: number) => Promise<GateResult>;

/**
 * Run the transition gate check.
 * - RED→GREEN: tests must fail (all non-zero exit)
 * - GREEN→REFACTOR: tests must pass (all zero exit)
 * - REFACTOR→RED: tests must pass (all zero exit)
 */
export async function checkGate(
  from: Phase,
  to: Phase,
  testRunner: TestRunner,
  config: Config,
): Promise<GateResult> {
  const result = await testRunner(config.testCommands, config.timeoutSeconds);

  switch (`${from}→${to}` as Transition) {
    case "red→green":
      if (result.passed) {
        return {
          passed: false,
          message: "Tests pass. Break a test first before transitioning to GREEN.",
        };
      }
      return { passed: true, message: "Tests fail — proceed to GREEN." };

    case "green→refactor":
    case "refactor→red":
      if (!result.passed) {
        return {
          passed: false,
          message: "Tests must pass before transitioning. Fix failing tests first.",
        };
      }
      return { passed: true, message: "All tests pass — proceeding." };

    default:
      return { passed: false, message: `Unknown transition: ${from}→${to}` };
  }
}

/**
 * Validate that no disallowed files have been modified since the phase snapshot.
 * Returns list of violating files (empty = ok).
 */
export function getDisallowedChanges(
  projectRoot: string,
  phase: Phase,
  config: Config,
): string[] {
  if (phase === "refactor") return [];

  const changed = changesSinceSnapshot(projectRoot);
  return disallowedFiles(changed, phase, config);
}

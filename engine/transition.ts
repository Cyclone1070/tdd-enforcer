import { disallowedFiles } from "./enforce.js";
import { changesSinceSnapshot } from "./git.js";
import type { Config, Phase, Transition } from "./types.js";
import { PHASE_CYCLE } from "./types.js";

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

export type TestRunner = (
	commands: string[],
	timeoutSeconds: number,
) => Promise<GateResult>;

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
					message:
						"Tests passed. Add a failing test before transitioning to GREEN.",
				};
			}
			return { passed: true, message: "Tests fail — proceed to GREEN." };

		case "green→refactor":
			if (!result.passed) {
				return {
					passed: false,
					message: "Tests failed. Fix them before transitioning to REFACTOR.",
				};
			}
			return { passed: true, message: "All tests pass — proceeding." };

		case "refactor→red":
			if (!result.passed) {
				return {
					passed: false,
					message: "Tests failed. Fix them before transitioning to RED.",
				};
			}
			return { passed: true, message: "All tests pass — proceeding." };
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
	deps: {
		changesSinceSnapshot: typeof changesSinceSnapshot;
		disallowedFiles: typeof disallowedFiles;
	} = {
		changesSinceSnapshot,
		disallowedFiles,
	},
): string[] {
	if (phase === "refactor") return [];

	const changed = deps.changesSinceSnapshot(projectRoot);
	return deps.disallowedFiles(changed, phase, config);
}

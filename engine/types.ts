export type Phase = "red" | "green";

export interface PhaseState {
	enabled: boolean;
	current: Phase;
}

export interface Config {
	blockedInRed: string[];
	blockedInGreen: string[];
	testCommands: string[];
	timeoutSeconds: number;
}

export type Transition = "red→green" | "green→red";

export const PHASE_CYCLE: Record<Phase, Phase | null> = {
	red: "green",
	green: "red",
};

/** Type guard for the phases the enforcer understands. */
export function isPhase(value: unknown): value is Phase {
	return typeof value === "string" && Object.hasOwn(PHASE_CYCLE, value);
}

/**
 * Parse a private-git commit message into a phase.
 * Returns null for anything that is not a live TDD phase label.
 */
export function parseTddLabel(message: string): Phase | null {
	const label = message.match(/^tdd:\s*(\S+)/)?.[1];
	return label !== undefined && isPhase(label) ? label : null;
}

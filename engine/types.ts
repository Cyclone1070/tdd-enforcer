export type Phase = "red" | "green" | "refactor";

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

export type Transition = "red→green" | "green→refactor" | "refactor→red";

export const PHASE_CYCLE: Record<Phase, Phase | null> = {
	red: "green",
	green: "refactor",
	refactor: "red",
};

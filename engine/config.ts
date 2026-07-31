import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./types.js";

const TDD_DIR = ".pi/tdd";

export function configPath(projectRoot: string): string {
	return join(projectRoot, TDD_DIR, "rules.json");
}

export function loadConfig(projectRoot: string): Config {
	const path = configPath(projectRoot);
	const raw = readFileSync(path, "utf-8");
	const parsed = JSON.parse(raw);

	if (!Array.isArray(parsed.blockedInRed) || parsed.blockedInRed.length === 0) {
		throw new Error("rules.json: blockedInRed must be a non-empty array");
	}
	if (!parsed.blockedInRed.every((p: unknown) => typeof p === "string")) {
		throw new Error("rules.json: blockedInRed must contain only strings");
	}
	if (
		!Array.isArray(parsed.blockedInGreen) ||
		parsed.blockedInGreen.length === 0
	) {
		throw new Error("rules.json: blockedInGreen must be a non-empty array");
	}
	if (!parsed.blockedInGreen.every((p: unknown) => typeof p === "string")) {
		throw new Error("rules.json: blockedInGreen must contain only strings");
	}
	if (!Array.isArray(parsed.testCommands) || parsed.testCommands.length === 0) {
		throw new Error("rules.json: testCommands must be a non-empty array");
	}
	if (!parsed.testCommands.every((p: unknown) => typeof p === "string")) {
		throw new Error("rules.json: testCommands must contain only strings");
	}

	return {
		blockedInRed: parsed.blockedInRed,
		blockedInGreen: parsed.blockedInGreen,
		testCommands: parsed.testCommands,
		timeoutSeconds: parsed.timeoutSeconds ?? 120,
	};
}

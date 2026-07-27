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

	// Accept both new (implFiles/testFiles) and old (blockedInRed/blockedInGreen) names
	const implFilesField = "implFiles" in parsed ? "implFiles" : "blockedInRed";
	const testFilesField = "testFiles" in parsed ? "testFiles" : "blockedInGreen";
	const implFiles = parsed.implFiles ?? parsed.blockedInRed;
	const testFiles = parsed.testFiles ?? parsed.blockedInGreen;

	if (!Array.isArray(implFiles) || implFiles.length === 0) {
		throw new Error(`rules.json: ${implFilesField} must be a non-empty array`);
	}
	if (!implFiles.every((p: unknown) => typeof p === "string")) {
		throw new Error(`rules.json: ${implFilesField} must contain only strings`);
	}
	if (!Array.isArray(testFiles) || testFiles.length === 0) {
		throw new Error(`rules.json: ${testFilesField} must be a non-empty array`);
	}
	if (!testFiles.every((p: unknown) => typeof p === "string")) {
		throw new Error(`rules.json: ${testFilesField} must contain only strings`);
	}
	if (!Array.isArray(parsed.testCommands) || parsed.testCommands.length === 0) {
		throw new Error("rules.json: testCommands must be a non-empty array");
	}
	if (!parsed.testCommands.every((p: unknown) => typeof p === "string")) {
		throw new Error("rules.json: testCommands must contain only strings");
	}

	return {
		implFiles,
		testFiles,
		testCommands: parsed.testCommands,
		timeoutSeconds: parsed.timeoutSeconds ?? 120,
	};
}

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { headMessage, snapshot } from "./git.js";
import { revertPhase } from "./orchestrate.js";
import { loadPhaseState, loadTddState, savePhaseState } from "./state.js";

const RULES = {
	blockedInRed: ["src/**/*.ts", "!src/**/*.test.ts"],
	blockedInGreen: ["**/*.test.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

let root: string;

beforeEach(() => {
	// Git identity for real commits — CI runners have no global config.
	process.env.GIT_AUTHOR_NAME ??= "tdd-test";
	process.env.GIT_AUTHOR_EMAIL ??= "tdd@test.local";
	process.env.GIT_COMMITTER_NAME ??= "tdd-test";
	process.env.GIT_COMMITTER_EMAIL ??= "tdd@test.local";

	root = join(tmpdir(), `tdd-state-integration-${Date.now()}-${Math.random()}`);
	mkdirSync(join(root, ".pi", "tdd"), { recursive: true });
	writeFileSync(join(root, ".pi", "tdd", "rules.json"), JSON.stringify(RULES));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("loadTddState with real git", () => {
	it("creates a fresh baseline on first load", () => {
		const result = loadTddState(root);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.state).toEqual({ enabled: false, current: "red" });
		expect(result.repaired).toBeUndefined();
		expect(headMessage(root)).toBe("tdd: init");
		expect(loadPhaseState(root).current).toBe("red");
	});
});

describe("legacy refactor state with real git", () => {
	it("nukes the corrupt history and rebuilds a RED baseline", () => {
		loadTddState(root);

		// Fabricate the old three-phase world: legacy state value + label.
		writeFileSync(
			join(root, ".pi", "tdd", "state.json"),
			JSON.stringify({ enabled: true, current: "refactor" }),
		);
		snapshot(root, "refactor");
		expect(headMessage(root)).toBe("tdd: refactor");

		const result = loadTddState(root);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.state).toEqual({ enabled: true, current: "red" });
		expect(result.repaired).toContain("tdd: refactor");
		expect(headMessage(root)).toBe("tdd: red");
		expect(loadPhaseState(root)).toEqual({ current: "red", enabled: true });
	});
});

describe("broken private git with real fs", () => {
	it("nukes and rebuilds a RED baseline, preserving enabled", () => {
		loadTddState(root);
		snapshot(root, "red");
		savePhaseState(root, { enabled: true, current: "green" });

		// Corrupt the git dir so real git commands fail.
		writeFileSync(join(root, ".pi", "tdd", ".git", "HEAD"), "garbage\n");

		const result = loadTddState(root);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.repaired).toBeDefined();
		expect(result.state).toEqual({ enabled: true, current: "red" });
		expect(headMessage(root)).toBe("tdd: red");
	});
});

describe("revertPhase with real git", () => {
	it("pops the last snapshot on healthy history", async () => {
		loadTddState(root);
		snapshot(root, "red");
		savePhaseState(root, { enabled: true, current: "green" });

		const result = await revertPhase(root, { enabled: true, current: "green" });
		expect(result.ok).toBe(true);
		expect(result.message).toBe("Reverted to RED.");
		expect(headMessage(root)).toBe("tdd: init");
		expect(loadPhaseState(root)).toEqual({ current: "red", enabled: true });
	});

	it("rebuilds a RED baseline when the HEAD label is corrupt", async () => {
		loadTddState(root);
		snapshot(root, "refactor");

		const result = await revertPhase(root, { enabled: true, current: "green" });
		expect(result.ok).toBe(true);
		expect(result.message).toMatch(/corrupt/i);
		expect(result.newState).toEqual({ enabled: true, current: "red" });
		expect(headMessage(root)).toBe("tdd: red");
	});
});

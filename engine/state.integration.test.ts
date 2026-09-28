import {
	existsSync,
	mkdirSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { headMessage, modifiedFiles, snapshot } from "./git.js";
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
	mkdirSync(join(root, ".tdd"), { recursive: true });
	writeFileSync(join(root, ".tdd", "rules.json"), JSON.stringify(RULES));
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
			join(root, ".tdd", "state.json"),
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
		writeFileSync(join(root, ".tdd", ".git", "HEAD"), "garbage\n");

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

describe("legacy .pi/tdd layout with real git", () => {
	it("keeps working when only .pi/tdd exists", () => {
		const legacyRoot = join(
			tmpdir(),
			`tdd-legacy-${Date.now()}-${Math.random()}`,
		);
		mkdirSync(join(legacyRoot, ".pi", "tdd"), { recursive: true });
		writeFileSync(
			join(legacyRoot, ".pi", "tdd", "rules.json"),
			JSON.stringify(RULES),
		);

		try {
			const result = loadTddState(legacyRoot);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.warning).toBeUndefined();

			savePhaseState(legacyRoot, { enabled: true, current: "green" });
			expect(existsSync(join(legacyRoot, ".pi", "tdd", "state.json"))).toBe(
				true,
			);
			expect(existsSync(join(legacyRoot, ".tdd"))).toBe(false);
		} finally {
			rmSync(legacyRoot, { recursive: true, force: true });
		}
	});
});

describe("migrating .pi/tdd to .tdd", () => {
	it("keeps state and snapshot history across the directory move", () => {
		const legacyRoot = join(
			tmpdir(),
			`tdd-migrate-${Date.now()}-${Math.random()}`,
		);
		mkdirSync(join(legacyRoot, ".pi", "tdd"), { recursive: true });
		writeFileSync(
			join(legacyRoot, ".pi", "tdd", "rules.json"),
			JSON.stringify(RULES),
		);

		try {
			// Live legacy project: enabled, GREEN, with one snapshot in history.
			loadTddState(legacyRoot);
			savePhaseState(legacyRoot, { enabled: true, current: "green" });
			snapshot(legacyRoot, "green");
			expect(headMessage(legacyRoot)).toBe("tdd: green");

			// The documented migration: turn TDD off, move the directory,
			// turn it back on.
			savePhaseState(legacyRoot, { enabled: false, current: "green" });
			renameSync(join(legacyRoot, ".pi", "tdd"), join(legacyRoot, ".tdd"));

			const moved = loadTddState(legacyRoot);
			expect(moved.ok).toBe(true);
			if (!moved.ok) return;
			expect(moved.state).toEqual({ enabled: false, current: "green" });
			expect(moved.warning).toBeUndefined();
			expect(headMessage(legacyRoot)).toBe("tdd: green");

			// Until the next snapshot the private repo still tracks the old
			// bookkeeping paths, so it reports them as deleted.
			expect(modifiedFiles(legacyRoot)).toContain(".pi/tdd/.gitignore");

			// Enabling again is what the adapter does: snapshot, then enable.
			snapshot(legacyRoot, moved.state.current);
			savePhaseState(legacyRoot, { enabled: true, current: "green" });

			const result = loadTddState(legacyRoot);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.state).toEqual({ enabled: true, current: "green" });
			expect(loadPhaseState(legacyRoot)).toEqual({
				enabled: true,
				current: "green",
			});
			expect(headMessage(legacyRoot)).toBe("tdd: green");

			// The private repo now tracks the new layout only: the old paths are
			// gone from the tree, so a hard reset can no longer resurrect them.
			// (state.json differs from the snapshot because enabling rewrote it.)
			const tracked = modifiedFiles(legacyRoot);
			expect(tracked.some((file) => file.startsWith(".pi/tdd"))).toBe(false);
		} finally {
			rmSync(legacyRoot, { recursive: true, force: true });
		}
	});
});

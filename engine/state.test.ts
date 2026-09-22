import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPhaseState, loadTddState, savePhaseState } from "./state.js";

function withTempDir(fn: (dir: string) => void) {
	const dir = join(tmpdir(), `tdd-state-test-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	try {
		fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function withStateFile(raw: string, fn: (dir: string) => void) {
	withTempDir((dir) => {
		const tddDir = join(dir, ".pi", "tdd");
		mkdirSync(tddDir, { recursive: true });
		writeFileSync(join(tddDir, "state.json"), raw, "utf-8");
		fn(dir);
	});
}

// ── loadPhaseState ─────────────────────────────────────────────────────────

describe("loadPhaseState", () => {
	it("returns empty state when no file exists", () => {
		withTempDir((dir) => {
			expect(loadPhaseState(dir)).toEqual({ current: null, enabled: false });
		});
	});

	it("returns parsed state from state.json", () => {
		withStateFile(
			JSON.stringify({ enabled: true, current: "green" }),
			(dir) => {
				expect(loadPhaseState(dir)).toEqual({
					current: "green",
					enabled: true,
				});
			},
		);
	});

	it("returns null phase for an invalid phase name", () => {
		withStateFile(
			JSON.stringify({ enabled: true, current: "blurple" }),
			(dir) => {
				expect(loadPhaseState(dir)).toEqual({ current: null, enabled: true });
			},
		);
	});

	it("returns null phase for the old 'refactor' value", () => {
		withStateFile(
			JSON.stringify({ enabled: true, current: "refactor" }),
			(dir) => {
				expect(loadPhaseState(dir)).toEqual({ current: null, enabled: true });
			},
		);
	});

	it("returns null phase for the old 'off' value", () => {
		withStateFile(JSON.stringify({ enabled: false, current: "off" }), (dir) => {
			expect(loadPhaseState(dir)).toEqual({ current: null, enabled: false });
		});
	});

	it("normalises non-boolean enabled to false", () => {
		withStateFile(JSON.stringify({ enabled: "yes", current: "red" }), (dir) => {
			expect(loadPhaseState(dir)).toEqual({ current: "red", enabled: false });
		});
	});

	it("returns empty state for malformed JSON", () => {
		withStateFile("not json{{{", (dir) => {
			expect(loadPhaseState(dir)).toEqual({ current: null, enabled: false });
		});
	});

	it("returns empty state for non-object JSON", () => {
		withStateFile("null", (dir) => {
			expect(loadPhaseState(dir)).toEqual({ current: null, enabled: false });
		});
	});
});

describe("savePhaseState", () => {
	it("writes state.json that can be read back", () => {
		withTempDir((dir) => {
			savePhaseState(dir, { enabled: true, current: "green" });
			expect(loadPhaseState(dir)).toEqual({ current: "green", enabled: true });
		});
	});
});

// ── loadTddState ────────────────────────────────────────────────────────────

const validRules = {
	blockedInRed: ["tests/**/*.test.ts"],
	blockedInGreen: ["src/**/*.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

describe("loadTddState", () => {
	let mockExistsSync: ReturnType<typeof vi.fn>;
	let mockLoadConfig: ReturnType<typeof vi.fn>;
	let mockInitGit: ReturnType<typeof vi.fn>;
	let mockLoadPhaseState: ReturnType<typeof vi.fn>;
	let mockSavePhaseState: ReturnType<typeof vi.fn>;
	let mockHeadMessage: ReturnType<typeof vi.fn>;
	let mockHasParent: ReturnType<typeof vi.fn>;
	let mockResetGit: ReturnType<typeof vi.fn>;
	let mockSnapshot: ReturnType<typeof vi.fn>;
	let mockStageFiles: ReturnType<typeof vi.fn>;

	function makeDeps(overrides = {}) {
		return {
			existsSync: mockExistsSync,
			loadConfig: mockLoadConfig,
			initGit: mockInitGit,
			loadPhaseState: mockLoadPhaseState,
			savePhaseState: mockSavePhaseState,
			headMessage: mockHeadMessage,
			hasParent: mockHasParent,
			resetGit: mockResetGit,
			snapshot: mockSnapshot,
			stageFiles: mockStageFiles,
			...overrides,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockExistsSync = vi.fn().mockReturnValue(true);
		mockLoadConfig = vi.fn().mockReturnValue(validRules);
		mockInitGit = vi.fn();
		mockLoadPhaseState = vi.fn().mockReturnValue({
			current: "red",
			enabled: true,
		});
		mockSavePhaseState = vi.fn();
		mockHeadMessage = vi.fn().mockReturnValue("tdd: red");
		mockHasParent = vi.fn().mockReturnValue(true);
		mockResetGit = vi.fn();
		mockSnapshot = vi.fn();
		mockStageFiles = vi.fn();
	});

	it("returns missing dir error when .pi/tdd does not exist", () => {
		mockExistsSync.mockReturnValue(false);
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("Missing .pi/tdd/");
	});

	it("returns missing rules.json error when only dir exists", () => {
		mockExistsSync.mockImplementation(
			(path: string) => !path.includes("rules.json"),
		);
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("rules.json");
	});

	it("returns invalid rules.json error for malformed JSON", () => {
		mockLoadConfig.mockImplementation(() => {
			throw new Error("Unexpected token");
		});
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(false);
		if (!result.ok)
			expect(result.reason).toContain("Invalid .pi/tdd/rules.json");
	});

	it("initialises git when the private repo is missing", () => {
		let gitExists = false;
		mockExistsSync.mockImplementation(
			(path: string) => !path.includes(".git") || gitExists,
		);
		mockInitGit.mockImplementation(() => {
			gitExists = true;
		});
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		expect(mockInitGit).toHaveBeenCalled();
	});

	it("returns ok with state and config when everything is valid", () => {
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state).toEqual({ enabled: true, current: "red" });
			expect(result.config.testCommands).toEqual(["npm test"]);
			expect(result.repaired).toBeUndefined();
		}
	});

	it("does not save or stage when state.json is valid", () => {
		loadTddState("/test", makeDeps());
		expect(mockSavePhaseState).not.toHaveBeenCalled();
		expect(mockStageFiles).not.toHaveBeenCalled();
	});

	it("repairs when git throws", () => {
		mockLoadPhaseState.mockReturnValue({ current: null, enabled: false });
		mockHeadMessage.mockImplementation(() => {
			throw new Error("fatal: not a git repository");
		});
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state).toEqual({ enabled: false, current: "red" });
			expect(result.repaired).toMatch(/not a git repository/);
		}
		expect(mockResetGit).toHaveBeenCalledWith("/test");
		expect(mockSnapshot).toHaveBeenCalledWith("/test", "red");
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: false,
			current: "red",
		});
		expect(mockStageFiles).toHaveBeenCalledWith("/test", [
			".pi/tdd/state.json",
		]);
	});

	it("repairs when HEAD is not a TDD snapshot", () => {
		mockLoadPhaseState.mockReturnValue({ current: null, enabled: false });
		mockHeadMessage.mockReturnValue("some random commit");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.repaired).toContain("some random commit");
			expect(result.state.current).toBe("red");
		}
		expect(mockResetGit).toHaveBeenCalled();
	});

	it("repairs when HEAD is the legacy refactor label", () => {
		mockLoadPhaseState.mockReturnValue({ current: null, enabled: true });
		mockHeadMessage.mockReturnValue("tdd: refactor");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state).toEqual({ enabled: true, current: "red" });
			expect(result.repaired).toContain("tdd: refactor");
		}
		expect(mockResetGit).toHaveBeenCalled();
	});

	it("repairs even when state.json is valid", () => {
		mockLoadPhaseState.mockReturnValue({ current: "green", enabled: true });
		mockHeadMessage.mockReturnValue("garbage");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state).toEqual({ enabled: true, current: "red" });
		}
		expect(mockResetGit).toHaveBeenCalled();
	});

	it("recovers enabled green from HEAD tdd:red when state.json has no phase", () => {
		mockLoadPhaseState.mockReturnValue({ current: null, enabled: false });
		mockHeadMessage.mockReturnValue("tdd: red");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state).toEqual({ enabled: true, current: "green" });
		}
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "green",
		});
		expect(mockStageFiles).toHaveBeenCalledWith("/test", [
			".pi/tdd/state.json",
		]);
	});

	it("recovers enabled red from HEAD tdd:green when state.json has no phase", () => {
		mockLoadPhaseState.mockReturnValue({ current: null, enabled: false });
		mockHeadMessage.mockReturnValue("tdd: green");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state).toEqual({ enabled: true, current: "red" });
		}
	});

	it("treats a root commit as a fresh baseline", () => {
		mockLoadPhaseState.mockReturnValue({ current: null, enabled: false });
		mockHeadMessage.mockReturnValue("tdd: init");
		mockHasParent.mockReturnValue(false);
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state).toEqual({ enabled: false, current: "red" });
			expect(result.repaired).toBeUndefined();
		}
		expect(mockResetGit).not.toHaveBeenCalled();
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: false,
			current: "red",
		});
	});

	it("lets a valid state.json phase win over a healthy git label", () => {
		mockLoadPhaseState.mockReturnValue({ current: "green", enabled: false });
		mockHeadMessage.mockReturnValue("tdd: red");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state).toEqual({ enabled: false, current: "green" });
		}
		expect(mockSavePhaseState).not.toHaveBeenCalled();
	});

	it("ignores a mismatched but valid git label", () => {
		mockLoadPhaseState.mockReturnValue({ current: "red", enabled: true });
		mockHeadMessage.mockReturnValue("tdd: green");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state).toEqual({ enabled: true, current: "red" });
		}
		expect(mockResetGit).not.toHaveBeenCalled();
	});
});

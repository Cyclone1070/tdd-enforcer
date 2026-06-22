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

describe("loadPhaseState", () => {
	it("throws when no file exists", () => {
		withTempDir((dir) => {
			expect(() => loadPhaseState(dir)).toThrow();
		});
	});

	it("returns parsed state from state.json", () => {
		withTempDir((dir) => {
			const tddDir = join(dir, ".pi", "tdd");
			mkdirSync(tddDir, { recursive: true });
			writeFileSync(
				join(tddDir, "state.json"),
				JSON.stringify({ enabled: true, current: "green" }),
				"utf-8",
			);
			const state = loadPhaseState(dir);
			expect(state.enabled).toBe(true);
			expect(state.current).toBe("green");
		});
	});

	it("throws when current is an invalid phase", () => {
		withTempDir((dir) => {
			const tddDir = join(dir, ".pi", "tdd");
			mkdirSync(tddDir, { recursive: true });
			writeFileSync(
				join(tddDir, "state.json"),
				JSON.stringify({ enabled: true, current: "blurple" }),
				"utf-8",
			);
			expect(() => loadPhaseState(dir)).toThrow();
		});
	});

	it("throws when current is the old 'off' value", () => {
		withTempDir((dir) => {
			const tddDir = join(dir, ".pi", "tdd");
			mkdirSync(tddDir, { recursive: true });
			writeFileSync(
				join(tddDir, "state.json"),
				JSON.stringify({ enabled: false, current: "off" }),
				"utf-8",
			);
			expect(() => loadPhaseState(dir)).toThrow();
		});
	});

	it("throws on malformed JSON", () => {
		withTempDir((dir) => {
			const tddDir = join(dir, ".pi", "tdd");
			mkdirSync(tddDir, { recursive: true });
			writeFileSync(join(tddDir, "state.json"), "not json{{{", "utf-8");
			expect(() => loadPhaseState(dir)).toThrow();
		});
	});
});

describe("savePhaseState", () => {
	it("writes state.json and can be read back", () => {
		withTempDir((dir) => {
			savePhaseState(dir, { enabled: true, current: "refactor" });
			const state = loadPhaseState(dir);
			expect(state.enabled).toBe(true);
			expect(state.current).toBe("refactor");
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

const validPhase = {
	enabled: true,
	current: "red",
};

describe("loadTddState", () => {
	let mockExistsSync: ReturnType<typeof vi.fn>;
	let mockLoadConfig: ReturnType<typeof vi.fn>;
	let mockInitGit: ReturnType<typeof vi.fn>;
	let mockLoadPhaseState: ReturnType<typeof vi.fn>;
	let mockSavePhaseState: ReturnType<typeof vi.fn>;
	let mockHeadMessage: ReturnType<typeof vi.fn>;
	let mockNextPhase: ReturnType<typeof vi.fn>;
	let mockStageFiles: ReturnType<typeof vi.fn>;

	const realNextPhase = (p: string) =>
		p === "red"
			? "green"
			: p === "green"
				? "refactor"
				: p === "refactor"
					? "red"
					: null;

	function makeDeps(overrides = {}) {
		return {
			existsSync: mockExistsSync,
			loadConfig: mockLoadConfig,
			initGit: mockInitGit,
			loadPhaseState: mockLoadPhaseState,
			savePhaseState: mockSavePhaseState,
			headMessage: mockHeadMessage,
			nextPhase: mockNextPhase,
			stageFiles: mockStageFiles,
			...overrides,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockExistsSync = vi.fn().mockImplementation((path: string) => {
			if (path.includes(".git")) return false;
			if (path.includes(".pi/tdd")) return true;
			return true;
		});
		mockLoadConfig = vi.fn().mockReturnValue(validRules);
		mockInitGit = vi.fn();
		mockLoadPhaseState = vi.fn().mockReturnValue(validPhase);
		mockSavePhaseState = vi.fn();
		mockHeadMessage = vi.fn().mockReturnValue("tdd: red");
		mockNextPhase = vi.fn().mockImplementation(realNextPhase);
		mockStageFiles = vi.fn();
	});

	it("returns missing dir error when .pi/tdd does not exist", () => {
		mockExistsSync.mockReturnValue(false);
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("Missing .pi/tdd/");
	});

	it("returns missing rules.json error when only dir exists", () => {
		mockExistsSync.mockImplementation((path: string) => {
			if (path.includes("rules.json")) return false;
			if (path.includes(".pi/tdd")) return true;
			return false;
		});
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("rules.json");
	});

	it("auto-creates state.json when missing (default RED disabled)", () => {
		mockExistsSync.mockImplementation((path: string) => {
			if (path.includes("state.json")) return false;
			if (path.includes(".git")) return false;
			return true;
		});
		mockHeadMessage.mockReturnValue("tdd: init");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.enabled).toBe(false);
			expect(result.state.current).toBe("red");
		}
		expect(mockInitGit).toHaveBeenCalled();
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: false,
			current: "red",
		});
	});

	it("auto-creates state.json when corrupted (recovers to default)", () => {
		mockExistsSync.mockImplementation((path: string) => {
			if (path.includes("state.json")) return true;
			if (path.includes(".git")) return false;
			return true;
		});
		mockLoadPhaseState.mockImplementation(() => {
			throw new Error("corrupt");
		});
		mockHeadMessage.mockReturnValue("tdd: init");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.enabled).toBe(false);
			expect(result.state.current).toBe("red");
		}
	});

	it("returns invalid rules.json error for malformed JSON", () => {
		mockLoadConfig.mockImplementation(() => {
			throw new Error("Unexpected token");
		});
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("Invalid .pi/tdd/rules.json");
	});

	it("returns ok when state.json has enabled: false (callers check enabled)", () => {
		mockLoadPhaseState.mockReturnValue({ enabled: false, current: "red" });
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.enabled).toBe(false);
			expect(result.state.current).toBe("red");
		}
	});

	it("returns ok with state and config when everything valid", () => {
		mockLoadPhaseState.mockReturnValue(validPhase);
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.current).toBe("red");
			expect(result.state.enabled).toBe(true);
			expect(result.config.testCommands).toEqual(["npm test"]);
			expect(result.config.blockedInRed).toEqual(["tests/**/*.test.ts"]);
		}
	});

	it("auto-creates git repo when missing", () => {
		let gitExists = false;
		mockExistsSync.mockImplementation((path: string) => {
			if (path.includes(".git")) return gitExists;
			if (path.includes(".pi/tdd")) return true;
			return true;
		});
		mockInitGit.mockImplementation(() => {
			gitExists = true;
		});
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		expect(mockInitGit).toHaveBeenCalled();
	});

	it("handles multiple calls without error", () => {
		const r1 = loadTddState("/test", makeDeps());
		expect(r1.ok).toBe(true);
		const r2 = loadTddState("/test", makeDeps());
		expect(r2.ok).toBe(true);
		expect(mockLoadConfig).toHaveBeenCalledTimes(2);
	});

	it("recovers from invalid current phase in state.json (auto-creates default)", () => {
		mockLoadPhaseState.mockImplementation(() => {
			throw new Error("invalid phase");
		});
		mockHeadMessage.mockReturnValue("tdd: init");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.enabled).toBe(false);
			expect(result.state.current).toBe("red");
		}
	});

	it("recoverState: HEAD tdd:red → enabled green", () => {
		mockExistsSync.mockImplementation((path: string) => {
			if (path.includes("state.json")) return false;
			return true;
		});
		mockHeadMessage.mockReturnValue("tdd: red");
		mockNextPhase.mockImplementation(realNextPhase);
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.enabled).toBe(true);
			expect(result.state.current).toBe("green");
		}
	});

	it("recoverState: HEAD tdd:green → enabled refactor", () => {
		mockExistsSync.mockImplementation((path: string) => {
			if (path.includes("state.json")) return false;
			return true;
		});
		mockHeadMessage.mockReturnValue("tdd: green");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.enabled).toBe(true);
			expect(result.state.current).toBe("refactor");
		}
	});

	it("recoverState: HEAD tdd:refactor → enabled red", () => {
		mockExistsSync.mockImplementation((path: string) => {
			if (path.includes("state.json")) return false;
			return true;
		});
		mockHeadMessage.mockReturnValue("tdd: refactor");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.enabled).toBe(true);
			expect(result.state.current).toBe("red");
		}
	});

	it("force-adds state.json after creating it from recovery", () => {
		mockExistsSync.mockImplementation((path: string) => {
			if (path.includes("state.json")) return false;
			if (path.includes(".git")) return false;
			return true;
		});
		mockHeadMessage.mockReturnValue("tdd: init");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		expect(mockStageFiles).toHaveBeenCalledWith("/test", [
			".pi/tdd/state.json",
		]);
	});

	it("does not force-add state.json when it already exists and is valid", () => {
		mockExistsSync.mockImplementation((path: string) => {
			if (path.includes("state.json")) return true;
			if (path.includes(".git")) return true;
			return true;
		});
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		expect(mockStageFiles).not.toHaveBeenCalled();
	});

	it("force-adds state.json after recovering from corrupted state", () => {
		mockExistsSync.mockImplementation((path: string) => {
			if (path.includes("state.json")) return true;
			if (path.includes(".git")) return true;
			return true;
		});
		mockLoadPhaseState.mockImplementation(() => {
			throw new Error("corrupt");
		});
		mockHeadMessage.mockReturnValue("tdd: init");
		const result = loadTddState("/test", makeDeps());
		expect(result.ok).toBe(true);
		expect(mockStageFiles).toHaveBeenCalledWith("/test", [
			".pi/tdd/state.json",
		]);
	});
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { advancePhase, getStatusInfo, revertPhase } from "./orchestrate.js";
import type { Config, Phase, PhaseState } from "./types.js";

const CONFIG: Config = {
	blockedInRed: ["tests/**/*.test.ts"],
	blockedInGreen: ["src/**/*.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

function enabledState(current: Phase): PhaseState {
	return { enabled: true, current };
}

describe("advancePhase", () => {
	let mockGetDisallowedChanges: ReturnType<typeof vi.fn>;
	let mockCheckGate: ReturnType<typeof vi.fn>;
	let mockNextPhase: ReturnType<typeof vi.fn>;
	let mockSnapshot: ReturnType<typeof vi.fn>;
	let mockSavePhaseState: ReturnType<typeof vi.fn>;
	let mockTestRunner: ReturnType<typeof vi.fn>;

	function makeDeps(overrides = {}) {
		return {
			getDisallowedChanges: mockGetDisallowedChanges,
			checkGate: mockCheckGate,
			nextPhase: mockNextPhase,
			snapshot: mockSnapshot,
			savePhaseState: mockSavePhaseState,
			testRunner: mockTestRunner,
			...overrides,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockGetDisallowedChanges = vi.fn().mockReturnValue([]);
		mockCheckGate = vi.fn().mockResolvedValue({ passed: true, message: "ok" });
		mockNextPhase = vi
			.fn()
			.mockImplementation((p: string) =>
				p === "red"
					? "green"
					: p === "green"
						? "refactor"
						: p === "refactor"
							? "red"
							: null,
			);
		mockSnapshot = vi.fn().mockReturnValue("hash123");
		mockSavePhaseState = vi.fn();
		mockTestRunner = vi.fn();
	});

	it("returns allowlist violation error with revert hint when files blocked", async () => {
		mockGetDisallowedChanges.mockReturnValue(["src/violation.ts"]);
		const result = await advancePhase(
			"/test",
			enabledState("red"),
			CONFIG,
			makeDeps(),
		);
		expect(result.ok).toBe(false);
		expect(result.message).toBe(
			"BLOCKED: files not allowed in RED phase:\n" +
				"  - src/violation.ts" +
				"\nRevert or remove them before proceeding.\n\nInspect with: cd .pi/tdd && git diff HEAD -- src/violation.ts",
		);
	});

	it("returns allowlist violation for multiple blocked files", async () => {
		mockGetDisallowedChanges.mockReturnValue(["src/a.ts", "src/b.ts"]);
		const result = await advancePhase(
			"/test",
			enabledState("red"),
			CONFIG,
			makeDeps(),
		);
		expect(result.ok).toBe(false);
		expect(result.message).toContain("src/a.ts");
		expect(result.message).toContain("src/b.ts");
		expect(result.message).toContain("cd .pi/tdd && git diff HEAD -- src/a.ts");
	});

	it("returns gate failure error when checkGate fails", async () => {
		mockCheckGate.mockResolvedValue({
			passed: false,
			message: "Tests failed:\n  - npm test",
		});
		const result = await advancePhase(
			"/test",
			enabledState("green"),
			CONFIG,
			makeDeps(),
		);
		expect(result.ok).toBe(false);
		expect(result.message).toBe("Tests failed:\n  - npm test");
	});

	it("passes testRunner to checkGate", () => {
		advancePhase("/test", enabledState("red"), CONFIG, makeDeps());
		expect(mockCheckGate).toHaveBeenCalledWith(
			"red",
			"green",
			mockTestRunner,
			CONFIG,
		);
	});

	it("passes correct phase transition red→green", () => {
		advancePhase("/test", enabledState("red"), CONFIG, makeDeps());
		expect(mockCheckGate).toHaveBeenCalledWith(
			"red",
			"green",
			expect.anything(),
			expect.anything(),
		);
	});

	it("passes correct phase transition green→refactor", () => {
		advancePhase("/test", enabledState("green"), CONFIG, makeDeps());
		expect(mockCheckGate).toHaveBeenCalledWith(
			"green",
			"refactor",
			expect.anything(),
			expect.anything(),
		);
	});

	it("passes correct phase transition refactor→red", () => {
		advancePhase("/test", enabledState("refactor"), CONFIG, makeDeps());
		expect(mockCheckGate).toHaveBeenCalledWith(
			"refactor",
			"red",
			expect.anything(),
			expect.anything(),
		);
	});

	it("calls snapshot with root and from phase on success", async () => {
		await advancePhase("/test", enabledState("red"), CONFIG, makeDeps());
		expect(mockSnapshot).toHaveBeenCalledWith("/test", "red");
	});

	it("calls savePhaseState with root and new state on success", async () => {
		await advancePhase("/test", enabledState("red"), CONFIG, makeDeps());
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "green",
		});
	});

	it("returns ok true with newState on success", async () => {
		const result = await advancePhase(
			"/test",
			enabledState("red"),
			CONFIG,
			makeDeps(),
		);
		expect(result.ok).toBe(true);
		expect(result.message).toBe("");
		expect(result.newState).toEqual({
			enabled: true,
			current: "green",
		});
	});

	it("does not snapshot or save when allowlist check fails", async () => {
		mockGetDisallowedChanges.mockReturnValue(["src/violation.ts"]);
		await advancePhase("/test", enabledState("red"), CONFIG, makeDeps());
		expect(mockSnapshot).not.toHaveBeenCalled();
		expect(mockSavePhaseState).not.toHaveBeenCalled();
	});

	it("does not snapshot or save when gate check fails", async () => {
		mockCheckGate.mockResolvedValue({
			passed: false,
			message: "fail",
		});
		await advancePhase("/test", enabledState("green"), CONFIG, makeDeps());
		expect(mockSnapshot).not.toHaveBeenCalled();
		expect(mockSavePhaseState).not.toHaveBeenCalled();
	});

	it("calls getDisallowedChanges with root, current phase, and config", () => {
		advancePhase("/test", enabledState("red"), CONFIG, makeDeps());
		expect(mockGetDisallowedChanges).toHaveBeenCalledWith(
			"/test",
			"red",
			CONFIG,
		);
	});

	it("uses nextPhase from deps if provided", () => {
		const customNext = vi.fn().mockReturnValue("refactor");
		advancePhase(
			"/test",
			enabledState("red"),
			CONFIG,
			makeDeps({ nextPhase: customNext }),
		);
		expect(customNext).toHaveBeenCalledWith("red");
	});

	it("falls back to real nextPhase when not provided in deps", () => {
		advancePhase(
			"/test",
			enabledState("red"),
			CONFIG,
			makeDeps({ nextPhase: undefined }),
		);
		// Should use the real nextPhase function (red→green)
		expect(mockCheckGate).toHaveBeenCalledWith(
			"red",
			"green",
			expect.anything(),
			expect.anything(),
		);
	});
});

describe("revertPhase", () => {
	let mockHasParent: ReturnType<typeof vi.fn>;
	let mockHeadMessage: ReturnType<typeof vi.fn>;
	let mockResetHard: ReturnType<typeof vi.fn>;
	let mockUndoLastCommit: ReturnType<typeof vi.fn>;
	let mockSavePhaseState: ReturnType<typeof vi.fn>;

	function makeDeps(overrides = {}) {
		return {
			hasParent: mockHasParent,
			headMessage: mockHeadMessage,
			resetHard: mockResetHard,
			undoLastCommit: mockUndoLastCommit,
			savePhaseState: mockSavePhaseState,
			...overrides,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockHasParent = vi.fn().mockReturnValue(true);
		mockHeadMessage = vi.fn().mockReturnValue("tdd: red");
		mockResetHard = vi.fn();
		mockUndoLastCommit = vi.fn();
		mockSavePhaseState = vi.fn();
	});

	it("returns error when no parent commit", async () => {
		mockHasParent.mockReturnValue(false);
		const result = await revertPhase(
			"/test",
			enabledState("green"),
			makeDeps(),
		);
		expect(result.ok).toBe(false);
		expect(result.message).toBe("No previous phase to revert to.");
	});

	it("returns error with tampering warning when HEAD is not a TDD snapshot", async () => {
		mockHeadMessage.mockReturnValue("some random commit");
		const result = await revertPhase(
			"/test",
			enabledState("green"),
			makeDeps(),
		);
		expect(result.ok).toBe(false);
		expect(result.message).toBe(
			'HEAD commit "some random commit" is not a TDD snapshot. Cannot determine previous phase.\n' +
				"The private git repo at .pi/tdd must not be manually modified. " +
				"Tampering with it will cause TDD state corruption.",
		);
	});

	it("resets hard and pops last commit on success", async () => {
		const result = await revertPhase(
			"/test",
			enabledState("green"),
			makeDeps(),
		);
		expect(result.ok).toBe(true);
		expect(result.message).toBe("Reverted to RED.");
		expect(result.newState?.current).toBe("red");
		expect(mockResetHard).toHaveBeenCalledWith("/test");
		expect(mockUndoLastCommit).toHaveBeenCalledWith("/test");
	});

	it("saves the reverted phase state", async () => {
		await revertPhase("/test", enabledState("green"), makeDeps());
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "red",
		});
	});

	it("determines previous phase from HEAD commit message", async () => {
		mockHeadMessage.mockReturnValue("tdd: green");
		const result = await revertPhase(
			"/test",
			enabledState("refactor"),
			makeDeps(),
		);
		expect(result.ok).toBe(true);
		expect(result.newState?.current).toBe("green");
	});

	it("determines refactor phase from HEAD commit message", async () => {
		mockHeadMessage.mockReturnValue("tdd: refactor");
		const result = await revertPhase("/test", enabledState("red"), makeDeps());
		expect(result.ok).toBe(true);
		expect(result.newState?.current).toBe("refactor");
	});

	it("preserves enabled state in new state", async () => {
		const result = await revertPhase(
			"/test",
			{ enabled: false, current: "green" },
			makeDeps(),
		);
		expect(result.ok).toBe(true);
		expect(result.newState?.enabled).toBe(false);
	});

	it("calls deps from provided deps object", async () => {
		const customHasParent = vi.fn().mockReturnValue(true);
		const customHeadMessage = vi.fn().mockReturnValue("tdd: green");
		const customResetHard = vi.fn();
		const customUndoLastCommit = vi.fn();
		const customSavePhaseState = vi.fn();

		await revertPhase("/test", enabledState("refactor"), {
			hasParent: customHasParent,
			headMessage: customHeadMessage,
			resetHard: customResetHard,
			undoLastCommit: customUndoLastCommit,
			savePhaseState: customSavePhaseState,
		});

		expect(customHasParent).toHaveBeenCalled();
		expect(customHeadMessage).toHaveBeenCalled();
		expect(customResetHard).toHaveBeenCalled();
		expect(customUndoLastCommit).toHaveBeenCalled();
		expect(customSavePhaseState).toHaveBeenCalled();
	});

	it("falls back to real functions when deps not provided", async () => {
		// Should use real hasParent, headMessage, etc. from engine
		const result = await revertPhase("/test", enabledState("green"));
		// Real hasParent will fail because /test isn't a git repo
		expect(result.ok).toBe(false);
	});
});

describe("getStatusInfo", () => {
	it("returns enabled status with RED phase", () => {
		const info = getStatusInfo(
			{ enabled: true, current: "red" },
			{
				blockedInRed: ["tests/**/*.test.ts"],
				blockedInGreen: ["src/**/*.ts"],
				testCommands: ["npm test"],
				timeoutSeconds: 30,
			},
		);
		expect(info).toBe(
			"TDD enforcer enabled\n" +
				"Current phase: RED\n" +
				"Blocked in RED: tests/**/*.test.ts\n" +
				"Blocked in GREEN: src/**/*.ts\n" +
				"Test commands: npm test",
		);
	});

	it("returns disabled status", () => {
		const info = getStatusInfo(
			{ enabled: false, current: "red" },
			{
				blockedInRed: [],
				blockedInGreen: [],
				testCommands: [],
				timeoutSeconds: 30,
			},
		);
		expect(info).toBe(
			"TDD enforcer disabled\n" +
				"Current phase: RED\n" +
				"Blocked in RED: (none)\n" +
				"Blocked in GREEN: (none)\n" +
				"Test commands: (none)",
		);
	});

	it("shows GREEN phase", () => {
		const info = getStatusInfo(
			{ enabled: true, current: "green" },
			{
				blockedInRed: [],
				blockedInGreen: [],
				testCommands: [],
				timeoutSeconds: 30,
			},
		);
		expect(info).toContain("GREEN");
	});

	it("shows REFACTOR phase", () => {
		const info = getStatusInfo(
			{ enabled: true, current: "refactor" },
			{
				blockedInRed: [],
				blockedInGreen: [],
				testCommands: [],
				timeoutSeconds: 30,
			},
		);
		expect(info).toContain("REFACTOR");
	});

	it("shows multiple blocked files for RED", () => {
		const info = getStatusInfo(
			{ enabled: true, current: "red" },
			{
				blockedInRed: ["*.ts", "*.json", "src/**"],
				blockedInGreen: [],
				testCommands: [],
				timeoutSeconds: 30,
			},
		);
		expect(info).toContain("Blocked in RED: *.ts, *.json, src/**");
	});

	it("shows multiple test commands", () => {
		const info = getStatusInfo(
			{ enabled: true, current: "red" },
			{
				blockedInRed: [],
				blockedInGreen: [],
				testCommands: ["npx vitest run", "npm run lint"],
				timeoutSeconds: 30,
			},
		);
		expect(info).toContain("Test commands: npx vitest run, npm run lint");
	});
});

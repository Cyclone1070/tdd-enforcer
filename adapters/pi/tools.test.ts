import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	NextPhaseDeps,
	PreviousPhaseDeps,
	TddStatusDeps,
} from "./tools.js";
import {
	executeNextPhase,
	executePreviousPhase,
	executeTddStatus,
} from "./tools.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const CONFIG = {
	blockedInRed: ["tests/**/*.test.ts"],
	blockedInGreen: ["src/**/*.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

// ── executeNextPhase ────────────────────────────────────────────────────────

describe("executeNextPhase", () => {
	let mockLoadTddState: ReturnType<typeof vi.fn>;
	let mockNextPhase: ReturnType<typeof vi.fn>;
	let mockGetDisallowedChanges: ReturnType<typeof vi.fn>;
	let mockCheckGate: ReturnType<typeof vi.fn>;
	let mockSnapshot: ReturnType<typeof vi.fn>;
	let mockSavePhaseState: ReturnType<typeof vi.fn>;
	let mockGetNudgePrompt: ReturnType<typeof vi.fn>;
	let mockAsyncExec: ReturnType<typeof vi.fn>;
	let mockTddLog: ReturnType<typeof vi.fn>;

	function makeDeps(overrides: Partial<NextPhaseDeps> = {}): NextPhaseDeps {
		return {
			loadTddState: mockLoadTddState,
			nextPhase: mockNextPhase,
			getDisallowedChanges: mockGetDisallowedChanges,
			checkGate: mockCheckGate,
			snapshot: mockSnapshot,
			savePhaseState: mockSavePhaseState,
			getNudgePrompt: mockGetNudgePrompt,
			asyncExec: mockAsyncExec,
			tddLog: mockTddLog,
			...overrides,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadTddState = vi.fn();
		mockNextPhase = vi.fn();
		mockGetDisallowedChanges = vi.fn().mockReturnValue([]);
		mockCheckGate = vi.fn();
		mockSnapshot = vi.fn().mockReturnValue("hash123");
		mockSavePhaseState = vi.fn();
		mockGetNudgePrompt = vi.fn().mockReturnValue("");
		mockAsyncExec = vi.fn();
		mockTddLog = vi.fn();

		mockNextPhase.mockImplementation((p: string) =>
			p === "red"
				? "green"
				: p === "green"
					? "refactor"
					: p === "refactor"
						? "red"
						: null,
		);
		mockCheckGate.mockResolvedValue({ passed: true, message: "ok" });
		mockAsyncExec.mockResolvedValue({ stdout: "", stderr: "" });
	});

	it("throws when TDD not setup", async () => {
		mockLoadTddState.mockReturnValue({
			ok: false,
			reason:
				"Missing .pi/tdd/ directory. See the tdd-enforcer skill to learn how to set up TDD configs.",
		});
		await expect(
			executeNextPhase({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("Missing .pi/tdd/");
	});

	it("throws when TDD disabled", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: false, current: "red" },
			config: CONFIG,
		});
		await expect(
			executeNextPhase({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("not enabled");
	});

	it("blocks when allowlist violations exist", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "red" },
			config: CONFIG,
		});
		mockGetDisallowedChanges.mockReturnValue(["src/violation.ts"]);
		await expect(
			executeNextPhase({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("BLOCKED");
	});

	it("blocks red→green when tests pass (need failing test)", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "red" },
			config: CONFIG,
		});
		mockCheckGate.mockResolvedValue({
			passed: false,
			message:
				"Tests passed. Add a failing test before transitioning to GREEN.",
		});
		await expect(
			executeNextPhase({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("Add a failing test");
	});

	it("blocks green→refactor when tests fail", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "green" },
			config: CONFIG,
		});
		mockCheckGate.mockResolvedValue({
			passed: false,
			message: "Tests failed. Fix them before transitioning to REFACTOR.",
		});
		await expect(
			executeNextPhase({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("failed");
	});

	it("result text has leading newline for spacing", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "red" },
			config: CONFIG,
		});
		mockCheckGate.mockResolvedValue({
			passed: true,
			message: "Tests fail — proceed to GREEN.",
		});
		mockGetNudgePrompt.mockReturnValue("content");
		const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
		expect(result.content[0].text.startsWith("\n")).toBe(true);
	});

	it("advances red→green when tests fail", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "red" },
			config: CONFIG,
		});
		mockCheckGate.mockResolvedValue({
			passed: true,
			message: "Tests fail — proceed to GREEN.",
		});
		mockGetNudgePrompt.mockReturnValue("You are now in **GREEN** phase.");
		const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
		expect(result.content[0].text).toContain("GREEN");
		expect(mockSnapshot).toHaveBeenCalledWith("/test", "red");
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "green",
		});
	});

	it("blocks on timeout with timeout message from checkGate", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "red" },
			config: CONFIG,
		});
		mockCheckGate.mockResolvedValue({
			passed: false,
			timeout: true,
			message:
				"Tests timed out after 30s. The test command may have hung or an operation may be blocking.",
		});
		await expect(
			executeNextPhase({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("timed out");
		expect(mockSnapshot).not.toHaveBeenCalled();
		expect(mockSavePhaseState).not.toHaveBeenCalled();
	});

	it("advances green→refactor when tests pass", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "green" },
			config: CONFIG,
		});
		mockCheckGate.mockResolvedValue({
			passed: true,
			message: "All tests pass — proceeding.",
		});
		mockGetNudgePrompt.mockReturnValue("You are now in **REFACTOR** phase.");
		const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
		expect(result.content[0].text).toContain("REFACTOR");
		expect(mockSnapshot).toHaveBeenCalledWith("/test", "green");
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "refactor",
		});
	});

	it("blocks refactor→red when tests fail", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "refactor" },
			config: CONFIG,
		});
		mockCheckGate.mockResolvedValue({
			passed: false,
			message: "Tests failed. Fix them before transitioning to RED.",
		});
		await expect(
			executeNextPhase({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("failed");
		expect(mockSavePhaseState).not.toHaveBeenCalled();
	});

	it("advances refactor→red when tests pass", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "refactor" },
			config: CONFIG,
		});
		mockCheckGate.mockResolvedValue({
			passed: true,
			message: "All tests pass — proceeding.",
		});
		mockGetNudgePrompt.mockReturnValue("You are now in **RED** phase.");
		const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
		expect(result.content[0].text).toContain("RED");
		expect(mockSnapshot).toHaveBeenCalledWith("/test", "refactor");
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "red",
		});
	});

	it("passes ctx.signal through to asyncExec for user cancellation", async () => {
		const ac = new AbortController();

		// Use green→refactor so passing tests satisfy the gate check
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "green" },
			config: CONFIG,
		});

		// A checkGate mock that actually runs the testRunner so asyncExec is called
		const callTestRunner = vi.fn(
			async (_from: string, _to: string, tr: any, cfg: any) => {
				return tr(cfg.testCommands, cfg.timeoutSeconds);
			},
		);

		mockAsyncExec.mockImplementation(async (_cmd: string, opts?: any) => {
			expect(opts?.signal).toBe(ac.signal);
			return { stdout: "", stderr: "" };
		});

		await executeNextPhase(
			{ cwd: "/test", signal: ac.signal } as any,
			makeDeps({ checkGate: callTestRunner as any }),
		);

		expect(mockAsyncExec).toHaveBeenCalledWith(
			"npm test",
			expect.objectContaining({ signal: ac.signal }),
		);
	});

	it("returns cancellation message when signal is aborted mid-execution", async () => {
		const ac = new AbortController();

		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "green" },
			config: CONFIG,
		});

		const callTestRunner = vi.fn(
			async (_from: string, _to: string, tr: any, cfg: any) => {
				return tr(cfg.testCommands, cfg.timeoutSeconds);
			},
		);

		// asyncExec that hangs until signal aborts, then rejects like exec does on kill
		mockAsyncExec.mockImplementation(async (_cmd: string, opts?: any) => {
			return new Promise((_resolve, reject) => {
				if (opts?.signal) {
					if (opts.signal.aborted) {
						const err: any = new Error("canceled");
						err.killed = true;
						reject(err);
					} else {
						opts.signal.addEventListener("abort", () => {
							const err: any = new Error("canceled");
							err.killed = true;
							reject(err);
						});
					}
				}
			});
		});

		const promise = executeNextPhase(
			{ cwd: "/test", signal: ac.signal } as any,
			makeDeps({ checkGate: callTestRunner as any }),
		);

		ac.abort();

		await expect(promise).rejects.toThrow("cancelled");
		expect(mockSnapshot).not.toHaveBeenCalled();
		expect(mockSavePhaseState).not.toHaveBeenCalled();
	});
});

// ── executePreviousPhase ────────────────────────────────────────────────────

describe("executePreviousPhase", () => {
	let mockLoadTddState: ReturnType<typeof vi.fn>;
	let mockHasParent: ReturnType<typeof vi.fn>;
	let mockHeadMessage: ReturnType<typeof vi.fn>;
	let mockResetHard: ReturnType<typeof vi.fn>;
	let mockUndoLastCommit: ReturnType<typeof vi.fn>;
	let mockSavePhaseState: ReturnType<typeof vi.fn>;
	let mockTddLog: ReturnType<typeof vi.fn>;

	function makeDeps(
		overrides: Partial<PreviousPhaseDeps> = {},
	): PreviousPhaseDeps {
		return {
			loadTddState: mockLoadTddState,
			hasParent: mockHasParent,
			headMessage: mockHeadMessage,
			resetHard: mockResetHard,
			undoLastCommit: mockUndoLastCommit,
			savePhaseState: mockSavePhaseState,
			tddLog: mockTddLog,
			...overrides,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadTddState = vi.fn();
		mockHasParent = vi.fn();
		mockHeadMessage = vi.fn();
		mockResetHard = vi.fn();
		mockUndoLastCommit = vi.fn();
		mockSavePhaseState = vi.fn();
		mockTddLog = vi.fn();

		mockHasParent.mockReturnValue(true);
	});

	it("throws when TDD not setup", async () => {
		mockLoadTddState.mockReturnValue({
			ok: false,
			reason: "Missing .pi/tdd/ directory.",
		});
		await expect(
			executePreviousPhase({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("Missing .pi/tdd/");
	});

	it("throws when TDD disabled", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: false, current: "red" },
			config: CONFIG,
		});
		await expect(
			executePreviousPhase({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("not enabled");
	});

	it("throws when no parent commit", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "red" },
			config: CONFIG,
		});
		mockHasParent.mockReturnValue(false);
		await expect(
			executePreviousPhase({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("No previous phase");
	});

	it("throws when HEAD message is not a TDD snapshot", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "red" },
			config: CONFIG,
		});
		mockHeadMessage.mockReturnValue("garbage");
		await expect(
			executePreviousPhase({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("not a TDD snapshot");
	});

	it("reverts to previous phase on success", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "green" },
			config: CONFIG,
		});
		mockHeadMessage.mockReturnValue("tdd: red");
		const result = await executePreviousPhase(
			{ cwd: "/test" } as any,
			makeDeps(),
		);
		expect(result.content[0].text).toContain("RED");
		expect(mockResetHard).toHaveBeenCalledWith("/test");
		expect(mockUndoLastCommit).toHaveBeenCalledWith("/test");
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "red",
		});
	});

	it("reverts to correct phase from green head label", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "refactor" },
			config: CONFIG,
		});
		mockHeadMessage.mockReturnValue("tdd: green");
		const result = await executePreviousPhase(
			{ cwd: "/test" } as any,
			makeDeps(),
		);
		expect(result.content[0].text).toContain("GREEN");
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "green",
		});
	});
});

// ── executeTddStatus ────────────────────────────────────────────────────────

describe("executeTddStatus", () => {
	let mockLoadTddState: ReturnType<typeof vi.fn>;
	let mockTddLog: ReturnType<typeof vi.fn>;

	function makeDeps(overrides: Partial<TddStatusDeps> = {}): TddStatusDeps {
		return {
			loadTddState: mockLoadTddState,
			tddLog: mockTddLog,
			...overrides,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadTddState = vi.fn();
		mockTddLog = vi.fn();
	});

	it("throws when TDD not setup", async () => {
		mockLoadTddState.mockReturnValue({
			ok: false,
			reason: "Missing .pi/tdd/ directory.",
		});
		await expect(
			executeTddStatus({ cwd: "/test" } as any, makeDeps()),
		).rejects.toThrow("Missing .pi/tdd/");
	});

	it("returns status details when TDD disabled", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: false, current: "red" },
			config: CONFIG,
		});
		const result = await executeTddStatus({ cwd: "/test" } as any, makeDeps());
		expect(result.content[0].text).toContain("disabled");
		expect(result.content[0].text).toContain("RED");
		expect(result.content[0].text).toContain("tests/**/*.test.ts");
		expect(result.content[0].text).toContain("src/**/*.ts");
		expect(result.details).toBeDefined();
		expect(result.details?.enabled).toBe(false);
		expect(result.details?.phase).toBe("red");
	});

	it("returns status details when TDD enabled", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "red" },
			config: CONFIG,
		});
		const result = await executeTddStatus({ cwd: "/test" } as any, makeDeps());
		expect(result.content[0].text).toContain("enabled");
		expect(result.content[0].text).toContain("RED");
		expect(result.content[0].text).toContain("tests/**/*.test.ts");
		expect(result.content[0].text).toContain("src/**/*.ts");
		expect(result.details).toBeDefined();
		expect(result.details?.enabled).toBe(true);
		expect(result.details?.phase).toBe("red");
	});

	it("returns status with current phase", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "green" },
			config: CONFIG,
		});
		const result = await executeTddStatus({ cwd: "/test" } as any, makeDeps());
		expect(result.content[0].text).toContain("GREEN");
		expect(result.details?.phase).toBe("green");
	});
});

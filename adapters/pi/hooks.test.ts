import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config, Phase } from "../../engine/types.js";
import { handleToolCall, handleToolResult } from "./hooks.js";

// ── shared mock factories ───────────────────────────────────────────────────

function makeCallDeps(overrides: Record<string, unknown> = {}) {
	return {
		loadTddState: mockLoadTddState,
		gitStashCreate: mockGitStashCreate,
		isAllowed: mockIsAllowed,
		tddLog: mockTddLog,
		isToolCallEventType: mockIsToolCallEventType,
		preBashStashes,
		...overrides,
	};
}

function makeResultDeps(overrides: Record<string, unknown> = {}) {
	return {
		isBashToolResult: mockIsBashToolResult,
		loadTddState: mockLoadTddState,
		tddLog: mockTddLog,
		changesSince: mockChangesSince,
		isAllowed: mockIsAllowed,
		restoreFilesTo: mockRestoreFilesTo,
		preBashStashes,
		...overrides,
	};
}

const VALID_CONFIG = {
	blockedInRed: ["src/**/*.ts"],
	blockedInGreen: ["tests/**/*.test.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

// ── mock declarations ───────────────────────────────────────────────────────

const mockLoadTddState = vi.fn();
const mockGitStashCreate = vi.fn();
const mockIsAllowed = vi.fn();
const mockTddLog = vi.fn();
const mockIsToolCallEventType = vi.fn();
const mockIsBashToolResult = vi.fn();
const mockChangesSince = vi.fn();
const mockRestoreFilesTo = vi.fn();
const preBashStashes = new Map<
	string,
	{ stashHash: string; phase: Phase; config: Config }
>();

// Default implementations for type-guard mocks so they behave like real ones.
mockIsToolCallEventType.mockImplementation(
	(type: string, event: any) => event.toolName === type,
);
mockIsBashToolResult.mockImplementation(
	(event: any) => event.toolName === "bash",
);

beforeEach(() => {
	vi.clearAllMocks();
	preBashStashes.clear();
});

// ── helpers ──────────────────────────────────────────────────────────────────

function enabledTddState(overrides?: { current?: string }) {
	return {
		ok: true as const,
		state: { enabled: true, current: overrides?.current ?? "red" },
		config: VALID_CONFIG,
	};
}

function stashEntry(phase: Phase) {
	return { stashHash: "stash123", phase, config: VALID_CONFIG };
}

// ── handleToolCall ──────────────────────────────────────────────────────────

describe("handleToolCall", () => {
	it("passes through when .pi/tdd/ does not exist", async () => {
		mockLoadTddState.mockReturnValue({ ok: false, reason: "Missing .pi/tdd/" });

		const result = await handleToolCall(
			{ toolCallId: "1", toolName: "edit", input: { path: "/x/foo.ts" } },
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeUndefined();
		expect(mockTddLog).toHaveBeenCalled();
	});

	it("passes through when rules.json missing", async () => {
		mockLoadTddState.mockReturnValue({
			ok: false,
			reason: "Missing rules.json",
		});

		const result = await handleToolCall(
			{ toolCallId: "1", toolName: "edit", input: { path: "/x/foo.ts" } },
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeUndefined();
	});

	it("passes through when TDD disabled", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: false, current: "red" },
			config: VALID_CONFIG,
		});

		const result = await handleToolCall(
			{ toolCallId: "1", toolName: "edit", input: { path: "/x/src/main.ts" } },
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeUndefined();
	});

	it("stores stash for bash tool and returns undefined", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "red" }));
		mockGitStashCreate.mockReturnValue("abc123");

		const result = await handleToolCall(
			{ toolCallId: "bash-1", toolName: "bash" },
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeUndefined();
		expect(mockGitStashCreate).toHaveBeenCalledWith("/x");
		const cached = preBashStashes.get("bash-1");
		expect(cached).toBeDefined();
		expect(cached?.stashHash).toBe("abc123");
		expect(cached?.phase).toBe("red");
		expect(cached?.config).toEqual(VALID_CONFIG);
	});

	it("handles bash stash failure gracefully", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "red" }));
		mockGitStashCreate.mockImplementation(() => {
			throw new Error("git error");
		});

		const result = await handleToolCall(
			{ toolCallId: "bash-2", toolName: "bash" },
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeUndefined();
		expect(preBashStashes.has("bash-2")).toBe(false);
	});

	it("blocks write to .pi/tdd/ file when TDD active", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "red" }));

		const result = await handleToolCall(
			{
				toolCallId: "1",
				toolName: "write",
				input: { path: "/x/.pi/tdd/rules.json" },
			},
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeDefined();
		expect((result as any).block).toBe(true);
		expect((result as any).reason).toContain("Config files are locked");
	});

	it("blocks edit to .pi/tdd/ file when TDD active", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "red" }));

		const result = await handleToolCall(
			{
				toolCallId: "1",
				toolName: "edit",
				input: { path: "/x/.pi/tdd/state.json" },
			},
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeDefined();
		expect((result as any).block).toBe(true);
	});

	it("allows write to allowed file in RED phase (test file)", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "red" }));
		mockIsAllowed.mockReturnValue(true);

		const result = await handleToolCall(
			{
				toolCallId: "1",
				toolName: "write",
				input: { path: "/x/tests/foo.test.ts" },
			},
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeUndefined();
		expect(mockIsAllowed).toHaveBeenCalledWith(
			"tests/foo.test.ts",
			"red",
			VALID_CONFIG,
		);
	});

	it("blocks write to disallowed file in RED phase (impl file)", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "red" }));
		mockIsAllowed.mockReturnValue(false);

		const result = await handleToolCall(
			{ toolCallId: "1", toolName: "write", input: { path: "/x/src/main.ts" } },
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeDefined();
		expect((result as any).block).toBe(true);
		expect((result as any).reason).toContain("RED");
	});

	it("allows write to allowed file in GREEN phase (impl file)", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "green" }));
		mockIsAllowed.mockReturnValue(true);

		const result = await handleToolCall(
			{ toolCallId: "1", toolName: "write", input: { path: "/x/src/main.ts" } },
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeUndefined();
	});

	it("blocks write to disallowed file in GREEN phase (test file)", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "green" }));
		mockIsAllowed.mockReturnValue(false);

		const result = await handleToolCall(
			{
				toolCallId: "1",
				toolName: "write",
				input: { path: "/x/tests/foo.test.ts" },
			},
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeDefined();
		expect((result as any).block).toBe(true);
		expect((result as any).reason).toContain("GREEN");
	});

	it("passes through non-file tool (e.g. read)", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "red" }));

		const result = await handleToolCall(
			{ toolCallId: "1", toolName: "read", input: { path: "/x/foo.ts" } },
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeUndefined();
	});

	it("passes through write with no path", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "red" }));

		const result = await handleToolCall(
			{ toolCallId: "1", toolName: "write" } as any,
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeUndefined();
	});

	it("allows free file (matching neither glob set) in any phase", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "green" }));
		mockIsAllowed.mockReturnValue(true);

		const result = await handleToolCall(
			{ toolCallId: "1", toolName: "write", input: { path: "/x/README.md" } },
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(result).toBeUndefined();
	});

	it("allows in REFACTOR phase regardless of file type", async () => {
		mockLoadTddState.mockReturnValue(enabledTddState({ current: "refactor" }));
		// isAllowed is never called because the handler reaches .pi/tdd/ check
		// before isAllowed, and for non-.pi/tdd/ files in refactor it would
		// call isAllowed — but we mock it anyway.

		const r1 = await handleToolCall(
			{ toolCallId: "1", toolName: "write", input: { path: "/x/src/main.ts" } },
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);
		const r2 = await handleToolCall(
			{
				toolCallId: "2",
				toolName: "write",
				input: { path: "/x/tests/foo.test.ts" },
			},
			{ cwd: "/x" } as any,
			makeCallDeps(),
		);

		expect(r1).toBeUndefined();
		expect(r2).toBeUndefined();

		// In refactor, isAllowed is still called even though it returns true
		// (the implementation doesn't short-circuit for refactor before isAllowed)
		expect(mockIsAllowed).toHaveBeenCalledWith(
			"src/main.ts",
			"refactor",
			VALID_CONFIG,
		);
		expect(mockIsAllowed).toHaveBeenCalledWith(
			"tests/foo.test.ts",
			"refactor",
			VALID_CONFIG,
		);
	});
});

// ── handleToolResult ────────────────────────────────────────────────────────

describe("handleToolResult", () => {
	it("returns undefined for non-bash result", async () => {
		const result = await handleToolResult(
			{ toolCallId: "1", toolName: "read", content: [] },
			{ cwd: "/x" } as any,
			makeResultDeps(),
		);

		expect(result).toBeUndefined();
	});

	it("passes through when no pre-stash found", async () => {
		mockIsBashToolResult.mockReturnValue(true);

		const result = await handleToolResult(
			{
				toolCallId: "nonexistent",
				toolName: "bash",
				content: [{ type: "text", text: "ok" }],
			},
			{ cwd: "/x" } as any,
			makeResultDeps(),
		);

		expect(result).toBeUndefined();
		expect(mockTddLog).toHaveBeenCalled();
	});

	it("loadTddState never called in handleToolResult — uses cached state", async () => {
		mockIsBashToolResult.mockReturnValue(true);
		preBashStashes.set("verify-cache", stashEntry("green"));
		mockChangesSince.mockReturnValue([]);

		await handleToolResult(
			{
				toolCallId: "verify-cache",
				toolName: "bash",
				content: [{ type: "text", text: "ok" }],
			},
			{ cwd: "/x" } as any,
			makeResultDeps(),
		);

		expect(mockLoadTddState).not.toHaveBeenCalled();
	});

	it("reverts .pi/tdd/ violations from cached state", async () => {
		mockIsBashToolResult.mockReturnValue(true);
		preBashStashes.set("exploit-id", {
			stashHash: "stash-exploit",
			phase: "green",
			config: VALID_CONFIG,
		});
		mockChangesSince.mockReturnValue([".pi/tdd/state.json"]);

		const result = await handleToolResult(
			{
				toolCallId: "exploit-id",
				toolName: "bash",
				content: [{ type: "text", text: "ok" }],
			},
			{ cwd: "/x" } as any,
			makeResultDeps(),
		);

		expect(mockRestoreFilesTo).toHaveBeenCalledWith(
			"/x",
			[".pi/tdd/state.json"],
			"stash-exploit",
		);
		expect(result).toBeDefined();
		expect(result?.content[0].text).toContain("reverted");
	});

	it("reverts locked file when modified by bash (uses cached phase)", async () => {
		mockIsBashToolResult.mockReturnValue(true);
		preBashStashes.set("bash-revert", stashEntry("green"));
		mockChangesSince.mockReturnValue(["tests/foo.test.ts"]);
		mockIsAllowed.mockReturnValue(false);

		const result = await handleToolResult(
			{
				toolCallId: "bash-revert",
				toolName: "bash",
				content: [{ type: "text", text: "done" }],
			},
			{ cwd: "/x" } as any,
			makeResultDeps(),
		);

		expect(result).toBeDefined();
		expect(result?.isError).toBe(true);
		expect(result?.content[0].text).toContain("reverted");
		expect(result?.content[0].text).toContain("tests/foo.test.ts");

		// The stash should be cleaned up
		expect(preBashStashes.has("bash-revert")).toBe(false);

		// The file should have been restored
		expect(mockRestoreFilesTo).toHaveBeenCalledWith(
			"/x",
			["tests/foo.test.ts"],
			"stash123",
		);
	});

	it("passes through when no stash entry", async () => {
		mockIsBashToolResult.mockReturnValue(true);
		// preBashStashes has no entry for this callId — handleToolCall never ran

		const result = await handleToolResult(
			{
				toolCallId: "no-stash",
				toolName: "bash",
				content: [{ type: "text", text: "done" }],
			},
			{ cwd: "/x" } as any,
			makeResultDeps(),
		);

		expect(result).toBeUndefined();
	});

	it("passes through when bash makes no changes", async () => {
		mockIsBashToolResult.mockReturnValue(true);
		preBashStashes.set("bash-nochange", stashEntry("red"));
		mockChangesSince.mockReturnValue([]);

		const result = await handleToolResult(
			{
				toolCallId: "bash-nochange",
				toolName: "bash",
				content: [{ type: "text", text: "done" }],
			},
			{ cwd: "/x" } as any,
			makeResultDeps(),
		);

		expect(result).toBeUndefined();
		expect(mockTddLog).toHaveBeenCalled();
	});

	it("passes through in refactor phase with no .pi/tdd/ violations", async () => {
		mockIsBashToolResult.mockReturnValue(true);
		preBashStashes.set("bash-refactor", stashEntry("refactor"));
		mockChangesSince.mockReturnValue(["src/main.ts"]);

		const result = await handleToolResult(
			{
				toolCallId: "bash-refactor",
				toolName: "bash",
				content: [{ type: "text", text: "done" }],
			},
			{ cwd: "/x" } as any,
			makeResultDeps(),
		);

		expect(result).toBeUndefined();
	});

	it("retains allowed changes alongside reverted violations", async () => {
		mockIsBashToolResult.mockReturnValue(true);
		preBashStashes.set("bash-mixed", stashEntry("green"));
		mockChangesSince.mockReturnValue(["tests/foo.test.ts", "README.md"]);
		mockIsAllowed
			.mockReturnValueOnce(false) // phaseViolations: tests/foo.test.ts → violation
			.mockReturnValueOnce(true) // phaseViolations: README.md → not a violation
			.mockReturnValueOnce(false) // cmdAllowed: tests/foo.test.ts → excluded
			.mockReturnValueOnce(true); // cmdAllowed: README.md → included

		const result = await handleToolResult(
			{
				toolCallId: "bash-mixed",
				toolName: "bash",
				content: [{ type: "text", text: "done" }],
			},
			{ cwd: "/x" } as any,
			makeResultDeps(),
		);

		expect(result).toBeDefined();
		expect(result?.isError).toBe(true);
		expect(result?.content[0].text).toContain("reverted");
		expect(result?.content[0].text).toContain("tests/foo.test.ts");
		expect(result?.content[0].text).toContain("Allowed changes retained");
		expect(result?.content[0].text).toContain("README.md");

		expect(mockRestoreFilesTo).toHaveBeenCalledWith(
			"/x",
			["tests/foo.test.ts"],
			"stash123",
		);
	});

	it("passes through when only allowed files changed", async () => {
		mockIsBashToolResult.mockReturnValue(true);
		preBashStashes.set("bash-allowed", stashEntry("green"));
		mockChangesSince.mockReturnValue(["src/main.ts"]);
		mockIsAllowed.mockReturnValue(true);

		const result = await handleToolResult(
			{
				toolCallId: "bash-allowed",
				toolName: "bash",
				content: [{ type: "text", text: "done" }],
			},
			{ cwd: "/x" } as any,
			makeResultDeps(),
		);

		expect(result).toBeUndefined();
	});

	it("cleans up stash entry after processing", async () => {
		mockIsBashToolResult.mockReturnValue(true);
		preBashStashes.set("cleanup", stashEntry("green"));
		mockChangesSince.mockReturnValue([]);

		await handleToolResult(
			{
				toolCallId: "cleanup",
				toolName: "bash",
				content: [{ type: "text", text: "done" }],
			},
			{ cwd: "/x" } as any,
			makeResultDeps(),
		);

		expect(preBashStashes.has("cleanup")).toBe(false);
	});
});

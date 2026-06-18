import { describe, it, expect, beforeEach, vi } from "vitest";
import { executeNextPhase, executePreviousPhase, executeTddStatus } from "./tools.js";
import type { NextPhaseDeps, PreviousPhaseDeps, TddStatusDeps } from "./tools.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const CONFIG = {
  allowedRedPhaseFiles: ["tests/**/*.test.ts"],
  allowedGreenPhaseFiles: ["src/**/*.ts"],
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
      p === "red" ? "green" : p === "green" ? "refactor" : p === "refactor" ? "red" : null,
    );
    mockCheckGate.mockResolvedValue({ passed: true, message: "ok" });
    mockAsyncExec.mockResolvedValue({ stdout: "", stderr: "" });
  });

  it("returns config error when TDD not setup", async () => {
    mockLoadTddState.mockReturnValue({
      ok: false,
      reason: "Missing .pi/tdd/ directory. See the tdd-enforcer skill to learn how to set up TDD configs.",
    });
    const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("Missing .pi/tdd/");
  });

  it("returns disabled message when TDD disabled", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: false, current: "red" },
      config: CONFIG,
    });
    const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("not enabled");
  });

  it("blocks when allowlist violations exist", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: true, current: "red" },
      config: CONFIG,
    });
    mockGetDisallowedChanges.mockReturnValue(["src/violation.ts"]);
    const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("BLOCKED");
    expect(result.content[0].text).toContain("src/violation.ts");
  });

  it("blocks red→green when tests pass (need failing test)", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: true, current: "red" },
      config: CONFIG,
    });
    mockCheckGate.mockResolvedValue({
      passed: false,
      message: "Tests passed. Add a failing test before transitioning to GREEN.",
    });
    const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("Add a failing test");
    expect(result.content[0].text).toContain("GREEN");
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
    const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("failed");
    expect(result.content[0].text).toContain("REFACTOR");
  });

  it("advances red→green when tests fail", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: true, current: "red" },
      config: CONFIG,
    });
    mockCheckGate.mockResolvedValue({ passed: true, message: "Tests fail — proceed to GREEN." });
    mockGetNudgePrompt.mockReturnValue("You are now in **GREEN** phase.");
    const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("GREEN");
    expect(mockSnapshot).toHaveBeenCalledWith("/test", "red");
    expect(mockSavePhaseState).toHaveBeenCalledWith("/test", { enabled: true, current: "green" });
  });

  it("advances green→refactor when tests pass", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: true, current: "green" },
      config: CONFIG,
    });
    mockCheckGate.mockResolvedValue({ passed: true, message: "All tests pass — proceeding." });
    mockGetNudgePrompt.mockReturnValue("You are now in **REFACTOR** phase.");
    const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("REFACTOR");
    expect(mockSnapshot).toHaveBeenCalledWith("/test", "green");
    expect(mockSavePhaseState).toHaveBeenCalledWith("/test", { enabled: true, current: "refactor" });
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
    const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("failed");
    expect(result.content[0].text).toContain("RED");
    expect(mockSavePhaseState).not.toHaveBeenCalled();
  });

  it("advances refactor→red when tests pass", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: true, current: "refactor" },
      config: CONFIG,
    });
    mockCheckGate.mockResolvedValue({ passed: true, message: "All tests pass — proceeding." });
    mockGetNudgePrompt.mockReturnValue("You are now in **RED** phase.");
    const result = await executeNextPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("RED");
    expect(mockSnapshot).toHaveBeenCalledWith("/test", "refactor");
    expect(mockSavePhaseState).toHaveBeenCalledWith("/test", { enabled: true, current: "red" });
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

  function makeDeps(overrides: Partial<PreviousPhaseDeps> = {}): PreviousPhaseDeps {
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

  it("returns config error when TDD not setup", async () => {
    mockLoadTddState.mockReturnValue({
      ok: false,
      reason: "Missing .pi/tdd/ directory.",
    });
    const result = await executePreviousPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("Missing .pi/tdd/");
  });

  it("returns disabled message when TDD disabled", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: false, current: "red" },
      config: CONFIG,
    });
    const result = await executePreviousPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("not enabled");
  });

  it("returns no-parent message when only init commit exists", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: true, current: "red" },
      config: CONFIG,
    });
    mockHasParent.mockReturnValue(false);
    const result = await executePreviousPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("No previous phase");
  });

  it("returns error when HEAD message is not a TDD snapshot", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: true, current: "red" },
      config: CONFIG,
    });
    mockHeadMessage.mockReturnValue("garbage");
    const result = await executePreviousPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("not a TDD snapshot");
  });

  it("reverts to previous phase on success", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: true, current: "green" },
      config: CONFIG,
    });
    mockHeadMessage.mockReturnValue("tdd: red");
    const result = await executePreviousPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("RED");
    expect(mockResetHard).toHaveBeenCalledWith("/test");
    expect(mockUndoLastCommit).toHaveBeenCalledWith("/test");
    expect(mockSavePhaseState).toHaveBeenCalledWith("/test", { enabled: true, current: "red" });
  });

  it("reverts to correct phase from green head label", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: true, current: "refactor" },
      config: CONFIG,
    });
    mockHeadMessage.mockReturnValue("tdd: green");
    const result = await executePreviousPhase({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("GREEN");
    expect(mockSavePhaseState).toHaveBeenCalledWith("/test", { enabled: true, current: "green" });
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

  it("returns config error when TDD not setup", async () => {
    mockLoadTddState.mockReturnValue({
      ok: false,
      reason: "Missing .pi/tdd/ directory.",
    });
    const result = await executeTddStatus({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("Missing .pi/tdd/");
  });

  it("returns disabled message when TDD disabled", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: false, current: "red" },
      config: CONFIG,
    });
    const result = await executeTddStatus({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("not enabled");
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
    expect(result.details!.enabled).toBe(true);
    expect(result.details!.phase).toBe("red");
  });

  it("returns status with current phase", async () => {
    mockLoadTddState.mockReturnValue({
      ok: true,
      state: { enabled: true, current: "green" },
      config: CONFIG,
    });
    const result = await executeTddStatus({ cwd: "/test" } as any, makeDeps());
    expect(result.content[0].text).toContain("GREEN");
    expect(result.details!.phase).toBe("green");
  });
});

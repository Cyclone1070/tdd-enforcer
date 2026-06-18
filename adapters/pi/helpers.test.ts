import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadTddState } from "./helpers.js";

const validRules = {
  allowedRedPhaseFiles: ["tests/**/*.test.ts"],
  allowedGreenPhaseFiles: ["src/**/*.ts"],
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

  // Shared helper to simulate nextPhase behavior
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
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all setup valid
    mockExistsSync = vi.fn().mockImplementation((path: string) => {
      // Make .pi/tdd and rules.json exist by default
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
      if (path.includes("state.json")) return true; // exists but corrupted
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
      expect(result.config.allowedRedPhaseFiles).toEqual([
        "tests/**/*.test.ts",
      ]);
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
      if (path.includes("state.json")) return false; // missing → triggers recover
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
});

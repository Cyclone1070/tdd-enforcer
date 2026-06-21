import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	handleBeforeAgentStart,
	handleTddJump,
	handleTddOff,
	handleTddOn,
	handleTddReset,
	handleTddStatus,
} from "./index.js";

const config = {
	blockedInRed: ["tests/**/*.test.ts"],
	blockedInGreen: ["src/**/*.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(dir = "/test") {
	const notifications: Array<{ message: string; type: string }> = [];
	return {
		cwd: dir,
		ui: {
			notify: (message: string, type: string) =>
				notifications.push({ message, type }),
		},
		notifications, // stored alongside for easy assertion
	} as any;
}

function _captureNotifications(
	ctx: any,
): Array<{ message: string; type: string }> {
	return ctx.notifications;
}

// ── handleTddOn ─────────────────────────────────────────────────────────────

describe("handleTddOn", () => {
	let mockLoadTddState: ReturnType<typeof vi.fn>;
	let mockSnapshot: ReturnType<typeof vi.fn>;
	let mockSavePhaseState: ReturnType<typeof vi.fn>;
	let mockTddLog: ReturnType<typeof vi.fn>;

	function makeDeps(overrides = {}) {
		return {
			loadTddState: mockLoadTddState,
			snapshot: mockSnapshot,
			savePhaseState: mockSavePhaseState,
			tddLog: mockTddLog,
			...overrides,
		};
	}

	beforeEach(() => {
		mockLoadTddState = vi.fn();
		mockSnapshot = vi.fn().mockReturnValue("hash123");
		mockSavePhaseState = vi.fn();
		mockTddLog = vi.fn();
	});

	it("enables TDD, takes snapshot, notifies user", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: false, current: "red" },
			config,
		});

		const ctx = makeCtx();
		await handleTddOn(ctx, makeDeps());

		expect(mockSnapshot).toHaveBeenCalledWith("/test", "red");
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "red",
		});
		expect(ctx.notifications).toHaveLength(1);
		expect(ctx.notifications[0].message).toContain("TDD enabled");
		expect(ctx.notifications[0].type).toBe("info");
	});

	it("shows already enabled when TDD already on", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "red" },
			config,
		});

		const ctx = makeCtx();
		await handleTddOn(ctx, makeDeps());

		expect(ctx.notifications).toHaveLength(1);
		expect(ctx.notifications[0].message).toContain("already enabled");
		expect(ctx.notifications[0].type).toBe("info");
		expect(mockSnapshot).not.toHaveBeenCalled();
	});

	it("shows error when setup invalid", async () => {
		mockLoadTddState.mockReturnValue({
			ok: false,
			reason: "Missing .pi/tdd/",
		});

		const ctx = makeCtx();
		await handleTddOn(ctx, makeDeps());

		expect(ctx.notifications).toHaveLength(1);
		expect(ctx.notifications[0].message).toContain("Missing .pi/tdd/");
		expect(ctx.notifications[0].type).toBe("error");
	});
});

// ── handleTddOff ────────────────────────────────────────────────────────────

describe("handleTddOff", () => {
	let mockLoadTddState: ReturnType<typeof vi.fn>;
	let mockSavePhaseState: ReturnType<typeof vi.fn>;
	let mockTddLog: ReturnType<typeof vi.fn>;

	function makeDeps(overrides = {}) {
		return {
			loadTddState: mockLoadTddState,
			savePhaseState: mockSavePhaseState,
			tddLog: mockTddLog,
			...overrides,
		};
	}

	beforeEach(() => {
		mockLoadTddState = vi.fn();
		mockSavePhaseState = vi.fn();
		mockTddLog = vi.fn();
	});

	it("disables TDD, notifies user", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "red" },
			config,
		});

		const ctx = makeCtx();
		await handleTddOff(ctx, makeDeps());

		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: false,
			current: "red",
		});
		expect(ctx.notifications).toHaveLength(1);
		expect(ctx.notifications[0].message).toContain("disabled");
		expect(ctx.notifications[0].type).toBe("info");
	});

	it("shows already disabled when TDD already off", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: false, current: "red" },
			config,
		});

		const ctx = makeCtx();
		await handleTddOff(ctx, makeDeps());

		expect(ctx.notifications).toHaveLength(1);
		expect(ctx.notifications[0].message).toContain("already disabled");
		expect(ctx.notifications[0].type).toBe("info");
		expect(mockSavePhaseState).not.toHaveBeenCalled();
	});

	it("shows error when setup invalid", async () => {
		mockLoadTddState.mockReturnValue({
			ok: false,
			reason: "Missing .pi/tdd/",
		});

		const ctx = makeCtx();
		await handleTddOff(ctx, makeDeps());

		expect(ctx.notifications).toHaveLength(1);
		expect(ctx.notifications[0].message).toContain("Missing .pi/tdd/");
		expect(ctx.notifications[0].type).toBe("error");
	});
});

// ── handleTddStatus ─────────────────────────────────────────────────────────

describe("handleTddStatus", () => {
	let mockLoadTddState: ReturnType<typeof vi.fn>;
	let mockTddLog: ReturnType<typeof vi.fn>;

	function makeDeps(overrides = {}) {
		return {
			loadTddState: mockLoadTddState,
			tddLog: mockTddLog,
			...overrides,
		};
	}

	beforeEach(() => {
		mockLoadTddState = vi.fn();
		mockTddLog = vi.fn();
	});

	it("shows status when TDD enabled", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "green" },
			config,
		});

		const ctx = makeCtx();
		await handleTddStatus(ctx, makeDeps());

		expect(ctx.notifications).toHaveLength(1);
		expect(ctx.notifications[0].message).toContain("enabled");
		expect(ctx.notifications[0].message).toContain("GREEN");
		expect(ctx.notifications[0].type).toBe("info");
	});

	it("shows status when TDD disabled", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: false, current: "red" },
			config,
		});

		const ctx = makeCtx();
		await handleTddStatus(ctx, makeDeps());

		expect(ctx.notifications).toHaveLength(1);
		expect(ctx.notifications[0].message).toContain("disabled");
		expect(ctx.notifications[0].message).toContain("RED");
		expect(ctx.notifications[0].type).toBe("info");
	});

	it("shows error when setup invalid", async () => {
		mockLoadTddState.mockReturnValue({
			ok: false,
			reason: "Missing .pi/tdd/",
		});

		const ctx = makeCtx();
		await handleTddStatus(ctx, makeDeps());

		expect(ctx.notifications).toHaveLength(1);
		expect(ctx.notifications[0].message).toContain("Missing .pi/tdd/");
		expect(ctx.notifications[0].type).toBe("error");
	});
});

// ── handleTddReset ──────────────────────────────────────────────────────────

describe("handleTddReset", () => {
	let mockLoadTddState: ReturnType<typeof vi.fn>;
	let mockResetGit: ReturnType<typeof vi.fn>;
	let mockSnapshot: ReturnType<typeof vi.fn>;
	let mockSavePhaseState: ReturnType<typeof vi.fn>;
	let mockTddLog: ReturnType<typeof vi.fn>;

	function makeDeps(overrides = {}) {
		return {
			loadTddState: mockLoadTddState,
			resetGit: mockResetGit,
			snapshot: mockSnapshot,
			savePhaseState: mockSavePhaseState,
			tddLog: mockTddLog,
			...overrides,
		};
	}

	beforeEach(() => {
		mockLoadTddState = vi.fn();
		mockResetGit = vi.fn();
		mockSnapshot = vi.fn().mockReturnValue("hash123");
		mockSavePhaseState = vi.fn();
		mockTddLog = vi.fn();
	});

	it("nukes git, re-inits, snapshots, resets state to RED disabled", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "green" },
			config,
		});

		const ctx = makeCtx();
		await handleTddReset(ctx, makeDeps());

		expect(mockResetGit).toHaveBeenCalledWith("/test");
		expect(mockSnapshot).toHaveBeenCalledWith("/test", "red");
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: false,
			current: "red",
		});
		expect(ctx.notifications).toHaveLength(1);
		expect(ctx.notifications[0].message).toContain("reset");
		expect(ctx.notifications[0].type).toBe("warning");
	});

	it("shows error when setup invalid", async () => {
		mockLoadTddState.mockReturnValue({
			ok: false,
			reason: "Missing .pi/tdd/",
		});

		const ctx = makeCtx();
		await handleTddReset(ctx, makeDeps());

		expect(ctx.notifications).toHaveLength(1);
		expect(ctx.notifications[0].message).toContain("Missing .pi/tdd/");
		expect(ctx.notifications[0].type).toBe("error");
	});
});

// ── handleTddJump ───────────────────────────────────────────────────────────

describe("handleTddJump", () => {
	let mockLoadTddState: ReturnType<typeof vi.fn>;
	let mockSnapshot: ReturnType<typeof vi.fn>;
	let mockSavePhaseState: ReturnType<typeof vi.fn>;
	let mockTddLog: ReturnType<typeof vi.fn>;

	function makeDeps(overrides = {}) {
		return {
			loadTddState: mockLoadTddState,
			snapshot: mockSnapshot,
			savePhaseState: mockSavePhaseState,
			tddLog: mockTddLog,
			...overrides,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadTddState = vi.fn();
		mockSnapshot = vi.fn().mockReturnValue("snap123");
		mockSavePhaseState = vi.fn();
		mockTddLog = vi.fn();
	});

	function tddOk(overrides?: { current?: string; enabled?: boolean }) {
		return {
			ok: true as const,
			state: {
				enabled: overrides?.enabled ?? true,
				current: overrides?.current ?? "red",
			},
			config,
		};
	}

	it("shows error when TDD not setup", async () => {
		mockLoadTddState.mockReturnValue({ ok: false, reason: "Missing .pi/tdd/" });
		const ctx = makeCtx();
		await handleTddJump("green", ctx, makeDeps());
		expect(ctx.notifications[0].message).toContain("Missing");
		expect(ctx.notifications[0].type).toBe("error");
		expect(mockSavePhaseState).not.toHaveBeenCalled();
	});

	it("notifies no-op when already in target phase", async () => {
		mockLoadTddState.mockReturnValue(tddOk({ current: "green" }));
		const ctx = makeCtx();
		await handleTddJump("green", ctx, makeDeps());
		expect(ctx.notifications[0].message).toContain("already in GREEN");
		expect(ctx.notifications[0].type).toBe("info");
		expect(mockSnapshot).not.toHaveBeenCalled();
		expect(mockSavePhaseState).not.toHaveBeenCalled();
	});

	it("snapshots, auto-enables, jumps phase, notifies", async () => {
		mockLoadTddState.mockReturnValue(tddOk({ current: "red", enabled: true }));
		const ctx = makeCtx();
		await handleTddJump("green", ctx, makeDeps());

		expect(mockSnapshot).toHaveBeenCalledWith("/test", "red");
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "green",
		});
		expect(ctx.notifications[0].message).toContain("Skipped to GREEN phase");
		expect(ctx.notifications[0].type).toBe("info");
	});

	it("auto-enables when TDD disabled", async () => {
		mockLoadTddState.mockReturnValue(tddOk({ current: "red", enabled: false }));
		const ctx = makeCtx();
		await handleTddJump("green", ctx, makeDeps());

		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "green",
		});
		expect(ctx.notifications[0].message).toContain("Skipped to GREEN phase");
	});

	it("works for refactor from green", async () => {
		mockLoadTddState.mockReturnValue(tddOk({ current: "green" }));
		const ctx = makeCtx();
		await handleTddJump("refactor", ctx, makeDeps());
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "refactor",
		});
		expect(ctx.notifications[0].message).toContain("Skipped to REFACTOR phase");
	});

	it("works for red from green", async () => {
		mockLoadTddState.mockReturnValue(tddOk({ current: "green" }));
		const ctx = makeCtx();
		await handleTddJump("red", ctx, makeDeps());
		expect(mockSavePhaseState).toHaveBeenCalledWith("/test", {
			enabled: true,
			current: "red",
		});
		expect(ctx.notifications[0].message).toContain("Skipped to RED phase");
	});
});

// ── handleBeforeAgentStart ──────────────────────────────────────────────────

describe("handleBeforeAgentStart", () => {
	let mockLoadTddState: ReturnType<typeof vi.fn>;

	function makeDeps(overrides = {}) {
		return {
			loadTddState: mockLoadTddState,
			...overrides,
		};
	}

	function makeEvent(): { systemPrompt: string } {
		return { systemPrompt: "" };
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadTddState = vi.fn();
	});

	it("appends TDD instructions when TDD enabled", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: true, current: "red" },
			config: {
				blockedInRed: [],
				blockedInGreen: [],
				testCommands: [],
				timeoutSeconds: 30,
			},
		});
		const event = makeEvent();
		await handleBeforeAgentStart(
			event as any,
			{ cwd: "/test" } as any,
			makeDeps(),
		);
		expect(event.systemPrompt).toContain("TDD enforcement");
		expect(event.systemPrompt).toContain("locked files will be blocked");
		expect(event.systemPrompt).toContain("cycle so reverting is cheap");
		expect(event.systemPrompt).not.toContain("next_tdd_phase");
	});

	it("does not modify systemPrompt when TDD not setup", async () => {
		mockLoadTddState.mockReturnValue({
			ok: false,
			reason: "Missing .pi/tdd/",
		});
		const event = makeEvent();
		await handleBeforeAgentStart(
			event as any,
			{ cwd: "/test" } as any,
			makeDeps(),
		);
		expect(event.systemPrompt).toBe("");
	});

	it("appends disabled message when TDD was disabled", async () => {
		mockLoadTddState.mockReturnValue({
			ok: true,
			state: { enabled: false, current: "red" },
			config: {
				blockedInRed: [],
				blockedInGreen: [],
				testCommands: [],
				timeoutSeconds: 30,
			},
		});
		const event = makeEvent();
		await handleBeforeAgentStart(
			event as any,
			{ cwd: "/test" } as any,
			makeDeps(),
		);
		expect(event.systemPrompt).toContain("was disabled");
	});
});

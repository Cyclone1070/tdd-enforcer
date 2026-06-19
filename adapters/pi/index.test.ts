import { beforeEach, describe, expect, it, vi } from "vitest";
import {
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

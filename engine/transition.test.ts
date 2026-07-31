import picomatch from "picomatch";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkGate, getDisallowedChanges, nextPhase } from "./transition.js";
import type { Config, TestRunner } from "./types.js";

// ── Pure unit tests: nextPhase ──────────────────────────────────────────────

describe("nextPhase", () => {
	it("returns green from red", () => {
		expect(nextPhase("red")).toBe("green");
	});

	it("returns refactor from green", () => {
		expect(nextPhase("green")).toBe("refactor");
	});

	it("returns red from refactor", () => {
		expect(nextPhase("refactor")).toBe("red");
	});

	it("returns null for unknown phase", () => {
		expect(nextPhase("blurple" as any)).toBeNull();
	});
});

// ── Pure unit tests: checkGate ──────────────────────────────────────────────

function makeRunner(
	passed: boolean,
	timeout?: boolean,
	cancelled?: boolean,
): TestRunner {
	return async (_cmds, _timeout) => ({
		passed,
		timeout,
		cancelled,
		message: cancelled
			? "Test execution was cancelled."
			: timeout
				? "npm test: timed out"
				: passed
					? "all ok"
					: "tests failed",
	});
}

const testConfig: Config = {
	blockedInRed: [],
	blockedInGreen: [],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

describe("checkGate", () => {
	describe("red → green (tests must fail)", () => {
		it("allows when tests fail", async () => {
			const r = await checkGate("red", "green", makeRunner(false), testConfig);
			expect(r.passed).toBe(true);
			expect(r.message).toMatch(/proceed|fail/i);
		});

		it("blocks when tests pass", async () => {
			const r = await checkGate("red", "green", makeRunner(true), testConfig);
			expect(r.passed).toBe(false);
			expect(r.message).toMatch(/transitioning to GREEN/i);
		});

		it("blocks on timeout — does not treat as test failure", async () => {
			const r = await checkGate(
				"red",
				"green",
				makeRunner(false, true),
				testConfig,
			);
			expect(r.passed).toBe(false);
			expect(r.timeout).toBe(true);
			expect(r.message).toMatch(/timed out/i);
			expect(r.message).not.toMatch(/proceed|fail/i);
		});

		it("blocks on cancellation — preserves cancellation message", async () => {
			const r = await checkGate(
				"red",
				"green",
				makeRunner(false, undefined, true),
				testConfig,
			);
			expect(r.passed).toBe(false);
			expect(r.cancelled).toBe(true);
			expect(r.message).toMatch(/cancelled/i);
			expect(r.message).not.toMatch(/timed out|proceed|fail/i);
		});
	});

	describe("green → refactor (tests must pass)", () => {
		it("allows when tests pass", async () => {
			const r = await checkGate(
				"green",
				"refactor",
				makeRunner(true),
				testConfig,
			);
			expect(r.passed).toBe(true);
			expect(r.message).toMatch(/pass/i);
		});

		it("blocks when tests fail", async () => {
			const r = await checkGate(
				"green",
				"refactor",
				makeRunner(false),
				testConfig,
			);
			expect(r.passed).toBe(false);
			expect(r.message).toMatch(/transitioning to REFACTOR/i);
		});

		it("blocks on timeout with timeout message", async () => {
			const r = await checkGate(
				"green",
				"refactor",
				makeRunner(false, true),
				testConfig,
			);
			expect(r.passed).toBe(false);
			expect(r.timeout).toBe(true);
			expect(r.message).toMatch(/timed out/i);
			expect(r.message).not.toMatch(/fix them/i);
		});

		it("blocks on cancellation — preserves cancellation message", async () => {
			const r = await checkGate(
				"green",
				"refactor",
				makeRunner(false, undefined, true),
				testConfig,
			);
			expect(r.passed).toBe(false);
			expect(r.cancelled).toBe(true);
			expect(r.message).toMatch(/cancelled/i);
			expect(r.message).not.toMatch(/timed out|fix them/i);
		});
	});

	describe("refactor → red (tests must pass)", () => {
		it("allows when tests pass", async () => {
			const r = await checkGate(
				"refactor",
				"red",
				makeRunner(true),
				testConfig,
			);
			expect(r.passed).toBe(true);
			expect(r.message).toMatch(/pass/i);
		});

		it("blocks when tests fail", async () => {
			const r = await checkGate(
				"refactor",
				"red",
				makeRunner(false),
				testConfig,
			);
			expect(r.passed).toBe(false);
			expect(r.message).toMatch(/transitioning to RED/i);
		});

		it("blocks on timeout with timeout message", async () => {
			const r = await checkGate(
				"refactor",
				"red",
				makeRunner(false, true),
				testConfig,
			);
			expect(r.passed).toBe(false);
			expect(r.timeout).toBe(true);
			expect(r.message).toMatch(/timed out/i);
			expect(r.message).not.toMatch(/fix them/i);
		});

		it("blocks on cancellation — preserves cancellation message", async () => {
			const r = await checkGate(
				"refactor",
				"red",
				makeRunner(false, undefined, true),
				testConfig,
			);
			expect(r.passed).toBe(false);
			expect(r.cancelled).toBe(true);
			expect(r.message).toMatch(/cancelled/i);
			expect(r.message).not.toMatch(/timed out|fix them/i);
		});
	});

	it("passes test commands to the runner", async () => {
		let captured: string[] | undefined;
		const runner: TestRunner = async (cmds) => {
			captured = cmds;
			return { passed: true, message: "" };
		};
		await checkGate("red", "green", runner, testConfig);
		expect(captured).toEqual(["npm test"]);
	});

	it("passes timeoutSeconds to the runner", async () => {
		let captured: number | undefined;
		const runner: TestRunner = async (_cmds, t) => {
			captured = t;
			return { passed: true, message: "" };
		};
		await checkGate("red", "green", runner, testConfig);
		expect(captured).toBe(30);
	});

	it("passes multiple test commands to the runner", async () => {
		const multiConfig: Config = {
			...testConfig,
			testCommands: ["npm run test:unit", "npm run test:integration"],
		};
		let captured: string[] | undefined;
		const runner: TestRunner = async (cmds) => {
			captured = cmds;
			return { passed: true, message: "" };
		};
		await checkGate("red", "green", runner, multiConfig);
		expect(captured).toHaveLength(2);
		expect(captured).toContain("npm run test:unit");
		expect(captured).toContain("npm run test:integration");
	});
});

// ── Pure unit tests: getDisallowedChanges ────────────────────────────────────

const denyConfig: Config = {
	blockedInRed: ["src/**/*.ts"],
	blockedInGreen: ["tests/**/*.test.ts"],
	testCommands: [],
	timeoutSeconds: 30,
};

describe("getDisallowedChanges", () => {
	let mockChangesSinceSnapshot: ReturnType<typeof vi.fn>;
	let mockDisallowedFiles: ReturnType<typeof vi.fn>;

	function makeDeps(overrides = {}) {
		return {
			changesSinceSnapshot: mockChangesSinceSnapshot,
			disallowedFiles: mockDisallowedFiles,
			...overrides,
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockChangesSinceSnapshot = vi.fn().mockReturnValue([]);
		mockDisallowedFiles = vi.fn().mockReturnValue([]);
	});

	it("returns empty for refactor phase regardless of git state", () => {
		const result = getDisallowedChanges(
			"/any",
			"refactor",
			denyConfig,
			makeDeps(),
		);
		expect(result).toEqual([]);
		expect(mockChangesSinceSnapshot).not.toHaveBeenCalled();
	});

	it("returns empty when no files changed", () => {
		mockChangesSinceSnapshot.mockReturnValue([]);
		const result = getDisallowedChanges("/test", "red", denyConfig, makeDeps());
		expect(result).toEqual([]);
		expect(mockChangesSinceSnapshot).toHaveBeenCalledWith("/test");
	});

	it("returns disallowed files in red phase", () => {
		mockChangesSinceSnapshot.mockReturnValue([
			"src/main.ts",
			"tests/foo.test.ts",
			"README.md",
		]);
		const matchBlockedInRed = picomatch(denyConfig.blockedInRed);
		mockDisallowedFiles.mockImplementation(
			(changed: string[], phase: string) => {
				if (phase === "red") {
					return changed.filter((f: string) => matchBlockedInRed(f));
				}
				return [];
			},
		);
		const violations = getDisallowedChanges(
			"/test",
			"red",
			denyConfig,
			makeDeps(),
		);
		expect(violations).toContain("src/main.ts");
		expect(violations).not.toContain("tests/foo.test.ts");
		expect(violations).not.toContain("README.md");
	});

	it("returns disallowed files in green phase", () => {
		mockChangesSinceSnapshot.mockReturnValue([
			"tests/foo.test.ts",
			"src/main.ts",
			"package.json",
		]);
		const matchBlockedInGreen = picomatch(denyConfig.blockedInGreen);
		mockDisallowedFiles.mockImplementation(
			(changed: string[], phase: string) => {
				if (phase === "green") {
					return changed.filter((f: string) => matchBlockedInGreen(f));
				}
				return [];
			},
		);
		const violations = getDisallowedChanges(
			"/test",
			"green",
			denyConfig,
			makeDeps(),
		);
		expect(violations).toContain("tests/foo.test.ts");
		expect(violations).not.toContain("src/main.ts");
		expect(violations).not.toContain("package.json");
	});

	it("catches untracked files, not just modified", () => {
		mockChangesSinceSnapshot.mockReturnValue(["src/new.ts"]);
		const matchBlockedInRed = picomatch(denyConfig.blockedInRed);
		mockDisallowedFiles.mockImplementation(
			(changed: string[], phase: string) => {
				if (phase === "red") {
					return changed.filter((f: string) => matchBlockedInRed(f));
				}
				return [];
			},
		);
		const violations = getDisallowedChanges(
			"/test",
			"red",
			denyConfig,
			makeDeps(),
		);
		expect(violations).toContain("src/new.ts");
	});
});

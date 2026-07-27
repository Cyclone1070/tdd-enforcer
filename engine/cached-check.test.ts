import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCachedCheck } from "./cached-check.js";
import type { Config } from "./types.js";

// ── helpers ─────────────────────────────────────────────────────────────────

function makeTestRunner() {
	return vi.fn().mockResolvedValue({ passed: true, message: "" });
}

const testConfig: Config = {
	implFiles: ["src/**/*.ts"],
	testFiles: ["tests/**/*.test.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

const emptyGreenConfig: Config = {
	implFiles: ["src/**/*.ts"],
	testFiles: [],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

// ── describe ────────────────────────────────────────────────────────────────

describe("runCachedCheck", () => {
	let deps: Record<string, any>;
	let findRedHash: ReturnType<typeof vi.fn>;
	let changesSince: ReturnType<typeof vi.fn>;
	let execSync: ReturnType<typeof vi.fn>;
	let existsSync: ReturnType<typeof vi.fn>;
	let mkdirSync: ReturnType<typeof vi.fn>;
	let copyFileSync: ReturnType<typeof vi.fn>;
	let rmSync: ReturnType<typeof vi.fn>;
	let testRunner: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		findRedHash = vi.fn();
		changesSince = vi.fn();
		execSync = vi.fn();
		existsSync = vi.fn();
		mkdirSync = vi.fn();
		copyFileSync = vi.fn();
		rmSync = vi.fn();
		testRunner = makeTestRunner();

		deps = {
			findRedHash,
			changesSince,
			execSync,
			existsSync,
			mkdirSync,
			copyFileSync,
			rmSync,
		};
	});

	it("returns passed=true when testFiles is empty (nothing to check)", async () => {
		const result = await runCachedCheck(
			"/test",
			emptyGreenConfig,
			testRunner,
			deps,
		);
		expect(result.passed).toBe(true);
		expect(result.message).toBeUndefined();
		expect(findRedHash).not.toHaveBeenCalled();
	});

	it("returns passed=true when findRedHash returns null (no RED snapshot)", async () => {
		findRedHash.mockReturnValue(null);

		const result = await runCachedCheck("/test", testConfig, testRunner, deps);
		expect(result.passed).toBe(true);
		expect(changesSince).not.toHaveBeenCalled();
	});

	it("returns passed=true when no changed files match testFiles patterns", async () => {
		findRedHash.mockReturnValue("abc123");
		changesSince.mockReturnValue(["src/main.ts", "README.md"]);

		const result = await runCachedCheck("/test", testConfig, testRunner, deps);
		expect(result.passed).toBe(true);
		expect(execSync).not.toHaveBeenCalled();
	});

	it("creates temp dir under .pi/tdd/tmp/", async () => {
		findRedHash.mockReturnValue("abc123def456");
		changesSince.mockReturnValue(["tests/foo.test.ts"]);
		existsSync.mockReturnValue(true);

		await runCachedCheck("/test", testConfig, testRunner, deps);

		expect(mkdirSync).toHaveBeenCalledWith(
			expect.stringContaining("/.pi/tdd/tmp/"),
			{ recursive: true },
		);
	});

	it("git checkouts RED state into temp dir", async () => {
		findRedHash.mockReturnValue("abc123def456");
		changesSince.mockReturnValue(["tests/foo.test.ts"]);
		existsSync.mockReturnValue(true);

		await runCachedCheck("/test", testConfig, testRunner, deps);

		// Should use --git-dir with the private git repo and --work-tree with temp dir
		const checkoutCall = execSync.mock.calls.find((call: any) =>
			call[0].includes("checkout"),
		);
		expect(checkoutCall).toBeTruthy();
		const cmd = checkoutCall[0] as string;
		expect(cmd).toContain("--git-dir");
		expect(cmd).toContain("/.pi/tdd/.git");
		expect(cmd).toContain("--work-tree");
		expect(cmd).toContain("/.pi/tdd/tmp/");
		expect(cmd).toContain("abc123def456");
	});

	it("copies changed test files over RED checkout", async () => {
		findRedHash.mockReturnValue("abc123");
		changesSince.mockReturnValue(["tests/foo.test.ts", "tests/bar.test.ts"]);
		existsSync.mockReturnValue(true);

		await runCachedCheck("/test", testConfig, testRunner, deps);

		expect(copyFileSync).toHaveBeenCalledWith(
			"/test/tests/foo.test.ts",
			expect.stringContaining("tests/foo.test.ts"),
		);
		expect(copyFileSync).toHaveBeenCalledWith(
			"/test/tests/bar.test.ts",
			expect.stringContaining("tests/bar.test.ts"),
		);
	});

	it("detects deleted test files and removes them from temp dir", async () => {
		findRedHash.mockReturnValue("abc123");
		changesSince.mockReturnValue(["tests/deleted.test.ts"]);
		// File does not exist in working tree → was deleted
		existsSync.mockReturnValue(false);

		await runCachedCheck("/test", testConfig, testRunner, deps);

		// Should NOT copy the deleted file
		expect(copyFileSync).not.toHaveBeenCalled();
		// Should remove the file from temp dir
		expect(rmSync).toHaveBeenCalledWith(
			expect.stringContaining("tests/deleted.test.ts"),
		);
	});

	it("runs test commands against the overlaid temp dir", async () => {
		findRedHash.mockReturnValue("abc123");
		changesSince.mockReturnValue(["tests/foo.test.ts"]);
		existsSync.mockReturnValue(true);

		await runCachedCheck("/test", testConfig, testRunner, deps);

		expect(testRunner).toHaveBeenCalledWith(["npm test"], 30);
	});

	it("returns passed=false when tests PASS against RED code (fraud detected)", async () => {
		findRedHash.mockReturnValue("abc123");
		changesSince.mockReturnValue(["tests/foo.test.ts"]);
		existsSync.mockReturnValue(true);
		testRunner.mockResolvedValue({ passed: true, message: "all tests pass" });

		const result = await runCachedCheck("/test", testConfig, testRunner, deps);

		expect(result.passed).toBe(false);
		expect(result.message).toContain("pass against RED code");
	});

	it("returns passed=true when tests FAIL against RED code (legitimate change)", async () => {
		findRedHash.mockReturnValue("abc123");
		changesSince.mockReturnValue(["tests/foo.test.ts"]);
		existsSync.mockReturnValue(true);
		testRunner.mockResolvedValue({
			passed: false,
			message: "tests fail as expected",
		});

		const result = await runCachedCheck("/test", testConfig, testRunner, deps);

		expect(result.passed).toBe(true);
	});

	it("cleans up temp dir after run (finally block)", async () => {
		findRedHash.mockReturnValue("abc123");
		changesSince.mockReturnValue(["tests/foo.test.ts"]);
		existsSync.mockReturnValue(true);

		await runCachedCheck("/test", testConfig, testRunner, deps);

		expect(rmSync).toHaveBeenCalledWith(
			expect.stringContaining("/.pi/tdd/tmp/"),
			{ recursive: true, force: true },
		);
	});

	it("cleans up temp dir even when test runner throws", async () => {
		findRedHash.mockReturnValue("abc123");
		changesSince.mockReturnValue(["tests/foo.test.ts"]);
		existsSync.mockReturnValue(true);
		testRunner.mockRejectedValue(new Error("runner crash"));

		await runCachedCheck("/test", testConfig, testRunner, deps);

		expect(rmSync).toHaveBeenCalledWith(
			expect.stringContaining("/.pi/tdd/tmp/"),
			{ recursive: true, force: true },
		);
	});

	it("handles test runner timeout", async () => {
		findRedHash.mockReturnValue("abc123");
		changesSince.mockReturnValue(["tests/foo.test.ts"]);
		existsSync.mockReturnValue(true);
		testRunner.mockResolvedValue({
			passed: false,
			message: "timed out",
			timeout: true,
		});

		const result = await runCachedCheck("/test", testConfig, testRunner, deps);

		expect(result.passed).toBe(false);
		expect(result.timeout).toBe(true);
	});

	it("handles test runner cancellation", async () => {
		findRedHash.mockReturnValue("abc123");
		changesSince.mockReturnValue(["tests/foo.test.ts"]);
		existsSync.mockReturnValue(true);
		testRunner.mockResolvedValue({
			passed: false,
			message: "cancelled",
			cancelled: true,
		});

		const result = await runCachedCheck("/test", testConfig, testRunner, deps);

		expect(result.passed).toBe(false);
		expect(result.cancelled).toBe(true);
	});
});

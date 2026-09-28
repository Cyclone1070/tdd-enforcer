import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTddState, savePhaseState } from "../../engine/index.js";
import {
	backgroundJobId,
	formatWarning,
	needsBracket,
	resultText,
	TddEnforcer,
} from "./enforcement.js";
import type { HostContext, ToolExecution } from "./types.js";

const RULES = {
	blockedInRed: ["src/**/*.ts", "!src/**/*.test.ts"],
	blockedInGreen: ["**/*.test.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

const SESSION = "session-1";

let root: string;
let ctx: HostContext;
let enforcer: TddEnforcer;

function fakeCtx(sessionRoot: string): HostContext {
	const noop = () => () => {};
	return {
		on: noop,
		inject: () => undefined,
		tools: { guard: noop, register: noop },
		sessions: { get: () => ({ header: { cwd: sessionRoot } }) },
	};
}

function call(
	name: string,
	args: unknown,
	callId = `call-${name}`,
): Readonly<ToolExecution> {
	return { callId, name, arguments: args, agent: { sessionId: SESSION } };
}

function setPhase(phase: "red" | "green"): void {
	savePhaseState(root, { enabled: true, current: phase });
}

beforeEach(() => {
	process.env.GIT_AUTHOR_NAME ??= "tdd-test";
	process.env.GIT_AUTHOR_EMAIL ??= "tdd@test.local";
	process.env.GIT_COMMITTER_NAME ??= "tdd-test";
	process.env.GIT_COMMITTER_EMAIL ??= "tdd@test.local";

	root = join(tmpdir(), `tdd-dsh-${Date.now()}-${Math.random()}`);
	mkdirSync(join(root, ".tdd"), { recursive: true });
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(join(root, ".tdd", "rules.json"), JSON.stringify(RULES));
	writeFileSync(join(root, "src", "app.ts"), "original");

	// Real private git history with a RED baseline.
	loadTddState(root);
	setPhase("red");

	ctx = fakeCtx(root);
	enforcer = new TddEnforcer(ctx);
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("tool classification", () => {
	it("guards only the tools that name their target path", () => {
		expect(needsBracket("write")).toBe(false);
		expect(needsBracket("edit")).toBe(false);
	});

	it("brackets bash, MCP tools, and unknown tools", () => {
		expect(needsBracket("bash")).toBe(true);
		expect(needsBracket("mcp__server__apply_patch")).toBe(true);
		expect(needsBracket("some_future_tool")).toBe(true);
	});

	it("skips read-only tools and its own tools", () => {
		for (const name of [
			"read",
			"grep",
			"glob",
			"web_fetch",
			"todo_write",
			"next_tdd_phase",
			"previous_tdd_phase",
			"tdd_status",
		]) {
			expect(needsBracket(name)).toBe(false);
		}
	});
});

describe("guard on write/edit", () => {
	it("denies a file locked in the current phase", () => {
		const reason = enforcer.guardExecution(
			call("write", { file_path: join(root, "src", "app.ts") }),
		);
		expect(reason).toContain("RED");
		expect(reason).toContain("src/app.ts");
	});

	it("denies a relative path the same way", () => {
		const reason = enforcer.guardExecution(
			call("edit", { file_path: "src/app.ts" }),
		);
		expect(reason).toContain("src/app.ts");
	});

	it("allows a file the phase does not lock", () => {
		expect(
			enforcer.guardExecution(call("write", { file_path: "src/app.test.ts" })),
		).toBeUndefined();
	});

	it("locks the TDD bookkeeping files in both layouts", () => {
		for (const path of [".tdd/state.json", ".pi/tdd/rules.json"]) {
			const reason = enforcer.guardExecution(
				call("write", { file_path: path }),
			);
			expect(reason).toContain("Config files are locked");
		}
	});

	it("passes everything through when TDD is disabled", () => {
		savePhaseState(root, { enabled: false, current: "red" });
		expect(
			enforcer.guardExecution(call("write", { file_path: "src/app.ts" })),
		).toBeUndefined();
	});

	it("ignores tools that are not write/edit", () => {
		expect(
			enforcer.guardExecution(call("bash", { command: "rm src/app.ts" })),
		).toBeUndefined();
	});
});

describe("snapshot bracket", () => {
	it("reverts locked files and keeps allowed ones", () => {
		const exec = call("bash", { command: "hack" });
		enforcer.beginBracket(exec);

		writeFileSync(join(root, "src", "app.ts"), "hacked");
		writeFileSync(join(root, "src", "app.test.ts"), "new test");

		const warning = enforcer.finishBracket(exec, {
			value: { kind: "foreground", exitCode: 0 },
			content: [{ type: "text", text: "bash output" }],
		});

		expect(warning).toContain("src/app.ts");
		expect(readFileSync(join(root, "src", "app.ts"), "utf8")).toBe("original");
		expect(existsSync(join(root, "src", "app.test.ts"))).toBe(true);
		expect(enforcer.openBrackets).toBe(0);
	});

	it("reverts TDD bookkeeping written by bash", () => {
		const exec = call("mcp__fs__write", {});
		enforcer.beginBracket(exec);
		writeFileSync(join(root, ".tdd", "state.json"), '{"enabled":false}');

		const warning = enforcer.finishBracket(exec, { value: {} });

		expect(warning).toContain(".tdd/state.json");
		expect(readFileSync(join(root, ".tdd", "state.json"), "utf8")).toContain(
			"true",
		);
	});

	it("restores a pre-existing untracked locked file instead of deleting it", () => {
		// Work in progress that the private repo never committed: reverting a
		// call that rewrote it must bring the old content back, not unlink it.
		const wip = join(root, "src", "wip.ts");
		writeFileSync(wip, "work in progress");
		const exec = call("bash", { command: "hack" });
		enforcer.beginBracket(exec);
		writeFileSync(wip, "hacked");

		const warning = enforcer.finishBracket(exec, { value: {} });

		expect(warning).toContain("src/wip.ts");
		expect(existsSync(wip)).toBe(true);
		expect(readFileSync(wip, "utf8")).toBe("work in progress");
	});

	it("returns nothing when the call changed nothing", () => {
		const exec = call("bash", { command: "ls" });
		enforcer.beginBracket(exec);
		expect(enforcer.finishBracket(exec, { value: {} })).toBeUndefined();
	});

	it("keeps brackets bounded without dropping recent ones", () => {
		// A time limit would silently drop long-running calls; the bound is a
		// count instead, and it only ever removes the oldest entries. The bound
		// is injected so the test does not need 200 real snapshots.
		const bounded = new TddEnforcer(ctx, 3);
		for (let index = 0; index < 4; index += 1) {
			bounded.beginBracket(
				call("bash", { command: `job ${index}` }, `c-${index}`),
			);
		}
		expect(bounded.openBrackets).toBe(3);

		const newest = call("bash", { command: "newest" }, "c-newest");
		bounded.beginBracket(newest);
		expect(bounded.openBrackets).toBe(3);
		writeFileSync(join(root, "src", "app.ts"), "hacked");
		expect(bounded.finishBracket(newest, { value: {} })).toContain(
			"src/app.ts",
		);
	});

	it("opens no bracket while TDD is disabled", () => {
		savePhaseState(root, { enabled: false, current: "red" });
		const exec = call("bash", { command: "hack" });
		enforcer.beginBracket(exec);
		expect(enforcer.openBrackets).toBe(0);
	});

	it("keeps non-locked changes of a denied-looking call", () => {
		setPhase("green");
		const exec = call("bash", { command: "write a test" });
		enforcer.beginBracket(exec);
		writeFileSync(join(root, "src", "app.test.ts"), "test");
		const warning = enforcer.finishBracket(exec, { value: {} });
		expect(warning).toContain("src/app.test.ts");
		expect(existsSync(join(root, "src", "app.test.ts"))).toBe(false);
	});
});

describe("background jobs", () => {
	it("hands the bracket to the job and reverts when it settles", () => {
		const exec = call("bash", { command: "long job" });
		enforcer.beginBracket(exec);
		writeFileSync(join(root, "src", "app.ts"), "hacked in background");

		expect(
			enforcer.finishBracket(exec, {
				value: { kind: "background", jobId: "bash-7" },
			}),
		).toBeUndefined();
		expect(readFileSync(join(root, "src", "app.ts"), "utf8")).toBe(
			"hacked in background",
		);

		enforcer.handleJobSettled("bash-7");

		expect(readFileSync(join(root, "src", "app.ts"), "utf8")).toBe("original");
		const notices = enforcer.drainNotices(exec);
		expect(notices).toHaveLength(1);
		expect(String(notices[0].text)).toContain("bash-7");
		expect(enforcer.drainNotices(exec)).toHaveLength(0);
	});

	it("ignores untracked jobs and settled jobs with no violations", () => {
		expect(() => enforcer.handleJobSettled("bash-9")).not.toThrow();

		const exec = call("bash", { command: "ls" });
		enforcer.beginBracket(exec);
		enforcer.finishBracket(exec, {
			value: { kind: "background", jobId: "bash-8" },
		});
		enforcer.handleJobSettled("bash-8");
		expect(enforcer.drainNotices(exec)).toHaveLength(0);
	});
});

describe("helpers", () => {
	it("reads the job id out of background results only", () => {
		expect(
			backgroundJobId({ value: { kind: "background", jobId: "bash-1" } }),
		).toBe("bash-1");
		expect(backgroundJobId({ value: { kind: "foreground" } })).toBeUndefined();
		expect(
			backgroundJobId({ value: { kind: "promoted", jobId: "bash-2" } }),
		).toBeUndefined();
		expect(backgroundJobId(undefined)).toBeUndefined();
	});

	it("joins the text blocks of a result", () => {
		expect(
			resultText({
				content: [
					{ type: "text", text: "a" },
					{ type: "text", text: "b" },
				],
			}),
		).toBe("ab");
		expect(resultText(undefined)).toBe("");
	});

	it("names the tool that was reverted", () => {
		const bracket = {
			stashHash: "HEAD",
			phase: "red" as const,
			config: {
				blockedInRed: [],
				blockedInGreen: [],
				testCommands: [],
				timeoutSeconds: 1,
			},
			root: "/tmp",
			toolName: "bash",
			at: Date.now(),
		};
		expect(formatWarning(bracket, ["src/app.ts"], [])).toContain(
			"reverted locked files modified by bash",
		);
		expect(
			formatWarning(
				{ ...bracket, toolName: "mcp__x" },
				["src/app.ts"],
				["ok.ts"],
			),
		).toContain('modified by "mcp__x"');
	});
});

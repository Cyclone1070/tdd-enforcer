/**
 * Wiring test: drives `apply()` with a fake host context and pushes fake
 * executions through the same listeners the harness calls.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTddState, savePhaseState } from "../../engine/index.js";
import { apply } from "./index.js";
import type {
	HostContext,
	PostToolDecision,
	PreToolDecision,
	ToolDefinition,
	ToolExecution,
	ToolExecutionResult,
} from "./types.js";

const RULES = {
	blockedInRed: ["src/**/*.ts", "!src/**/*.test.ts"],
	blockedInGreen: ["**/*.test.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

const SESSION = "session-1";

interface Harness {
	guard?: (exec: Readonly<ToolExecution>) => string | undefined;
	pre?: (
		exec: Readonly<ToolExecution>,
		next: () => Promise<PreToolDecision>,
	) => Promise<PreToolDecision>;
	post?: (
		exec: Readonly<ToolExecution>,
		result: Readonly<ToolExecutionResult>,
		next: () => Promise<PostToolDecision>,
	) => Promise<PostToolDecision>;
	tools: Record<string, ToolDefinition>;
	commands: string[];
	skills: string[];
	injected: string[];
	onJobEvent?: (event: { type?: string; job?: { id?: string } }) => void;
}

let root: string;
let harness: Harness;

function mount(sessionRoot: string): Harness {
	const found: Harness = { tools: {}, commands: [], skills: [], injected: [] };
	const ctx = {
		on: (event: string, listener: unknown) => {
			if (event === "tools/pre-execute") {
				found.pre = listener as Harness["pre"];
			}
			if (event === "tools/post-execute") {
				found.post = listener as Harness["post"];
			}
			return () => {};
		},
		inject: (deps: string[], callback: (ctx: unknown) => void) => {
			found.injected.push(deps[0]);
			callback(ctx);
			return {};
		},
		jobs: {
			events: {
				subscribe: (
					_filter: unknown,
					listener: (event: { type?: string; job?: { id?: string } }) => void,
				) => {
					found.onJobEvent = listener;
					return () => {};
				},
			},
		},
		tools: {
			guard: (guard: Harness["guard"]) => {
				found.guard = guard;
				return () => {};
			},
			register: (definition: ToolDefinition) => {
				found.tools[definition.name] = definition;
				return () => {};
			},
		},
		commands: {
			register: (definition: { name: string }) => {
				found.commands.push(definition.name);
				return () => {};
			},
		},
		skills: {
			register: (registration: { name: string }) => {
				found.skills.push(registration.name);
				return () => {};
			},
		},
		sessions: {
			get: (id: string) =>
				id === SESSION ? { header: { cwd: sessionRoot } } : undefined,
		},
	};
	apply(ctx as unknown as HostContext);
	return found;
}

function call(name: string, args: unknown): Readonly<ToolExecution> {
	return {
		callId: `call-${name}`,
		name,
		arguments: args,
		agent: { sessionId: SESSION },
	};
}

/** The live host shape: the agent carries `id`, not `sessionId`. */
function liveCall(name: string, args: unknown): Readonly<ToolExecution> {
	return {
		callId: `call-live-${name}`,
		name,
		arguments: args,
		agent: { id: SESSION },
	};
}

beforeEach(() => {
	process.env.GIT_AUTHOR_NAME ??= "tdd-test";
	process.env.GIT_AUTHOR_EMAIL ??= "tdd@test.local";
	process.env.GIT_COMMITTER_NAME ??= "tdd-test";
	process.env.GIT_COMMITTER_EMAIL ??= "tdd@test.local";

	root = join(tmpdir(), `tdd-dsh-apply-${Date.now()}-${Math.random()}`);
	mkdirSync(join(root, ".tdd"), { recursive: true });
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(join(root, ".tdd", "rules.json"), JSON.stringify(RULES));
	writeFileSync(join(root, "src", "app.ts"), "original");
	loadTddState(root);
	savePhaseState(root, { enabled: true, current: "red" });

	harness = mount(root);
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("apply", () => {
	it("registers the guard, both pipeline listeners, commands, tools and skill", () => {
		expect(typeof harness.guard).toBe("function");
		expect(typeof harness.pre).toBe("function");
		expect(typeof harness.post).toBe("function");
		expect(Object.keys(harness.tools).sort()).toEqual([
			"next_tdd_phase",
			"previous_tdd_phase",
			"tdd_status",
		]);
		expect(harness.commands.sort()).toEqual([
			"tdd-green",
			"tdd-off",
			"tdd-on",
			"tdd-red",
			"tdd-reset",
			"tdd-status",
		]);
		expect(harness.skills).toEqual(["tdd-enforcer"]);
		// Background bash brackets settle through the jobs service.
		expect(harness.injected).toEqual(["jobs", "commands", "skills"]);
		expect(typeof harness.onJobEvent).toBe("function");
	});

	it("denies a locked write through the guard", () => {
		const reason = harness.guard?.(call("write", { file_path: "src/app.ts" }));
		expect(reason).toContain("locked in this phase");
		expect(
			harness.guard?.(
				call("write", { file_path: "src/app.test.ts", content: "x" }),
			),
		).toBeUndefined();
	});

	it("blocks and reverts a bash call that touched a locked file", async () => {
		const exec = call("bash", { command: "hack" });
		await harness.pre?.(exec, async () => ({ kind: "allow" }));
		writeFileSync(join(root, "src", "app.ts"), "hacked");

		let nextCalled = false;
		const decision = await harness.post?.(
			exec,
			{
				value: { kind: "foreground", exitCode: 0 },
				content: [{ type: "text", text: "out" }],
			},
			async () => {
				nextCalled = true;
				return { kind: "accept" };
			},
		);

		expect(decision?.kind).toBe("block");
		expect(nextCalled).toBe(false);
		const text =
			decision?.kind === "block" ? String(decision.feedback[0].text) : "";
		expect(text).toContain("out");
		expect(text).toContain("src/app.ts");
		expect(readFileSync(join(root, "src", "app.ts"), "utf8")).toBe("original");
	});

	it("accepts a bash call that changed nothing locked", async () => {
		const exec = call("bash", { command: "ls" });
		await harness.pre?.(exec, async () => ({ kind: "allow" }));
		const decision = await harness.post?.(
			exec,
			{ value: { kind: "foreground", exitCode: 0 } },
			async () => ({ kind: "accept" }),
		);
		expect(decision?.kind).toBe("accept");
	});

	it("runs the registered tdd_status tool", async () => {
		const definition = harness.tools.tdd_status;
		const value = (await definition.execute({}, {
			...call("tdd_status", {}),
		} as never)) as { text: string };

		expect(value.text).toContain("RED");
		expect(definition.output.render({}, value)).toEqual([
			{ type: "text", text: value.text },
		]);
	});

	it("acts on the session's project even when the host runs elsewhere", async () => {
		// `process.cwd()` is this repository, itself a valid TDD project that
		// allows `src/app.ts` and locks `engine/**`. Resolving against it would
		// both allow this write and report the wrong rules, so the assertions
		// below only hold when the session's project is used.
		expect(
			harness.guard?.(liveCall("write", { file_path: "src/app.ts" })),
		).toContain("locked in this phase");

		const value = (await harness.tools.tdd_status.execute({}, {
			...liveCall("tdd_status", {}),
		} as never)) as { text: string };
		expect(value.text).toContain("src/**/*.ts");
		expect(value.text).not.toContain("engine/**/*.ts");
	});

	it("reverts a background job when it settles and reports it afterwards", async () => {
		const exec = call("bash", { command: "long job" });
		await harness.pre?.(exec, async () => ({ kind: "allow" }));
		writeFileSync(join(root, "src", "app.ts"), "hacked in background");

		// The tool answers before the process is done: accept and keep the bracket.
		const decision = await harness.post?.(
			exec,
			{ value: { kind: "background", jobId: "bash-42" } },
			async () => ({ kind: "accept" }),
		);
		expect(decision?.kind).toBe("accept");
		expect(readFileSync(join(root, "src", "app.ts"), "utf8")).toBe(
			"hacked in background",
		);

		// The job settles: the locked file goes back.
		harness.onJobEvent?.({ type: "settled", job: { id: "bash-42" } });
		expect(readFileSync(join(root, "src", "app.ts"), "utf8")).toBe("original");

		// The next accepted result carries the notice.
		const followUp = await harness.post?.(
			call("read", { file_path: "src/app.ts" }),
			{ content: [{ type: "text", text: "file body" }] },
			async () => ({ kind: "accept" }),
		);
		const text =
			followUp?.kind === "accept"
				? (followUp.content ?? []).map((b) => String(b.text ?? "")).join("")
				: "";
		expect(text).toContain("file body");
		expect(text).toContain("bash-42");
	});

	it("advances RED to GREEN when the test command fails", async () => {
		// `npm test` fails in an empty temp dir, which is exactly what RED needs.
		const definition = harness.tools.next_tdd_phase;
		const value = (await definition.execute({}, {
			...call("next_tdd_phase", {}),
		} as never)) as { text: string };

		expect(value.text).toContain("GREEN");
	});

	it("blocks the gate when the required test outcome is missing", async () => {
		savePhaseState(root, { enabled: true, current: "green" });
		const definition = harness.tools.next_tdd_phase;
		await expect(
			definition.execute({}, { ...call("next_tdd_phase", {}) } as never),
		).rejects.toThrow(/fail/i);
	});
});

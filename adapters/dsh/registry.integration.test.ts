/**
 * End-to-end verification against the *real* DSH tool registry.
 *
 * Everything else in this folder drives the adapter with a fake context. This
 * test mounts the actual `ToolRuntime` service from the installed harness,
 * applies the built bundle to it, registers two fake tools (`write` and
 * `bash`), and executes calls through the real pipeline — pre-execute, guard,
 * dispatch, post-execute — so the wiring the host will use is proven rather
 * than simulated.
 *
 * It is skipped unless a DSH installation and `dist/dsh/bundle.js` are both
 * present, so `npm run build` first if you want to run it.
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DSH_ROOT =
	process.env.DSH_PACKAGE_ROOT ??
	"/usr/local/lib/node_modules/@deepseek-ai/dsh";
const DSH_SCOPE = join(DSH_ROOT, "node_modules", "@deepseek-ai");
const CORDIS = join(DSH_SCOPE, "cordis", "lib", "index.js");
const TOOLS = join(DSH_SCOPE, "dsh-tools", "lib", "index.js");
const BUNDLE = join(process.cwd(), "dist", "dsh", "bundle.js");

const available = existsSync(CORDIS) && existsSync(TOOLS) && existsSync(BUNDLE);

/** Load one file outside this package without Vite touching the specifier. */
const load = (path: string) =>
	import(/* @vite-ignore */ pathToFileURL(path).href);

describe.skipIf(!available)("real DSH tool registry", () => {
	let root: string;
	let ctx: any;
	let cwd: string;
	let bodyRan: string[];
	let counter = 0;

	const nextCallId = () => {
		counter += 1;
		return `call-${counter}`;
	};

	const run = (name: string, args: unknown) =>
		ctx.tools.execute({
			callId: nextCallId(),
			name,
			arguments: args,
			signal: new AbortController().signal,
		});

	const textOf = (result: any) =>
		(result?.content ?? [])
			.map((block: { text?: string }) => block.text ?? "")
			.join("");

	beforeAll(async () => {
		const { Context } = await load(CORDIS);
		const { default: ToolRuntime } = await load(TOOLS);
		const { apply } = await load(BUNDLE);

		process.env.GIT_AUTHOR_NAME ??= "tdd-test";
		process.env.GIT_AUTHOR_EMAIL ??= "tdd@test.local";
		process.env.GIT_COMMITTER_NAME ??= "tdd-test";
		process.env.GIT_COMMITTER_EMAIL ??= "tdd@test.local";

		root = join(tmpdir(), `tdd-dsh-registry-${Date.now()}-${Math.random()}`);
		mkdirSync(join(root, ".tdd"), { recursive: true });
		mkdirSync(join(root, "src"), { recursive: true });
		writeFileSync(
			join(root, ".tdd", "rules.json"),
			JSON.stringify({
				blockedInRed: ["src/**/*.ts", "!src/**/*.test.ts"],
				blockedInGreen: ["**/*.test.ts"],
				testCommands: ["npm test"],
				timeoutSeconds: 30,
			}),
		);
		writeFileSync(
			join(root, ".tdd", "state.json"),
			JSON.stringify({ enabled: true, current: "red" }),
		);
		writeFileSync(join(root, "src", "app.ts"), "original");

		// Without an agent, the adapter resolves the project root from the
		// process directory — the same fallback a host without sessions uses.
		cwd = process.cwd();
		process.chdir(root);

		ctx = new Context();
		ctx.provide("systemPrompt", {
			section: () => () => {},
			tools: () => () => {},
		});
		ctx.provide("sessions", { get: () => undefined });
		ctx.plugin(ToolRuntime);
		await new Promise((resolve) => setTimeout(resolve, 100));

		apply(ctx);
		await new Promise((resolve) => setTimeout(resolve, 50));

		bodyRan = [];
		ctx.tools.register({
			name: "write",
			description: "fake write",
			parameters: {
				type: "object",
				properties: {
					file_path: { type: "string" },
					content: { type: "string" },
				},
				required: ["file_path", "content"],
			},
			output: {
				schema: {
					type: "object",
					properties: { ok: { type: "boolean" } },
					required: ["ok"],
				},
				render: () => [{ type: "text", text: "wrote it" }],
			},
			execute: async (args: { file_path: string; content: string }) => {
				bodyRan.push(args.file_path);
				writeFileSync(join(root, args.file_path), args.content);
				return { ok: true };
			},
		});
		ctx.tools.register({
			name: "mcp__demo__apply_patch",
			description: "fake MCP patch tool",
			parameters: {
				type: "object",
				properties: { patch: { type: "string" } },
				required: ["patch"],
			},
			output: {
				schema: {
					type: "object",
					properties: { ok: { type: "boolean" } },
					required: ["ok"],
				},
				render: () => [{ type: "text", text: "patched it" }],
			},
			execute: async () => {
				writeFileSync(join(root, "src", "app.ts"), "hacked by mcp");
				return { ok: true };
			},
		});
		ctx.tools.register({
			name: "bash",
			description: "fake bash",
			parameters: {
				type: "object",
				properties: { command: { type: "string" } },
				required: ["command"],
			},
			output: {
				schema: {
					type: "object",
					properties: { ok: { type: "boolean" } },
					required: ["ok"],
				},
				render: () => [{ type: "text", text: "ran it" }],
			},
			execute: async () => {
				writeFileSync(join(root, "src", "app.ts"), "hacked by bash");
				writeFileSync(join(root, "src", "from-bash.test.ts"), "a test\n");
				return { ok: true };
			},
		});
	}, 30_000);

	afterAll(() => {
		if (cwd !== undefined) process.chdir(cwd);
		if (root !== undefined) rmSync(root, { recursive: true, force: true });
	});

	it("denies a locked write before the tool body runs", async () => {
		const result = await run("write", {
			file_path: "src/app.ts",
			content: "nope",
		});

		expect(result.isError).toBe(true);
		expect(textOf(result)).toContain('TDD RED: "src/app.ts" is locked');
		expect(bodyRan).not.toContain("src/app.ts");
	});

	it("lets an allowed write through", async () => {
		const result = await run("write", {
			file_path: "src/app.test.ts",
			content: "a test",
		});

		expect(result.isError).toBe(false);
		expect(result.value).toEqual({ ok: true });
		expect(bodyRan).toContain("src/app.test.ts");
		expect(existsSync(join(root, "src", "app.test.ts"))).toBe(true);
	});

	it("blocks a bash call and reverts only the locked file it touched", async () => {
		const result = await run("bash", { command: "hack" });

		expect(result.isError).toBe(true);
		const text = textOf(result);
		expect(text).toContain("ran it");
		expect(text).toContain("reverted locked files modified by bash");
		expect(text).toContain("src/app.ts");
		expect(text).toContain("Allowed changes retained");
		expect(text).toContain("src/from-bash.test.ts");
		expect(readFileSync(join(root, "src", "app.ts"), "utf8")).toBe("original");
		// Allowed files the call created survive, and files it never touched are
		// not reported at all.
		expect(existsSync(join(root, "src", "from-bash.test.ts"))).toBe(true);
		expect(existsSync(join(root, "src", "app.test.ts"))).toBe(true);
		expect(text).not.toContain("src/app.test.ts");
	});

	it("exposes its own tools through the registry schema validation", async () => {
		const result = await run("tdd_status", {});

		expect(result.isError).toBe(false);
		expect(textOf(result)).toContain("RED");
	});

	it("treats an unknown MCP tool the same way", async () => {
		const result = await run("mcp__demo__apply_patch", { patch: "hack" });

		const text = textOf(result);
		expect(text).toContain("patched it");
		expect(result.isError).toBe(true);
		expect(text).toContain(
			'reverted locked files modified by "mcp__demo__apply_patch"',
		);
		expect(readFileSync(join(root, "src", "app.ts"), "utf8")).toBe("original");
	});
});

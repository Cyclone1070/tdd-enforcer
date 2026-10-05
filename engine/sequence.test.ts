import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { TddEnforcer } from "../adapters/dsh/enforcement.js";
import type { HostContext, ToolExecution } from "../adapters/dsh/types.js";
import { runNextPhase, runPreviousPhase } from "../adapters/shared/actions.js";
import {
	initGit,
	loadTddState,
	resolveTddDir,
	savePhaseState,
	snapshot,
} from "./index.js";
import type { Phase } from "./types.js";

/**
 * Exhaustive sequence coverage, in one run.
 *
 * The plugin is a state machine: a "usage pattern" is a chain of transitions.
 * Verify every transition and the argument in plan.md shows every sequence is
 * covered. Verify every ordered pair of transitions and the coverage no longer
 * depends on the state model being complete — which is the assumption that let
 * two real defects through.
 *
 * Speed comes from walking ONE repo instead of rebuilding a fixture per step.
 * Jumps (a reposition to another state) copy a prebuilt template.
 */

const RULES = {
	blockedInRed: ["src/**/*.ts", "!src/**/*.spec.ts"],
	blockedInGreen: ["src/**/*.spec.ts"],
	testCommands: ["node scripts/gate.mjs"],
	timeoutSeconds: 20,
};
const RULES_JSON = JSON.stringify(RULES);

/** Gate verdict is controlled by the fixture, so transitions are deterministic. */
const GATE_SOURCE = `import { readFileSync } from "node:fs";
let mode = "fail";
try {
	mode = readFileSync(".tdd/gate-mode", "utf8").trim();
} catch {}
process.exit(mode === "pass" ? 0 : 1);
`;

const ORIGINAL = "ORIGINAL\n";
const LOG_ORIGINAL = "ORIGINAL LOG\n";

/** The modelled state: everything the plugin's behaviour is believed to read. */
interface State {
	enabled: boolean;
	phase: Phase;
	hasParent: boolean;
	dirty: boolean;
}

const stateKey = (s: State): string =>
	`${s.enabled ? "on" : "off"}/${s.phase}/p${s.hasParent ? 1 : 0}/d${s.dirty ? 1 : 0}`;

// ── git helpers ──────────────────────────────────────────────────────────────

function gitEnv(
	root: string,
	extra: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
	return {
		...process.env,
		GIT_AUTHOR_NAME: "s",
		GIT_AUTHOR_EMAIL: "s@t",
		GIT_COMMITTER_NAME: "s",
		GIT_COMMITTER_EMAIL: "s@t",
		GIT_DIR: join(root, resolveTddDir(root), ".git"),
		GIT_WORK_TREE: root,
		...extra,
	};
}

function privGit(root: string, args: string[]): string {
	return execFileSync("git", args, {
		cwd: root,
		env: gitEnv(root),
		encoding: "utf8",
		stdio: "pipe",
	}).toString();
}

function privGitOk(root: string, args: string[]): boolean {
	try {
		privGit(root, args);
		return true;
	} catch {
		return false;
	}
}

/** One observation of the repo: the state, plus the raw status both checks read. */
interface Observation {
	state: State;
	status: string;
	touched: string[];
}

/** The actual state, read back from the repo rather than predicted. */
function observe(root: string): Observation {
	let raw: { current?: unknown; enabled?: unknown } = {};
	try {
		raw = JSON.parse(readFileSync(join(root, ".tdd", "state.json"), "utf8"));
	} catch {
		/* unreadable state is reported through the invariants, not here */
	}
	const status = privGit(root, ["status", "--porcelain"]).trim();
	return {
		state: {
			enabled: raw.enabled === true,
			phase: raw.current === "green" ? "green" : "red",
			hasParent: privGitOk(root, ["rev-parse", "HEAD~1"]),
			dirty: status.length > 0,
		},
		status,
		touched: status ? status.split("\n").map((l) => l.slice(3).trim()) : [],
	};
}

function readState(root: string): State {
	return observe(root).state;
}

// ── fixture ──────────────────────────────────────────────────────────────────

const TEMPLATES = new Map<string, string>();

function buildTemplate(s: State): string {
	const dir = join(
		tmpdir(),
		`tdd-seq-tpl-${process.pid}-${stateKey(s).replace(/\//g, "_")}`,
	);
	rmSync(dir, { recursive: true, force: true });
	for (const d of [
		"src/deep/nested",
		"scripts",
		".tdd",
		".pi/tdd",
		".tddx",
		"src/.tdd",
	]) {
		mkdirSync(join(dir, d), { recursive: true });
	}
	const put = (rel: string, content: string) => {
		const abs = join(dir, rel);
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, content);
	};
	put("src/app.ts", ORIGINAL);
	put("src/deep/nested/mod.ts", ORIGINAL);
	put("src/app.spec.ts", ORIGINAL);
	put("README.md", ORIGINAL);
	put(".tddx/state.json", ORIGINAL);
	put("src/.tdd/state.json", ORIGINAL);
	put(".pi/tdd/state.json", ORIGINAL);
	put(".tdd/rules.json", RULES_JSON);
	put(".tdd/tdd.log", LOG_ORIGINAL);
	put(".tdd/gate-mode", s.phase === "red" ? "fail" : "pass");
	put("scripts/gate.mjs", GATE_SOURCE);
	savePhaseState(dir, { enabled: s.enabled, current: s.phase });

	const outer = (args: string[]) =>
		execFileSync("git", args, {
			cwd: dir,
			encoding: "utf8",
			stdio: "pipe",
			env: {
				...process.env,
				GIT_AUTHOR_NAME: "s",
				GIT_AUTHOR_EMAIL: "s@t",
				GIT_COMMITTER_NAME: "s",
				GIT_COMMITTER_EMAIL: "s@t",
			},
		});
	outer(["init", "-q", "."]);
	outer(["add", "-A"]);
	outer(["commit", "-qm", "init"]);

	initGit(dir);
	// `initGit` writes its own commit; restore the intended phase afterwards.
	savePhaseState(dir, { enabled: s.enabled, current: s.phase });
	if (s.hasParent) {
		// Commit real work first. If the snapshot commit had the same tree as the
		// one below it, a rollback could not be observed leaving HEAD and the
		// working tree out of step — the defect would be invisible by accident.
		put("src/phase-work.ts", ORIGINAL);
		snapshot(dir, s.phase);
	}
	if (s.dirty) put("src/drift.txt", "DRIFT\n");
	return dir;
}

function templateFor(s: State): string {
	const k = stateKey(s);
	let dir = TEMPLATES.get(k);
	if (!dir) {
		dir = buildTemplate(s);
		TEMPLATES.set(k, dir);
	}
	return dir;
}

/**
 * Every copy lands in one per-run parent directory. Jumps are frequent (the walk
 * repositions hundreds of times), and deleting each old repo before making the
 * next one cost more than the copies themselves — so old copies are left in
 * place and the parent is removed once at the end.
 */
let scratchRoot: string | undefined;
let copySeq = 0;

function materialise(s: State): string {
	if (scratchRoot === undefined) {
		scratchRoot = join(tmpdir(), `tdd-seq-${process.pid}-${Date.now()}`);
		mkdirSync(scratchRoot, { recursive: true });
	}
	const dir = join(scratchRoot, `r${++copySeq}`);
	execFileSync("cp", ["-Rc", templateFor(s), dir], { stdio: "pipe" });
	return dir;
}

function clearScratch(): void {
	if (scratchRoot !== undefined) {
		rmSync(scratchRoot, { recursive: true, force: true });
		scratchRoot = undefined;
	}
}

// ── actions ──────────────────────────────────────────────────────────────────

type Kind = "guard" | "bracket" | "own" | "skipped" | "status";

interface Action {
	id: string;
	kind: Kind;
	tool: string;
	/** Target path for mutating actions. */
	path?: string;
	/** Whether the plugin must stop this action in the given phase. */
	locked: (phase: Phase) => boolean;
	/** True when the action's own command removes the target. */
	deletes?: boolean;
}

const TDD_PATH = ".tdd/rules.json";
const LOG_PATH = ".tdd/tdd.log";
const BLOCKED_RED = "src/app.ts";
const BLOCKED_GREEN = "src/app.spec.ts";
const FREE_PATH = "README.md";

const ACTIONS: Action[] = [
	{
		id: "guard:tdd",
		kind: "guard",
		tool: "write",
		path: TDD_PATH,
		locked: () => true,
	},
	{
		id: "guard:blocked-red",
		kind: "guard",
		tool: "write",
		path: BLOCKED_RED,
		locked: (p) => p === "red",
	},
	{
		id: "guard:blocked-green",
		kind: "guard",
		tool: "write",
		path: BLOCKED_GREEN,
		locked: (p) => p === "green",
	},
	{
		id: "guard:free",
		kind: "guard",
		tool: "write",
		path: FREE_PATH,
		locked: () => false,
	},
	{
		id: "bracket:tdd",
		kind: "bracket",
		tool: "bash",
		path: TDD_PATH,
		locked: () => true,
		deletes: true,
	},
	{
		id: "bracket:blocked-red",
		kind: "bracket",
		tool: "bash",
		path: BLOCKED_RED,
		locked: (p) => p === "red",
		deletes: true,
	},
	{
		id: "bracket:free",
		kind: "bracket",
		tool: "bash",
		path: FREE_PATH,
		locked: () => false,
		deletes: true,
	},
	{
		// Outside the lock by policy: the private repo ignores it, and it is the
		// plugin's own scratch space, exactly like the private git store. Listed
		// so the policy is pinned — the plugin must leave it alone.
		id: "bracket:log",
		kind: "bracket",
		tool: "mcp__fs__write",
		path: LOG_PATH,
		locked: () => false,
	},
	{ id: "own:next", kind: "own", tool: "next_tdd_phase", locked: () => false },
	{
		id: "own:prev",
		kind: "own",
		tool: "previous_tdd_phase",
		locked: () => false,
	},
	{ id: "status", kind: "status", tool: "tdd_status", locked: () => false },
	{
		id: "skipped:read",
		kind: "skipped",
		tool: "read",
		path: FREE_PATH,
		locked: () => false,
	},
];

let seq = 0;
function call(name: string, args: unknown): Readonly<ToolExecution> {
	return {
		callId: `s-${++seq}`,
		name,
		arguments: args,
		agent: { sessionId: "seq" },
	};
}

function fakeCtx(root: string): HostContext {
	const noop = () => () => {};
	return {
		on: noop,
		inject: () => undefined,
		tools: { guard: noop, register: noop },
		sessions: { get: () => ({ header: { cwd: root } }) },
	};
}

interface Outcome {
	/** Set when the plugin refused the action before it ran. */
	denial?: string;
	/** Set when the plugin reverted the action afterwards. */
	warning?: string;
}

/** Run one action exactly the way the DSH adapter does. */
async function runAction(root: string, action: Action): Promise<Outcome> {
	const enforcer = new TddEnforcer(fakeCtx(root));
	if (action.kind === "own") {
		try {
			if (action.tool === "next_tdd_phase") await runNextPhase(root, undefined);
			else await runPreviousPhase(root, undefined);
		} catch {
			// A refused transition throws; that is a legal outcome.
			return { denial: "refused" };
		}
		return {};
	}
	if (action.kind === "status") {
		return {};
	}
	if (action.kind === "guard") {
		const exec = call(action.tool, {
			file_path: action.path,
			content: "MUTATED\n",
		});
		const denial = enforcer.guardExecution(exec);
		if (denial === undefined) {
			writeFileSync(join(root, action.path as string), "MUTATED\n");
		}
		return { denial };
	}
	// bracket
	const args =
		action.tool === "bash"
			? { command: `rm -f "${action.path}"` }
			: { path: action.path, content: "MUTATED\n" };
	const exec = call(action.tool, args);
	enforcer.beginBracket(exec);
	if (action.tool === "bash")
		rmSync(join(root, action.path as string), { force: true });
	else writeFileSync(join(root, action.path as string), "MUTATED\n");
	const warning = enforcer.finishBracket(exec, { value: {} });
	return { warning };
}

// ── invariants ───────────────────────────────────────────────────────────────

/** Assertions that must hold after EVERY action, whatever it was. */
function checkInvariants(
	root: string,
	label: string,
	s: State,
	action: Action,
	obs: Observation,
): string[] {
	const bad: string[] = [];
	if (!existsSync(join(root, ".tdd", "state.json"))) {
		bad.push(`${label}: .tdd/state.json is gone`);
		return bad;
	}

	// With enforcement off there is no lock to hold: a write to a locked path
	// legitimately succeeds, and a bash delete legitimately removes it. There is
	// nothing to assert about the tree, and asserting anyway reports fiction.
	if (!s.enabled) return bad;

	const { status, touched } = obs;

	// A locked path must never be left modified. `.tdd/state.json` is excluded:
	// the plugin's own tools write it by design.
	const locked = [
		TDD_PATH,
		...(s.phase === "red"
			? ["src/app.ts", "src/deep/nested/mod.ts"]
			: ["src/app.spec.ts"]),
	];
	for (const p of locked) {
		if (touched.includes(p)) bad.push(`${label}: locked ${p} left modified`);
	}

	// A transition commits or resets, so it must leave the tree aligned with
	// HEAD. Only meaningful when the fixture did not start dirty.
	if (action.kind === "own" && !s.dirty && touched.length > 0) {
		bad.push(
			`${label}: transition left the tree dirty: ${status.replace(/\n/g, " | ")}`,
		);
	}
	return bad;
}

// ── the model ────────────────────────────────────────────────────────────────

const STATES: State[] = [
	// Enforcement off makes both mechanisms return early, so every action is a
	// no-op whatever the phase, history, or tree look like. Those combinations
	// are one equivalence class, not eight.
	{ enabled: false, phase: "red", hasParent: false, dirty: false },
];
for (const phase of ["red", "green"] as Phase[]) {
	for (const hasParent of [true, false]) {
		for (const dirty of [true, false]) {
			STATES.push({ enabled: true, phase, hasParent, dirty });
		}
	}
}

describe("sequence coverage", () => {
	it("every transition behaves as the lock says", async () => {
		const failures: string[] = [];
		const observed = new Map<string, string>();
		for (const s of STATES) {
			for (const action of ACTIONS) {
				const root = materialise(s);
				try {
					const before = readState(root);
					const out = await runAction(root, action);
					const after = observe(root);
					observed.set(`${stateKey(s)}|${action.id}`, stateKey(after.state));
					const label = `${stateKey(s)} | ${action.id}`;

					if (!s.enabled) {
						// Enforcement off: no file action may be denied or reverted.
						// The transition tools are excluded — they refuse outright
						// while TDD is disabled, which is their own guard rather
						// than an intervention in the file lock.
						const isFileAction =
							action.kind === "guard" || action.kind === "bracket";
						if (
							isFileAction &&
							(out.denial !== undefined || out.warning !== undefined)
						) {
							failures.push(
								`${label}: enforcement is off but the plugin intervened`,
							);
						}
					} else if (action.kind === "guard" || action.kind === "bracket") {
						const mustBlock = action.locked(s.phase);
						const blocked =
							out.denial !== undefined || out.warning !== undefined;
						if (mustBlock && !blocked) {
							failures.push(`${label}: locked but the plugin allowed it`);
						}
						if (!mustBlock && out.denial !== undefined) {
							failures.push(
								`${label}: free but the guard denied it: ${out.denial}`,
							);
						}
						if (!mustBlock && out.warning !== undefined) {
							failures.push(`${label}: free but the plugin reverted it`);
						}
					}
					failures.push(...checkInvariants(root, label, s, action, after));
					void before;
				} finally {
					// Left for clearScratch(); deleting per case cost more than
					// the copy it removed.
				}
			}
		}
		clearScratch();
		const shown = failures.slice(0, 20);
		if (failures.length > shown.length) {
			shown.push(`... and ${failures.length - shown.length} more`);
		}
		expect(failures.length, shown.join("\n")).toBe(0);
	}, 600_000);

	it("every ordered pair of actions holds the invariants", async () => {
		const failures: string[] = [];
		// Coverage target: every (state, a1, a2) triple.
		const pending = new Set<string>();
		for (const s of STATES) {
			for (const a1 of ACTIONS) {
				for (const a2 of ACTIONS) {
					pending.add(`${stateKey(s)}|${a1.id}|${a2.id}`);
				}
			}
		}
		const total = pending.size;

		let root = materialise(STATES[0] as State);
		let current = readState(root);
		let prev: Action | undefined;
		let stateBeforePrev = current;
		let steps = 0;
		let byEquivalence = 0;
		let jumps = 0;

		const jump = (): boolean => {
			// Reposition to a state that still has uncovered pairs.
			for (const s of STATES) {
				for (const a1 of ACTIONS) {
					for (const a2 of ACTIONS) {
						if (pending.has(`${stateKey(s)}|${a1.id}|${a2.id}`)) {
							root = materialise(s);
							current = readState(root);
							prev = undefined;
							jumps++;
							return true;
						}
					}
				}
			}
			return false;
		};

		/**
		 * An action that leaves the state untouched makes every pair starting
		 * with it the same experiment as the single transition that follows:
		 * (s, a, b) where a is a no-op from s behaves exactly as (s, b), which
		 * the transition pass already runs from a fresh fixture. The invariants
		 * above are what license this — they check the no-op really left nothing
		 * behind. Pairs are only skipped when that check passed.
		 */
		const coverNoOpPairs = (s: State, a: Action, after: Observation) => {
			if (stateKey(after.state) !== stateKey(s)) return;
			for (const b of ACTIONS) {
				if (pending.delete(`${stateKey(s)}|${a.id}|${b.id}`)) byEquivalence++;
			}
		};

		try {
			while (pending.size > 0) {
				if (prev === undefined) {
					// Open a window: pick any pair that starts here.
					const a1 = ACTIONS.find((a) =>
						ACTIONS.some((b) =>
							pending.has(`${stateKey(current)}|${a.id}|${b.id}`),
						),
					);
					if (a1 === undefined) {
						if (!jump()) break;
						continue;
					}
					stateBeforePrev = current;
					await runAction(root, a1);
					steps++;
					const afterA1 = observe(root);
					failures.push(
						...checkInvariants(
							root,
							`step ${steps} ${a1.id}`,
							stateBeforePrev,
							a1,
							afterA1,
						),
					);
					coverNoOpPairs(stateBeforePrev, a1, afterA1);
					prev = a1;
					current = afterA1.state;
					continue;
				}

				const a2 = ACTIONS.find((b) =>
					pending.has(`${stateKey(stateBeforePrev)}|${prev?.id}|${b.id}`),
				);
				if (a2 === undefined) {
					prev = undefined;
					if (!jump()) break;
					continue;
				}
				pending.delete(`${stateKey(stateBeforePrev)}|${prev.id}|${a2.id}`);
				const keep = current;
				await runAction(root, a2);
				steps++;
				const afterA2 = observe(root);
				failures.push(
					...checkInvariants(
						root,
						`step ${steps} ${prev.id}->${a2.id}`,
						keep,
						a2,
						afterA2,
					),
				);
				coverNoOpPairs(keep, a2, afterA2);
				stateBeforePrev = keep;
				prev = a2;
				current = afterA2.state;
			}
		} finally {
			clearScratch();
		}

		// Coverage must be complete, not sampled.
		expect(
			pending.size,
			`${pending.size} of ${total} pairs never covered`,
		).toBe(0);
		// Report the split so the coverage claim is auditable, not just asserted.
		console.log(
			`\nPAIRS total=${total} steps=${steps} byEquivalence=${byEquivalence} jumps=${jumps} failures=${failures.length}`,
		);
		const shown = failures.slice(0, 20);
		if (failures.length > shown.length) {
			shown.push(`... and ${failures.length - shown.length} more`);
		}
		expect(failures.length, shown.join("\n")).toBe(0);
	}, 900_000);
});

// ── the six defects, as live assertions ──────────────────────────────────────

describe("damage the lock must survive", () => {
	const base = (over: Partial<State> = {}): State => ({
		enabled: true,
		phase: "red",
		hasParent: true,
		dirty: false,
		...over,
	});

	it("a bash-deleted directory is restored", async () => {
		// Which deletion shapes the revert can actually undo is not obvious from
		// reading `restoreFilesTo`, so this probes several rather than asserting
		// one guess.
		const shapes = ["src/deep", "src/deep/nested", "src", "."];
		const failures: string[] = [];
		for (const shape of shapes) {
			const root = materialise(base());
			try {
				const exec = call("bash", { command: `rm -rf "${shape}"` });
				const enforcer = new TddEnforcer(fakeCtx(root));
				enforcer.beginBracket(exec);
				if (shape === ".") {
					for (const f of ["src/app.ts", "README.md", ".tdd/rules.json"]) {
						rmSync(join(root, f), { force: true });
					}
				} else {
					rmSync(join(root, shape), { recursive: true, force: true });
				}
				const warning = enforcer.finishBracket(exec, { value: {} });
				if (warning === undefined) {
					failures.push(`${shape}: deletion of a locked path was not reported`);
				}
				if (!existsSync(join(root, "src/app.ts"))) {
					failures.push(`${shape}: src/app.ts did not come back`);
				}
				if (!existsSync(join(root, TDD_PATH))) {
					failures.push(`${shape}: ${TDD_PATH} did not come back`);
				}
			} finally {
				rmSync(root, { recursive: true, force: true });
			}
		}
		expect(failures, failures.join("\n")).toEqual([]);
	}, 120_000);

	it("deleting .tdd wholesale leaves the session usable", async () => {
		const root = materialise(base());
		try {
			const exec = call("bash", { command: 'rm -rf ".tdd"' });
			const enforcer = new TddEnforcer(fakeCtx(root));
			enforcer.beginBracket(exec);
			rmSync(join(root, ".tdd"), { recursive: true, force: true });
			enforcer.finishBracket(exec, { value: {} });
			expect(
				existsSync(join(root, ".tdd", "state.json")),
				"state must come back",
			).toBe(true);
			expect(loadTddState(root).ok, "TDD must still load").toBe(true);
		} finally {
			clearScratch();
		}
	}, 120_000);
});

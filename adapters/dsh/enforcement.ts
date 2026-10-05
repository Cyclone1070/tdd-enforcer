/**
 * DSH enforcement layer.
 *
 * Two mechanisms, matching what the host can actually do:
 *
 * 1. `write` / `edit` name their target in the arguments, so a synchronous
 *    `ctx.tools.guard` denies locked paths *before* the tool body runs.
 * 2. Every other tool (bash, MCP servers, future/unknown tools) has no schema
 *    this plugin can trust. Those get a snapshot-and-revert bracket: a private
 *    commit before the call, a diff after it, and a path-scoped restore of the
 *    files that both changed and are locked in the current phase. Files the
 *    phase allows are never touched, so concurrent legitimate edits survive.
 *
 * Background `bash` is covered the same way: the bracket is handed to the job
 * id and settled by a `ctx.jobs` subscription instead of inline.
 */

import { join, relative, resolve } from "node:path";
import { isAllowed } from "../../engine/enforce.js";
import {
	changesSince,
	gitStashCreate,
	restoreFilesTo,
} from "../../engine/git.js";
import type { TddSnapshot } from "../../engine/index.js";
import {
	captureTddFiles,
	isTddPath,
	loadTddState,
	resolveTddDir,
	restoreTddFiles,
	tddLog,
} from "../../engine/index.js";
import type { Config, Phase } from "../../engine/types.js";
import { projectRootOf, sessionIdOf } from "./root.js";
import type {
	ContentBlock,
	HostContext,
	ToolExecution,
	ToolExecutionResult,
} from "./types.js";

/** Tools whose target path is in the arguments, so a guard can deny precisely. */
const PRECISE_PATH_TOOLS = new Set(["write", "edit"]);

/** Tools this plugin registers itself; they manage the snapshot history. */
const OWN_TOOLS = new Set([
	"next_tdd_phase",
	"previous_tdd_phase",
	"tdd_status",
]);

/**
 * Tools that cannot modify project files. Anything not listed here (and not
 * handled precisely above) gets a snapshot bracket — that is what covers MCP
 * tools and tools added by other plugins without this plugin knowing them.
 */
const NON_MUTATING_TOOLS = new Set([
	"read",
	"glob",
	"grep",
	"read_image",
	"web_search",
	"web_fetch",
	"skill",
	"todo_write",
	"present",
	"ask_user_question",
	"send_message",
	"interrupt_agent",
	"list_agents",
	"subagent",
	"subagent_fork",
	"workflow",
	"job_list",
	"job_output",
	"job_kill",
	"plugin_manager",
	"cordis_inspect_list",
	"cordis_inspect_query",
	"create_goal",
	"get_goal",
	"update_goal",
	"exit_plan_mode",
]);

/**
 * Upper bound on remembered brackets. A time limit would be wrong here: a long
 * foreground call, or a background job that runs for hours, must still be
 * diffed when it ends. Only the oldest entries are dropped, and only when a
 * call never reached post-execute at all (denied or cancelled calls leak one).
 */
const MAX_BRACKETS = 200;

const BOOKKEEPING_DENIAL =
	"TDD: Config files are locked. No bypassing TDD allowed. If bypassing is justified, ask the user: turn TDD off (/tdd-off), reset (/tdd-reset), or change phase with the /tdd-red and /tdd-green commands.\n\nIf TDD reverts too much of your progress, reduce the scope of each TDD cycle to minimise lost progress.";

export interface Bracket {
	stashHash: string;
	/**
	 * Byte-exact copy of the TDD directories, taken before the call. They are
	 * restored from this rather than from git, which cannot see a nested `.git`
	 * or anything the private repo ignores.
	 */
	tddFiles: TddSnapshot;
	phase: Phase;
	config: Config;
	root: string;
	toolName: string;
	sessionId?: string;
	at: number;
}

/** True when a tool call must be bracketed with a pre/post snapshot. */
export function needsBracket(toolName: string): boolean {
	if (PRECISE_PATH_TOOLS.has(toolName)) return false;
	if (OWN_TOOLS.has(toolName)) return false;
	if (NON_MUTATING_TOOLS.has(toolName)) return false;
	return true;
}

/** The job id a `bash` call handed back, when it ran in the background. */
export function backgroundJobId(
	result: ToolExecutionResult | undefined,
): string | undefined {
	const value = result?.value;
	if (value === null || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	if (record.kind !== "background") return undefined;
	return typeof record.jobId === "string" ? record.jobId : undefined;
}

/** Joins the model-facing text of a tool result, so a block can preserve it. */
export function resultText(result: ToolExecutionResult | undefined): string {
	return (result?.content ?? [])
		.map((block) => (typeof block.text === "string" ? block.text : ""))
		.join("");
}

export interface RevertOutcome {
	warning: string;
	violations: string[];
	allowed: string[];
}

export class TddEnforcer {
	private brackets = new Map<string, Bracket>();
	private jobBrackets = new Map<string, Bracket>();
	private notices = new Map<string, string[]>();

	constructor(
		private readonly ctx: HostContext,
		private readonly maxBrackets: number = MAX_BRACKETS,
	) {}

	// ── project + state ──────────────────────────────────────────────────────

	/** Project root of the session that issued this call. */
	rootFor(exec: Readonly<ToolExecution>): string {
		return projectRootOf(this.ctx, exec);
	}

	private tddDir(root: string): string {
		return join(root, resolveTddDir(root));
	}

	// ── mechanism 1: synchronous guard for write/edit ────────────────────────

	guardExecution(exec: Readonly<ToolExecution>): string | undefined {
		if (!PRECISE_PATH_TOOLS.has(exec.name)) return undefined;
		const filePath = readString(exec.arguments, "file_path");
		if (filePath === undefined) return undefined;

		const root = this.rootFor(exec);
		const tdd = loadTddState(root);
		if (!tdd.ok || !tdd.state.enabled) return undefined;

		const tddDir = this.tddDir(root);
		const rel = relative(root, resolve(root, filePath));

		if (isTddPath(rel)) {
			tddLog(tddDir, "INFO", "guard: blocked TDD bookkeeping file", {
				toolName: exec.name,
				relPath: rel,
			});
			return BOOKKEEPING_DENIAL;
		}

		if (!isAllowed(rel, tdd.state.current, tdd.config)) {
			tddLog(tddDir, "INFO", "guard: blocked file modification", {
				toolName: exec.name,
				relPath: rel,
				phase: tdd.state.current,
			});
			return `TDD ${tdd.state.current.toUpperCase()}: "${rel}" is locked in this phase.`;
		}
		return undefined;
	}

	// ── mechanism 2: snapshot-and-revert bracket ─────────────────────────────

	/** Take the pre-call snapshot. Called before the tool body runs. */
	beginBracket(exec: Readonly<ToolExecution>): void {
		if (!needsBracket(exec.name)) return;

		const root = this.rootFor(exec);
		const tddDir = this.tddDir(root);
		const tdd = loadTddState(root);
		if (!tdd.ok || !tdd.state.enabled) {
			tddLog(tddDir, "DEBUG", "bracket: TDD not active, passes through", {
				toolName: exec.name,
				reason: tdd.ok ? "disabled" : tdd.reason,
			});
			return;
		}

		try {
			const stashHash = gitStashCreate(root);

			// The capture must come AFTER this call's own log line. The plugin
			// writes to tdd.log itself, so anything it writes between the
			// capture and the restore would come back as damage the call caused.
			tddLog(tddDir, "DEBUG", "bracket: opened", {
				toolName: exec.name,
				callId: exec.callId,
				stashHash,
			});

			this.brackets.set(exec.callId, {
				stashHash,
				tddFiles: captureTddFiles(root),
				phase: tdd.state.current,
				config: tdd.config,
				root,
				toolName: exec.name,
				sessionId: sessionIdOf(exec.agent),
				at: Date.now(),
			});
			this.pruneBrackets();
		} catch (error) {
			tddLog(tddDir, "ERROR", "bracket: snapshot failed", {
				toolName: exec.name,
				callId: exec.callId,
				error: (error as Error).message,
				detail: errorDetail(error),
			});
		}
	}

	/**
	 * Close the bracket after the call. Returns the corrective text when files
	 * were reverted; `undefined` means the call may stand as-is.
	 */
	finishBracket(
		exec: Readonly<ToolExecution>,
		result: Readonly<ToolExecutionResult> | undefined,
	): string | undefined {
		const bracket = this.brackets.get(exec.callId);
		if (bracket === undefined) return undefined;
		this.brackets.delete(exec.callId);

		const jobId = backgroundJobId(result);
		if (jobId !== undefined) {
			// The process is still running; the job subscription closes this one.
			// Nothing is logged here on purpose: this bracket is still open, and
			// a log line written now would look like damage when it settles.
			this.jobBrackets.set(jobId, bracket);
			return undefined;
		}

		return this.revert(bracket)?.warning;
	}

	/** A tracked background job settled: diff and revert what it broke. */
	handleJobSettled(jobId: string): void {
		const bracket = this.jobBrackets.get(jobId);
		if (bracket === undefined) return;
		this.jobBrackets.delete(jobId);

		const outcome = this.revert(bracket);
		const tddDir = this.tddDir(bracket.root);
		if (outcome === undefined) {
			tddLog(tddDir, "DEBUG", "bracket: background job made no violations", {
				jobId,
			});
			return;
		}

		tddLog(tddDir, "WARN", "bracket: reverted background job changes", {
			jobId,
			violations: outcome.violations,
		});
		this.pushNotice(
			bracket.sessionId,
			`\n\n⚠️ TDD: background command (job ${jobId}) had already returned; locked files it modified were reverted when it settled.${outcome.warning}`,
		);
	}

	/**
	 * Diff the working tree against the bracket snapshot and restore only the
	 * files that are both changed and locked in the bracket's phase.
	 */
	revert(bracket: Bracket): RevertOutcome | undefined {
		const { root, stashHash, phase, config } = bracket;
		const tddDir = this.tddDir(root);

		// The TDD directories come back from memory, and this runs before — and
		// independently of — the git diff. Git cannot see a nested `.git` or an
		// ignored file, so it is the wrong instrument for them, and the diff may
		// not even be available if the call destroyed the private store.
		let tddViolations: string[] = [];
		try {
			tddViolations = restoreTddFiles(root, bracket.tddFiles);
		} catch (error) {
			tddLog(tddDir, "ERROR", "bracket: TDD directory restore failed", {
				toolName: bracket.toolName,
				error: (error as Error).message,
			});
		}

		let changed: string[];
		try {
			changed = changesSince(root, stashHash);
		} catch (error) {
			// A destroyed store costs the diff, not the revert: the TDD
			// directories above were already restored from memory.
			tddLog(tddDir, "ERROR", "bracket: diff failed", {
				toolName: bracket.toolName,
				error: (error as Error).message,
			});
			changed = [];
		}

		// The memory pass above already put the TDD directories back, so these
		// are the paths git can see and memory reported; restoring them again
		// from the baseline is a no-op. The log never appears here — it is
		// ignored, which is exactly why memory has to own it.
		const tddFromGit = changed.filter((f) => isTddPath(f));
		const phaseViolations = changed.filter(
			(f) => !isTddPath(f) && !isAllowed(f, phase, config),
		);
		const violations = [
			...new Set([...tddViolations, ...tddFromGit, ...phaseViolations]),
		];
		if (violations.length === 0) {
			tddLog(tddDir, "DEBUG", "bracket: no violations among changed files", {
				toolName: bracket.toolName,
				changed,
			});
			return undefined;
		}

		try {
			if (tddFromGit.length > 0) {
				restoreFilesTo(root, tddFromGit, stashHash);
			}
			if (phaseViolations.length > 0) {
				restoreFilesTo(root, phaseViolations, stashHash);
			}
		} catch (error) {
			tddLog(tddDir, "ERROR", "bracket: restore failed", {
				toolName: bracket.toolName,
				violations,
				error: (error as Error).message,
			});
			return undefined;
		}

		const allowed = changed.filter(
			(f) => isAllowed(f, phase, config) && !isTddPath(f),
		);

		tddLog(tddDir, "WARN", "bracket: reverted locked files", {
			toolName: bracket.toolName,
			phase,
			violations,
		});

		return {
			warning: formatWarning(bracket, violations, allowed),
			violations,
			allowed,
		};
	}

	// ── deferred notices for out-of-band reverts ─────────────────────────────

	pushNotice(sessionId: string | undefined, text: string): void {
		const key = sessionId ?? "";
		const queue = this.notices.get(key);
		if (queue === undefined) this.notices.set(key, [text]);
		else queue.push(text);
	}

	/** Notices waiting for this session, as content blocks. */
	drainNotices(exec: Readonly<ToolExecution>): ContentBlock[] {
		const key = sessionIdOf(exec.agent) ?? "";
		const queue = this.notices.get(key);
		if (queue === undefined || queue.length === 0) return [];
		this.notices.delete(key);
		return queue.map((text) => ({ type: "text", text }));
	}

	/** Build the model-facing feedback for a reverted call. */
	feedback(
		result: Readonly<ToolExecutionResult> | undefined,
		warning: string,
	): ContentBlock[] {
		return [{ type: "text", text: resultText(result) + warning }];
	}

	/** Visible for tests. */
	get openBrackets(): number {
		return this.brackets.size + this.jobBrackets.size;
	}

	private pruneBrackets(): void {
		dropOldest(this.brackets, this.maxBrackets);
		dropOldest(this.jobBrackets, this.maxBrackets);
	}
}

/** Bound one bracket map, removing the oldest entries first. */
function dropOldest(map: Map<string, Bracket>, limit: number): void {
	if (map.size <= limit) return;
	const oldest = [...map.entries()].sort((a, b) => a[1].at - b[1].at);
	for (const [key] of oldest.slice(0, map.size - limit)) map.delete(key);
}

export function formatWarning(
	bracket: Bracket,
	violations: string[],
	allowed: string[],
): string {
	const who = bracket.toolName === "bash" ? "bash" : `"${bracket.toolName}"`;
	let warning = `\n\n⛔ ${bracket.phase.toUpperCase()}: reverted locked files modified by ${who}:`;
	for (const file of violations) warning += `\n  - ${file}`;
	if (violations.some((file) => isTddPath(file))) {
		warning +=
			"\n\nIf TDD reverts too much of your progress, reduce the scope of each TDD cycle to minimise lost progress.";
	}
	if (allowed.length > 0) {
		warning += "\n\nAllowed changes retained:";
		for (const file of allowed) warning += `\n  - ${file}`;
	}
	return warning;
}

/** One-line diagnostic from a failed child process, for the TDD log. */
export function errorDetail(error: unknown): string | undefined {
	const record = error as {
		status?: unknown;
		stderr?: unknown;
		stdout?: unknown;
	} | null;
	const text = (value: unknown): string => {
		if (value === undefined || value === null) return "";
		return Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
	};
	const parts = [
		record?.status === undefined ? "" : `status=${String(record.status)}`,
		text(record?.stderr).trim(),
		text(record?.stdout).trim(),
	].filter((part) => part !== "");
	return parts.length === 0 ? undefined : parts.join(" ").slice(0, 300);
}

function readString(input: unknown, key: string): string | undefined {
	if (input === null || typeof input !== "object") return undefined;
	const value = (input as Record<string, unknown>)[key];
	return typeof value === "string" && value !== "" ? value : undefined;
}

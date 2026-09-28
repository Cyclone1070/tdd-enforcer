/**
 * Minimal structural types for the DSH host plugin surface this adapter uses.
 *
 * These are hand-written on purpose: a plugin installed into a profile cannot
 * resolve `@deepseek-ai/*` modules at runtime (the profile's `node_modules`
 * only contains installed bundles), so the adapter must not import them. The
 * shapes below mirror the documented DSH declarations.
 */

export interface ContentBlock {
	type: string;
	text?: string;
	[key: string]: unknown;
}

export interface AgentRef {
	/** Session id. The live host agent handle exposes it as `id`. */
	readonly id?: string;
	/** Older/fake shape for the same value. */
	readonly sessionId?: string;
	/** Live agent handle: the session whose header carries the cwd. */
	readonly session?: { readonly header?: { readonly cwd?: unknown } };
}

export interface ToolExecution {
	readonly callId: string;
	readonly rootCallId?: string;
	readonly name: string;
	readonly arguments?: unknown;
	readonly agent?: AgentRef;
	readonly parent?: unknown;
	readonly signal?: AbortSignal;
}

export interface ToolExecutionResult {
	readonly content?: readonly ContentBlock[];
	readonly value?: unknown;
	readonly isError?: boolean;
	readonly [key: string]: unknown;
}

export type PreToolDecision =
	| { kind: "allow" }
	| { kind: "deny"; reason: string; info?: unknown }
	| { kind: "cancel" }
	| { kind: "ask"; reason?: string; displayReason?: string };

export type PostToolDecision =
	| { kind: "accept"; content?: ContentBlock[] }
	| { kind: "block"; feedback: ContentBlock[] };

export interface ToolOutputDefinition {
	schema: Record<string, unknown>;
	render(args: unknown, value: unknown): ContentBlock[];
}

export interface ToolRunContext extends ToolExecution {
	deferContext?(context: unknown): void;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	output: ToolOutputDefinition;
	execute(args: unknown, exec: ToolRunContext): Promise<unknown> | unknown;
}

export interface CommandInvocation {
	readonly commandId?: string;
	readonly agent?: AgentRef;
	readonly rawInput?: string;
	readonly signal?: AbortSignal;
}

export type CommandResult =
	| { kind: "success"; text?: string }
	| { kind: "error"; text: string };

export interface CommandDefinition {
	name: string;
	description: string;
	handler(
		invocation: CommandInvocation,
	): Promise<CommandResult> | CommandResult;
}

export interface SkillRegistration {
	name: string;
	description: string;
	content: string;
	source?: string;
}

export interface JobViewLike {
	id?: string;
	owner?: string;
	[k: string]: unknown;
}

export interface JobEvent {
	type: string;
	job?: JobViewLike;
	[k: string]: unknown;
}

/** The subset of the harness context this plugin depends on. */
export interface HostContext {
	on(event: string, listener: (...args: any[]) => unknown): () => void;
	inject(deps: string[], callback: (ctx: HostContext) => void): unknown;
	tools: {
		guard(
			guard: (exec: Readonly<ToolExecution>) => string | undefined,
		): () => void;
		register(definition: ToolDefinition): () => void;
	};
	commands?: { register(definition: CommandDefinition): () => void };
	skills?: { register(registration: SkillRegistration): () => void };
	sessions?: { get(id: string): { header?: { cwd?: string } } | undefined };
	jobs?: {
		events: {
			subscribe(
				filter: { owner?: string; owners?: string },
				listener: (event: JobEvent) => void,
			): () => void;
		};
	};
	logger?: (name: string) => {
		info(...args: unknown[]): void;
		warn(...args: unknown[]): void;
		debug?(...args: unknown[]): void;
	};
}

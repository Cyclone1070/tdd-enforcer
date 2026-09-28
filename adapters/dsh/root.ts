/**
 * Project-root resolution for tools, commands, and the guard.
 *
 * The session's working directory is the authority. The DSH host process may
 * have been started anywhere (`dsh web` from `~/.dsh`, for example), so
 * `process.cwd()` is only a last resort — resolving against it silently
 * targets the wrong project.
 *
 * The live agent handle exposes `id` (the session id) and
 * `session.header.cwd`. Older and fake shapes carry a bare `sessionId`.
 */

import type { AgentRef, HostContext } from "./types.js";

/** Anything carrying the agent that issued a tool call or command. */
export interface RootSubject {
	readonly agent?: AgentRef;
}

/** Session id of the issuing agent, from any known shape. */
export function sessionIdOf(agent: AgentRef | undefined): string | undefined {
	const id = agent?.id ?? agent?.sessionId;
	return typeof id === "string" && id !== "" ? id : undefined;
}

/** cwd carried directly on the live agent's session handle, when present. */
function directCwd(agent: AgentRef | undefined): string | undefined {
	const cwd = agent?.session?.header?.cwd;
	return typeof cwd === "string" && cwd !== "" ? cwd : undefined;
}

/** Session working directory, falling back to the process directory. */
export function projectRootOf(ctx: HostContext, subject: RootSubject): string {
	const agent = subject.agent;

	const direct = directCwd(agent);
	if (direct !== undefined) return direct;

	const sessionId = sessionIdOf(agent);
	if (sessionId !== undefined && ctx.sessions !== undefined) {
		const cwd = ctx.sessions.get(sessionId)?.header?.cwd;
		if (typeof cwd === "string" && cwd !== "") return cwd;
	}

	return process.cwd();
}

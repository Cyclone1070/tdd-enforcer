/**
 * The project root decides which project every tool, command, and guard acts
 * on. It must come from the issuing session, never from the host process cwd:
 * `dsh web` is routinely started outside the project.
 */

import { describe, expect, it } from "vitest";
import { projectRootOf, sessionIdOf } from "./root.js";
import type { AgentRef, HostContext } from "./types.js";

const SESSION = "session-abc";
const PROJECT = "/projects/picked-up-from-session";

/** Host context whose session store answers only for `SESSION`. */
function host(): HostContext {
	return {
		sessions: {
			get: (id: string) =>
				id === SESSION ? { header: { cwd: PROJECT } } : undefined,
		},
	} as unknown as HostContext;
}

describe("projectRootOf", () => {
	it("reads the cwd straight off the live agent handle", () => {
		const agent: AgentRef = {
			id: SESSION,
			session: { header: { cwd: "/live" } },
		};
		expect(projectRootOf(host(), { agent })).toBe("/live");
	});

	it("looks the session up by the live agent id", () => {
		expect(projectRootOf(host(), { agent: { id: SESSION } })).toBe(PROJECT);
	});

	it("still accepts the legacy bare sessionId shape", () => {
		expect(projectRootOf(host(), { agent: { sessionId: SESSION } })).toBe(
			PROJECT,
		);
	});

	it("prefers the live id over a stale sessionId", () => {
		const agent: AgentRef = { id: SESSION, sessionId: "session-stale" };
		expect(projectRootOf(host(), { agent })).toBe(PROJECT);
	});

	it("ignores an empty cwd on the agent handle and keeps looking", () => {
		const agent: AgentRef = { id: SESSION, session: { header: { cwd: "" } } };
		expect(projectRootOf(host(), { agent })).toBe(PROJECT);
	});

	it("falls back to the process directory for an unknown session", () => {
		expect(projectRootOf(host(), { agent: { id: "session-other" } })).toBe(
			process.cwd(),
		);
	});

	it("falls back to the process directory without an agent", () => {
		expect(projectRootOf(host(), {})).toBe(process.cwd());
		expect(projectRootOf(host(), { agent: undefined })).toBe(process.cwd());
	});

	it("falls back to the process directory without a sessions service", () => {
		const ctx = {} as unknown as HostContext;
		expect(projectRootOf(ctx, { agent: { id: SESSION } })).toBe(process.cwd());
	});
});

describe("sessionIdOf", () => {
	it("returns the id from either shape and nothing otherwise", () => {
		expect(sessionIdOf({ id: "a" })).toBe("a");
		expect(sessionIdOf({ sessionId: "b" })).toBe("b");
		expect(sessionIdOf({ id: "a", sessionId: "b" })).toBe("a");
		expect(sessionIdOf({ id: "" })).toBeUndefined();
		expect(sessionIdOf({})).toBeUndefined();
		expect(sessionIdOf(undefined)).toBeUndefined();
	});
});

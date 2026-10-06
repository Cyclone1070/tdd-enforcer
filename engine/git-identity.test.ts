/**
 * The private repo is the plugin's own bookkeeping, so its commits carry the
 * plugin's identity rather than whatever the host happens to have configured.
 *
 * That is not cosmetic: on a machine where git cannot name anyone — a bare CI
 * runner, a fresh container — the host identity resolves to an empty name and
 * git refuses to commit at all, which killed the plugin on its very first
 * `initGit`. These run against real git because that refusal only exists in
 * real git.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initGit } from "./git.js";

const IDENTITY = "tdd-enforcer <tdd-enforcer@localhost>";

const saved = { ...process.env };

afterEach(() => {
	process.env = { ...saved };
});

function hostIdentity(name: string, email: string): void {
	process.env.GIT_AUTHOR_NAME = name;
	process.env.GIT_AUTHOR_EMAIL = email;
	process.env.GIT_COMMITTER_NAME = name;
	process.env.GIT_COMMITTER_EMAIL = email;
}

function commitAuthor(root: string): string {
	return execFileSync(
		"git",
		[`--git-dir=${join(root, ".tdd", ".git")}`, "log", "--format=%an <%ae>"],
		{ encoding: "utf8", stdio: "pipe" },
	).trim();
}

function freshProject(): string {
	const root = mkdtempSync(join(tmpdir(), "tdd-identity-"));
	writeFileSync(join(root, "a.txt"), "hi");
	return root;
}

describe("private repo identity", () => {
	it("commits when the host cannot name anyone", () => {
		// What a bare CI runner resolves to: an empty name, which git rejects.
		hostIdentity("", "");

		const root = freshProject();
		initGit(root);

		expect(commitAuthor(root)).toBe(IDENTITY);
	});

	it("does not borrow the host's identity", () => {
		hostIdentity("Someone Else", "someone@example.com");

		const root = freshProject();
		initGit(root);

		expect(commitAuthor(root)).toBe(IDENTITY);
	});
});

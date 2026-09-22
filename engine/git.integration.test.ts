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
import { initGit, restoreFilesTo, snapshot } from "./git.js";

let root: string;
let originalCwd: string;

beforeEach(() => {
	process.env.GIT_AUTHOR_NAME ??= "tdd-test";
	process.env.GIT_AUTHOR_EMAIL ??= "tdd@test.local";
	process.env.GIT_COMMITTER_NAME ??= "tdd-test";
	process.env.GIT_COMMITTER_EMAIL ??= "tdd@test.local";

	root = join(tmpdir(), `tdd-git-integration-${Date.now()}-${Math.random()}`);
	mkdirSync(join(root, "src"), { recursive: true });
	originalCwd = process.cwd();
	process.chdir(root);
	initGit(root);
});

afterEach(() => {
	process.chdir(originalCwd);
	rmSync(root, { recursive: true, force: true });
});

describe("restoreFilesTo with real git from a different cwd", () => {
	it("restores tracked files to their snapshot content", () => {
		writeFileSync(join(root, "src", "tracked.ts"), "original\n");
		snapshot(root, "red");
		writeFileSync(join(root, "src", "tracked.ts"), "modified\n");

		process.chdir(tmpdir());
		restoreFilesTo(root, ["src/tracked.ts"]);

		expect(readFileSync(join(root, "src", "tracked.ts"), "utf-8")).toBe(
			"original\n",
		);
	});

	it("deletes untracked files", () => {
		snapshot(root, "red");
		writeFileSync(join(root, "src", "new.ts"), "new\n");

		process.chdir(tmpdir());
		restoreFilesTo(root, ["src/new.ts"]);

		expect(existsSync(join(root, "src", "new.ts"))).toBe(false);
	});
});

import { describe, expect, it } from "vitest";
import {
	isTddPath,
	LEGACY_TDD_DIR,
	legacyDirWarning,
	lockedDirFor,
	resolveTddDir,
	resolveTddLayout,
	TDD_DIR,
	tddPath,
} from "./paths.js";

function deps(present: string[]) {
	return {
		existsSync: (path: string) =>
			present.some((p) => path === `/proj/${p}` || path.endsWith(`/${p}`)),
	};
}

describe("resolveTddLayout", () => {
	it("uses .tdd when it exists", () => {
		expect(resolveTddLayout("/proj", deps([TDD_DIR])).dir).toBe(TDD_DIR);
	});

	it("falls back to .pi/tdd for legacy projects", () => {
		const layout = resolveTddLayout("/proj", deps([LEGACY_TDD_DIR]));
		expect(layout.dir).toBe(LEGACY_TDD_DIR);
		expect(layout.legacyDirPresent).toBe(false);
	});

	it("prefers .tdd and flags the legacy directory when both exist", () => {
		const layout = resolveTddLayout("/proj", deps([TDD_DIR, LEGACY_TDD_DIR]));
		expect(layout.dir).toBe(TDD_DIR);
		expect(layout.legacyDirPresent).toBe(true);
	});

	it("defaults to .tdd for an unconfigured project", () => {
		expect(resolveTddLayout("/proj", deps([])).dir).toBe(TDD_DIR);
	});

	it("keeps using .tdd during a half-finished migration", () => {
		const layout = resolveTddLayout(
			"/proj",
			deps([TDD_DIR, LEGACY_TDD_DIR, `${LEGACY_TDD_DIR}/.git`]),
		);
		expect(layout.dir).toBe(TDD_DIR);
		expect(layout.legacyDirPresent).toBe(true);
	});
});

describe("resolveTddDir / tddPath", () => {
	it("returns the resolved directory", () => {
		expect(resolveTddDir("/proj", deps([TDD_DIR]))).toBe(TDD_DIR);
	});

	it("builds absolute paths inside the resolved directory", () => {
		expect(tddPath("/proj", "state.json")).toBe("/proj/.tdd/state.json");
	});
});

describe("locked paths", () => {
	it("locks both layouts, files and the directories themselves", () => {
		expect(lockedDirFor(".tdd")).toBe(TDD_DIR);
		expect(lockedDirFor(".tdd/state.json")).toBe(TDD_DIR);
		expect(lockedDirFor(".pi/tdd/state.json")).toBe(LEGACY_TDD_DIR);
		expect(lockedDirFor(".pi/tdd")).toBe(LEGACY_TDD_DIR);
	});

	it("does not lock paths that merely share a prefix", () => {
		expect(isTddPath(".tddx/state.json")).toBe(false);
		expect(isTddPath(".pi/tddx/state.json")).toBe(false);
		expect(isTddPath("src/.tdd/state.json")).toBe(false);
		expect(isTddPath("src/main.ts")).toBe(false);
	});

	it("normalises ./ prefixes", () => {
		expect(isTddPath("./.tdd/rules.json")).toBe(true);
	});
});

describe("legacyDirWarning", () => {
	it("is silent for a single layout", () => {
		expect(
			legacyDirWarning({ dir: TDD_DIR, legacyDirPresent: false }),
		).toBeUndefined();
	});

	it("names both directories when they collide", () => {
		const warning = legacyDirWarning({ dir: TDD_DIR, legacyDirPresent: true });
		expect(warning).toContain(TDD_DIR);
		expect(warning).toContain(LEGACY_TDD_DIR);
	});
});

import { describe, expect, it } from "vitest";
import { loadSkillFile, parseSkill } from "./skill.js";

describe("shipped skill file", () => {
	it("has the frontmatter the registry requires", () => {
		const skill = loadSkillFile(import.meta.url);
		expect(skill?.name).toBe("tdd-enforcer");
		expect(skill?.description.length).toBeGreaterThan(20);
		expect(skill?.content).toContain("rules.json");
	});

	it("resolves from the build output location too", () => {
		const fromDist = loadSkillFile(
			new URL("../../dist/dsh/index.js", import.meta.url).href,
		);
		expect(fromDist?.name).toBe("tdd-enforcer");
	});
});

describe("parseSkill", () => {
	it("rejects files without usable frontmatter", () => {
		expect(parseSkill("# no frontmatter")).toBeUndefined();
		expect(parseSkill("---\nname: x\n---\nbody")).toBeUndefined();
	});

	it("strips quotes and keeps the whole file", () => {
		const text =
			'---\nname: "tdd-enforcer"\ndescription: "does things"\n---\nbody';
		expect(parseSkill(text)).toEqual({
			name: "tdd-enforcer",
			description: "does things",
			content: text,
		});
	});
});

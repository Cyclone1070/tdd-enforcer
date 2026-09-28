/**
 * Ships the plugin's SKILL.md through the runtime skill registry.
 *
 * `.dsh/skills` would need the file copied into every project, and `.pi/skills`
 * is not a discovery root in DSH at all, so the plugin registers the skill it
 * already ships instead.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { HostContext } from "./types.js";

const CANDIDATES = [
	"../../skills/tdd-enforcer/SKILL.md",
	"../../../skills/tdd-enforcer/SKILL.md",
	"./SKILL.md",
];

export interface SkillFile {
	name: string;
	description: string;
	content: string;
}

/** Parse the `name`/`description` frontmatter fields the registry requires. */
export function parseSkill(text: string): SkillFile | undefined {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
	if (match === null) return undefined;
	const fields: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const index = line.indexOf(":");
		if (index <= 0) continue;
		const key = line.slice(0, index).trim();
		const value = line
			.slice(index + 1)
			.trim()
			.replace(/^["']|["']$/g, "");
		fields[key] = value;
	}
	if (!fields.name || !fields.description) return undefined;
	return {
		name: fields.name,
		description: fields.description,
		content: text,
	};
}

export function loadSkillFile(metaUrl: string): SkillFile | undefined {
	for (const candidate of CANDIDATES) {
		const path = fileURLToPath(new URL(candidate, metaUrl));
		if (!existsSync(path)) continue;
		const parsed = parseSkill(readFileSync(path, "utf8"));
		if (parsed !== undefined) return parsed;
	}
	return undefined;
}

export function registerTddSkill(ctx: HostContext, metaUrl: string): void {
	const skills = ctx.skills;
	if (skills === undefined) return;
	const skill = loadSkillFile(metaUrl);
	if (skill === undefined) return;
	skills.register({
		name: skill.name,
		description: skill.description,
		content: skill.content,
		source: "runtime",
	});
}

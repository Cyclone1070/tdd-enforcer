/**
 * Preflight for the DSH bundle: checks everything the harness will do when it
 * loads this package, so a host-rejection mistake (an invalid command name, a
 * missing output schema, a broken patch) fails here instead of silently
 * leaving the plugin inactive.
 *
 * Run with `npm run preflight` after `npm run build`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** DSH command-name grammar (`dsh-commands`). */
const COMMAND_NAME = /^[a-z][a-z0-9_-]*$/u;
/** Skill-name grammar (`dsh-skill`). */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const failures = [];
const check = (label, ok, detail = "") => {
	if (ok) {
		console.log(`  ok   ${label}`);
		return;
	}
	failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
	console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
};

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

console.log("package manifest");
check("main is declared", typeof pkg.main === "string", String(pkg.main));
check(
	"dsh.bundle.patch is declared",
	typeof pkg.dsh?.bundle?.patch === "string",
	String(pkg.dsh?.bundle?.patch),
);
check(
	"files ships dist/",
	Array.isArray(pkg.files) && pkg.files.includes("dist"),
);

const entryPath = join(root, pkg.main ?? "");
const patchPath = join(root, pkg.dsh?.bundle?.patch ?? "");
check("entry file exists", existsSync(entryPath), pkg.main);
check("patch file exists", existsSync(patchPath), pkg.dsh?.bundle?.patch);

if (existsSync(patchPath)) {
	const patch = readFileSync(patchPath, "utf8");
	check("patch inserts the plugin id", patch.includes(`id: ${pkg.name}`));
	check("patch mounts the plugin name", patch.includes(`name: ${pkg.name}`));
}

console.log("skill file");
const skillPath = join(root, "skills", "tdd-enforcer", "SKILL.md");
if (!existsSync(skillPath)) {
	check("skills/tdd-enforcer/SKILL.md exists", false);
} else {
	const skill = readFileSync(skillPath, "utf8");
	const name = /^name:\s*(.+)$/mu.exec(skill)?.[1]?.trim();
	const description = /^description:\s*(.+)$/mu.exec(skill)?.[1]?.trim();
	check("skill name is kebab-case", SKILL_NAME.test(name ?? ""), name);
	check("skill description is present", (description ?? "").length > 20);
}

if (failures.length === 0) {
	console.log("bundle exports and registrations");
	const mod = await import(/* @vite-ignore */ pathToFileURL(entryPath).href);
	check("exports a string name", typeof mod.name === "string", mod.name);
	check(
		"exports an inject array",
		Array.isArray(mod.inject) && mod.inject.every((s) => typeof s === "string"),
		JSON.stringify(mod.inject),
	);
	check("exports apply()", typeof mod.apply === "function");

	const registered = { commands: [], tools: [], skills: [], guards: 0 };

	/**
	 * Cordis throws when a plugin reads a service it never declared
	 * (`cannot get property "x" without inject`), which is exactly how an
	 * install attempt fails. This stub reproduces that rule: only the
	 * services named in `inject`, plus the ones an `inject()` callback waits
	 * for, are readable.
	 */
	const stubContext = (declared) => {
		const services = {
			tools: {
				guard: () => {
					registered.guards += 1;
					return () => {};
				},
				register: (definition) => {
					registered.tools.push(definition);
					return () => {};
				},
			},
			commands: {
				register: (definition) => {
					registered.commands.push(definition);
					return () => {};
				},
			},
			skills: {
				register: (registration) => {
					registered.skills.push(registration);
					return () => {};
				},
			},
			jobs: {
				events: { subscribe: () => () => {} },
			},
			sessions: { get: () => undefined },
		};
		const available = new Set(declared);
		const target = {
			on: () => () => {},
			effect: (callback) => {
				callback();
				return () => {};
			},
			logger: () => ({ info() {}, warn() {}, debug() {}, error() {} }),
			inject: (deps, callback) => {
				callback(stubContext([...declared, ...deps]));
				return {};
			},
		};
		for (const [name, service] of Object.entries(services)) {
			if (available.has(name)) target[name] = service;
		}
		return new Proxy(target, {
			get(object, property) {
				if (typeof property === "symbol" || property === "then") {
					return object[property];
				}
				if (property in object) return object[property];
				throw new Error(
					`cannot get property "${String(property)}" without inject`,
				);
			},
		});
	};

	if (typeof mod.apply === "function") {
		const declared = Array.isArray(mod.inject) ? mod.inject : [];
		try {
			mod.apply(stubContext(declared));
		} catch (error) {
			check("apply() runs against a strict stub context", false, error.message);
		}
	}

	check("registers a tool guard", registered.guards === 1);

	for (const command of registered.commands) {
		check(
			`command name "${command.name}" is valid`,
			COMMAND_NAME.test(command.name ?? ""),
		);
		check(
			`command "${command.name}" has a handler`,
			typeof command.handler === "function",
		);
		check(
			`command "${command.name}" has a description`,
			typeof command.description === "string" && command.description !== "",
		);
	}

	for (const tool of registered.tools) {
		check(`tool "${tool.name}" has a description`, Boolean(tool.description));
		check(
			`tool "${tool.name}" takes an object schema`,
			tool.parameters?.type === "object",
		);
		check(
			`tool "${tool.name}" declares an output schema`,
			typeof tool.output?.schema === "object" &&
				typeof tool.output?.render === "function",
		);
		check(
			`tool "${tool.name}" implements execute()`,
			typeof tool.execute === "function",
		);
	}

	for (const skill of registered.skills) {
		check(
			`skill "${skill.name}" is kebab-case`,
			SKILL_NAME.test(skill.name ?? ""),
		);
		check(
			`skill "${skill.name}" carries content`,
			(skill.content ?? "").length > 0,
		);
	}
}

if (failures.length > 0) {
	console.error(`\npreflight failed (${failures.length}):`);
	for (const failure of failures) console.error(`  - ${failure}`);
	process.exit(1);
}
console.log("\npreflight ok");

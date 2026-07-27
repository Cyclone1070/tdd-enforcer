import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

function withTempDir(fn: (dir: string) => void) {
	const dir = join(tmpdir(), `tdd-test-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	try {
		fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe("loadConfig", () => {
	it("throws when no config exists", () => {
		withTempDir((dir) => {
			expect(() => loadConfig(dir)).toThrow();
		});
	});

	it("loads config from rules.json", () => {
		withTempDir((dir) => {
			const tddDir = join(dir, ".pi", "tdd");
			mkdirSync(tddDir, { recursive: true });
			writeFileSync(
				join(tddDir, "rules.json"),
				JSON.stringify({
					implFiles: ["tests/**/*.test.ts"],
					testFiles: ["src/**/*.ts"],
					testCommands: ["npm run test"],
					timeoutSeconds: 60,
				}),
				"utf-8",
			);

			const config = loadConfig(dir);
			expect(config.implFiles).toEqual(["tests/**/*.test.ts"]);
			expect(config.timeoutSeconds).toBe(60);
		});
	});

	it("supports multiple test commands", () => {
		withTempDir((dir) => {
			const tddDir = join(dir, ".pi", "tdd");
			mkdirSync(tddDir, { recursive: true });
			writeFileSync(
				join(tddDir, "rules.json"),
				JSON.stringify({
					implFiles: ["tests/**/*.test.ts"],
					testFiles: ["src/**/*.ts"],
					testCommands: ["npm run test:unit", "npm run test:integration"],
				}),
				"utf-8",
			);

			const config = loadConfig(dir);
			expect(config.testCommands).toHaveLength(2);
		});
	});

	it("defaults timeoutSeconds to 120 when omitted", () => {
		withTempDir((dir) => {
			const tddDir = join(dir, ".pi", "tdd");
			mkdirSync(tddDir, { recursive: true });
			writeFileSync(
				join(tddDir, "rules.json"),
				JSON.stringify({
					implFiles: ["tests/**/*.test.ts"],
					testFiles: ["src/**/*.ts"],
					testCommands: ["npm test"],
				}),
				"utf-8",
			);
			const config = loadConfig(dir);
			expect(config.timeoutSeconds).toBe(120);
		});
	});

	describe("validation — throws on invalid content", () => {
		it("throws when implFiles is not an array", () => {
			withTempDir((dir) => {
				const tddDir = join(dir, ".pi", "tdd");
				mkdirSync(tddDir, { recursive: true });
				writeFileSync(
					join(tddDir, "rules.json"),
					JSON.stringify({
						implFiles: "not-an-array",
						testFiles: ["src/**/*.ts"],
						testCommands: ["npm test"],
					}),
					"utf-8",
				);
				expect(() => loadConfig(dir)).toThrow();
			});
		});

		it("throws when testFiles is not an array", () => {
			withTempDir((dir) => {
				const tddDir = join(dir, ".pi", "tdd");
				mkdirSync(tddDir, { recursive: true });
				writeFileSync(
					join(tddDir, "rules.json"),
					JSON.stringify({
						implFiles: ["tests/**/*.test.ts"],
						testFiles: null,
						testCommands: ["npm test"],
					}),
					"utf-8",
				);
				expect(() => loadConfig(dir)).toThrow();
			});
		});

		it("throws when testCommands is not an array", () => {
			withTempDir((dir) => {
				const tddDir = join(dir, ".pi", "tdd");
				mkdirSync(tddDir, { recursive: true });
				writeFileSync(
					join(tddDir, "rules.json"),
					JSON.stringify({
						implFiles: ["tests/**/*.test.ts"],
						testFiles: ["src/**/*.ts"],
						testCommands: "npm test",
					}),
					"utf-8",
				);
				expect(() => loadConfig(dir)).toThrow();
			});
		});

		it("throws on malformed JSON", () => {
			withTempDir((dir) => {
				const tddDir = join(dir, ".pi", "tdd");
				mkdirSync(tddDir, { recursive: true });
				writeFileSync(join(tddDir, "rules.json"), "not json{{", "utf-8");
				expect(() => loadConfig(dir)).toThrow();
			});
		});

		it("throws when implFiles is empty", () => {
			withTempDir((dir) => {
				const tddDir = join(dir, ".pi", "tdd");
				mkdirSync(tddDir, { recursive: true });
				writeFileSync(
					join(tddDir, "rules.json"),
					JSON.stringify({
						implFiles: [],
						testFiles: ["src/**/*.ts"],
						testCommands: ["npm test"],
					}),
					"utf-8",
				);
				expect(() => loadConfig(dir)).toThrow();
			});
		});

		it("throws when testFiles is empty", () => {
			withTempDir((dir) => {
				const tddDir = join(dir, ".pi", "tdd");
				mkdirSync(tddDir, { recursive: true });
				writeFileSync(
					join(tddDir, "rules.json"),
					JSON.stringify({
						implFiles: ["tests/**/*.test.ts"],
						testFiles: [],
						testCommands: ["npm test"],
					}),
					"utf-8",
				);
				expect(() => loadConfig(dir)).toThrow();
			});
		});

		it("throws when testCommands is empty", () => {
			withTempDir((dir) => {
				const tddDir = join(dir, ".pi", "tdd");
				mkdirSync(tddDir, { recursive: true });
				writeFileSync(
					join(tddDir, "rules.json"),
					JSON.stringify({
						implFiles: ["tests/**/*.test.ts"],
						testFiles: ["src/**/*.ts"],
						testCommands: [],
					}),
					"utf-8",
				);
				expect(() => loadConfig(dir)).toThrow();
			});
		});

		it("throws when implFiles contains non-strings", () => {
			withTempDir((dir) => {
				const tddDir = join(dir, ".pi", "tdd");
				mkdirSync(tddDir, { recursive: true });
				writeFileSync(
					join(tddDir, "rules.json"),
					JSON.stringify({
						implFiles: [123],
						testFiles: ["src/**/*.ts"],
						testCommands: ["npm test"],
					}),
					"utf-8",
				);
				expect(() => loadConfig(dir)).toThrow();
			});
		});

		it("throws when testFiles contains non-strings", () => {
			withTempDir((dir) => {
				const tddDir = join(dir, ".pi", "tdd");
				mkdirSync(tddDir, { recursive: true });
				writeFileSync(
					join(tddDir, "rules.json"),
					JSON.stringify({
						implFiles: ["tests/**/*.test.ts"],
						testFiles: [null],
						testCommands: ["npm test"],
					}),
					"utf-8",
				);
				expect(() => loadConfig(dir)).toThrow();
			});
		});

		it("accepts old field names (blockedInRed/blockedInGreen)", () => {
			withTempDir((dir) => {
				const tddDir = join(dir, ".pi", "tdd");
				mkdirSync(tddDir, { recursive: true });
				writeFileSync(
					join(tddDir, "rules.json"),
					JSON.stringify({
						blockedInRed: ["src/**/*.ts"],
						blockedInGreen: ["**/*.test.ts"],
						testCommands: ["npm test"],
					}),
					"utf-8",
				);
				const config = loadConfig(dir);
				expect(config.implFiles).toEqual(["src/**/*.ts"]);
				expect(config.testFiles).toEqual(["**/*.test.ts"]);
			});
		});

		it("throws when testCommands contains non-strings", () => {
			withTempDir((dir) => {
				const tddDir = join(dir, ".pi", "tdd");
				mkdirSync(tddDir, { recursive: true });
				writeFileSync(
					join(tddDir, "rules.json"),
					JSON.stringify({
						implFiles: ["tests/**/*.test.ts"],
						testFiles: ["src/**/*.ts"],
						testCommands: ["npm test", 456],
					}),
					"utf-8",
				);
				expect(() => loadConfig(dir)).toThrow();
			});
		});
	});
});

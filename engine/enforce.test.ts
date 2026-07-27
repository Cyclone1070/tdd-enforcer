import { describe, expect, it } from "vitest";
import { disallowedFiles, isAllowed } from "./enforce.js";
import type { Config } from "./types.js";

const testConfig: Config = {
	implFiles: ["src/**/*.ts", "lib/**/*.ts"],
	testFiles: ["tests/**/*.test.ts", "specs/**/*.spec.ts"],
	testCommands: ["npm test"],
	timeoutSeconds: 30,
};

describe("isAllowed", () => {
	it("allows everything in refactor phase", () => {
		expect(isAllowed("any/file.ts", "refactor", testConfig)).toBe(true);
		expect(isAllowed("tests/foo.test.ts", "refactor", testConfig)).toBe(true);
	});

	describe("red phase", () => {
		it("allows free files", () => {
			expect(isAllowed("README.md", "red", testConfig)).toBe(true);
			expect(isAllowed("package.json", "red", testConfig)).toBe(true);
		});

		it("blocks files in implFiles", () => {
			expect(isAllowed("src/main.ts", "red", testConfig)).toBe(false);
			expect(isAllowed("lib/helper.ts", "red", testConfig)).toBe(false);
		});

		it("allows test files in red phase", () => {
			expect(isAllowed("tests/foo.test.ts", "red", testConfig)).toBe(true);
			expect(isAllowed("specs/api.spec.ts", "red", testConfig)).toBe(true);
		});
	});

	describe("green phase", () => {
		it("allows free files", () => {
			expect(isAllowed("README.md", "green", testConfig)).toBe(true);
		});

		it("allows implementation files in green phase", () => {
			expect(isAllowed("src/main.ts", "green", testConfig)).toBe(true);
			expect(isAllowed("lib/helper.ts", "green", testConfig)).toBe(true);
		});

		it("blocks files in testFiles", () => {
			expect(isAllowed("tests/foo.test.ts", "green", testConfig)).toBe(false);
			expect(isAllowed("specs/api.spec.ts", "green", testConfig)).toBe(false);
		});
	});

	describe("negation patterns (!)", () => {
		const exclConfig: Config = {
			implFiles: ["src/**/*.ts"],
			testFiles: ["src/**/*.ts", "!**/*.test.ts"],
			testCommands: ["npm test"],
			timeoutSeconds: 30,
		};

		it("excludes files matching !pattern from the block", () => {
			expect(isAllowed("src/main.test.ts", "green", exclConfig)).toBe(true);
		});

		it("still blocks files not matching the exclusion", () => {
			expect(isAllowed("src/main.ts", "green", exclConfig)).toBe(false);
		});

		it("excludes spec files with a second !pattern", () => {
			const multiExcl: Config = {
				implFiles: [],
				testFiles: ["src/**/*.ts", "!**/*.test.ts", "!**/*.spec.ts"],
				testCommands: [],
				timeoutSeconds: 30,
			};
			expect(isAllowed("src/main.spec.ts", "green", multiExcl)).toBe(true);
			expect(isAllowed("src/main.test.ts", "green", multiExcl)).toBe(true);
			expect(isAllowed("src/main.ts", "green", multiExcl)).toBe(false);
		});

		it("excludes via complex glob in negation pattern", () => {
			const complexExcl: Config = {
				implFiles: [],
				testFiles: ["src/**", "!src/vendor/**"],
				testCommands: [],
				timeoutSeconds: 30,
			};
			expect(isAllowed("src/vendor/lib.js", "green", complexExcl)).toBe(true);
			expect(isAllowed("src/app.ts", "green", complexExcl)).toBe(false);
			expect(isAllowed("src/utils/helper.ts", "green", complexExcl)).toBe(
				false,
			);
		});

		it("supports ! negation in implFiles as well", () => {
			const redExcl: Config = {
				implFiles: ["src/**/*.ts", "!src/**/*.test.ts"],
				testFiles: [],
				testCommands: [],
				timeoutSeconds: 30,
			};
			// test file excluded from block → allowed in red
			expect(isAllowed("src/main.test.ts", "red", redExcl)).toBe(true);
			// impl file still blocked
			expect(isAllowed("src/main.ts", "red", redExcl)).toBe(false);
			// free file unaffected
			expect(isAllowed("README.md", "red", redExcl)).toBe(true);
		});

		it("free file with exclusions in config remains free", () => {
			expect(isAllowed("README.md", "green", exclConfig)).toBe(true);
		});

		it("file matching !pattern alone (no positive match) is not blocked", () => {
			// File matches the negation pattern but NOT the positive pattern.
			// MatchPatterns returns false (no positive match), so it's not blocked.
			expect(isAllowed("other/foo.test.ts", "green", exclConfig)).toBe(true);
		});

		it("exclusion-only patterns block nothing", () => {
			const exclOnly: Config = {
				implFiles: [],
				testFiles: ["!**/*.test.ts"],
				testCommands: [],
				timeoutSeconds: 30,
			};
			expect(isAllowed("any/file.ts", "green", exclOnly)).toBe(true);
			expect(isAllowed("README.md", "green", exclOnly)).toBe(true);
			expect(isAllowed("tests/foo.test.ts", "green", exclOnly)).toBe(true);
		});
	});
});

describe("hasRedSnapshot parameter", () => {
	it("allows all files in green when hasRedSnapshot is true", () => {
		expect(isAllowed("tests/foo.test.ts", "green", testConfig, true)).toBe(
			true,
		);
		expect(isAllowed("src/main.ts", "green", testConfig, true)).toBe(true);
		expect(isAllowed("any/file.txt", "green", testConfig, true)).toBe(true);
	});

	it("still blocks test files in green when hasRedSnapshot is false (default)", () => {
		expect(isAllowed("tests/foo.test.ts", "green", testConfig, false)).toBe(
			false,
		);
		expect(isAllowed("src/main.ts", "green", testConfig, false)).toBe(true);
	});

	it("does not affect red phase — impl still blocked", () => {
		expect(isAllowed("src/main.ts", "red", testConfig, true)).toBe(false);
		expect(isAllowed("tests/foo.test.ts", "red", testConfig, true)).toBe(true);
	});

	it("does not affect refactor phase", () => {
		expect(isAllowed("tests/foo.test.ts", "refactor", testConfig, true)).toBe(
			true,
		);
		expect(isAllowed("src/main.ts", "refactor", testConfig, true)).toBe(true);
	});
});

describe("disallowedFiles", () => {
	it("returns empty for refactor phase", () => {
		expect(
			disallowedFiles(
				["src/main.ts", "tests/foo.test.ts"],
				"refactor",
				testConfig,
			),
		).toEqual([]);
	});

	it("returns empty when input list is empty", () => {
		expect(disallowedFiles([], "red", testConfig)).toEqual([]);
		expect(disallowedFiles([], "green", testConfig)).toEqual([]);
	});

	it("filters out implFiles files in red phase", () => {
		const files = ["src/main.ts", "README.md", "tests/foo.test.ts"];
		expect(disallowedFiles(files, "red", testConfig)).toEqual(["src/main.ts"]);
	});

	it("filters out testFiles files in green phase", () => {
		const files = ["tests/foo.test.ts", "README.md", "src/main.ts"];
		expect(disallowedFiles(files, "green", testConfig)).toEqual([
			"tests/foo.test.ts",
		]);
	});

	it("allows free files in both phases", () => {
		const free = ["README.md", "package.json", "docs/guide.md"];
		expect(disallowedFiles(free, "red", testConfig)).toEqual([]);
		expect(disallowedFiles(free, "green", testConfig)).toEqual([]);
	});

	it("passes hasRedSnapshot through to isAllowed", () => {
		const files = ["tests/foo.test.ts", "src/main.ts", "README.md"];
		// With hasRedSnapshot=true in green, test files should NOT be disallowed
		expect(disallowedFiles(files, "green", testConfig, true)).toEqual([]);
		// Without hasRedSnapshot, test files are disallowed
		expect(disallowedFiles(files, "green", testConfig, false)).toEqual([
			"tests/foo.test.ts",
		]);
	});
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { tddLog } from "./log.js";

describe("tddLog", () => {
	let mockExistsSync: ReturnType<typeof vi.fn>;
	let mockMkdirSync: ReturnType<typeof vi.fn>;
	let mockAppendFileSync: ReturnType<typeof vi.fn>;
	let mockWriteFileSync: ReturnType<typeof vi.fn>;
	let mockReadFileSync: ReturnType<typeof vi.fn>;
	let writtenContent: string;

	function makeDeps() {
		return {
			existsSync: mockExistsSync,
			mkdirSync: mockMkdirSync,
			appendFileSync: mockAppendFileSync,
			writeFileSync: mockWriteFileSync,
			readFileSync: mockReadFileSync,
		};
	}

	beforeEach(() => {
		writtenContent = "";
		mockExistsSync = vi.fn().mockReturnValue(true);
		mockMkdirSync = vi.fn();
		mockAppendFileSync = vi.fn((_path: string, content: string) => {
			writtenContent += content;
		});
		mockWriteFileSync = vi.fn((_path: string, content: string) => {
			writtenContent = content;
		});
		mockReadFileSync = vi.fn(() => writtenContent);
	});

	it("creates the log file if it doesn't exist", () => {
		// readFileSync throws → outer catch silently swallows it
		mockReadFileSync = vi.fn(() => {
			throw new Error("ENOENT: no such file or directory");
		});

		tddLog("/tdd", "INFO", "hello", undefined, makeDeps());

		expect(mockAppendFileSync).toHaveBeenCalled();
		expect(mockAppendFileSync.mock.calls[0][1]).toContain("hello");
	});

	it("appends multiple lines", () => {
		tddLog("/tdd", "INFO", "line one", undefined, makeDeps());
		tddLog("/tdd", "DEBUG", "line two", undefined, makeDeps());

		const lines = writtenContent.trim().split("\n");
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("[INFO]");
		expect(lines[0]).toContain("line one");
		expect(lines[1]).toContain("[DEBUG]");
		expect(lines[1]).toContain("line two");
		expect(mockAppendFileSync).toHaveBeenCalledTimes(2);
	});

	it("includes data as JSON when provided", () => {
		tddLog("/tdd", "INFO", "with data", { key: "val", num: 42 }, makeDeps());

		expect(writtenContent).toContain('{"key":"val","num":42}');
	});

	it("trims to last 1000 lines when exceeded", () => {
		for (let i = 0; i < 1005; i++) {
			tddLog("/tdd", "DEBUG", `line ${i}`, undefined, makeDeps());
		}

		const lines = writtenContent.trim().split("\n");
		expect(lines).toHaveLength(1000);
		expect(lines[0]).toContain("line 5");
		expect(lines[999]).toContain("line 1004");
	});

	it("does not throw on invalid tddDir", () => {
		// Simulate appendFileSync failure
		mockAppendFileSync = vi.fn(() => {
			throw new Error("ENOENT: no such file or directory");
		});

		expect(() =>
			tddLog("/nonexistent/path/tdd", "INFO", "fail", undefined, makeDeps()),
		).not.toThrow();
	});

	it("handles missing data field gracefully", () => {
		tddLog("/tdd", "WARN", "no data", undefined, makeDeps());

		expect(writtenContent).toContain("[WARN]");
		expect(writtenContent).toContain("no data");
		expect(writtenContent).not.toContain("{}");
	});
});

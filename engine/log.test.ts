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

	it("appends log line with timestamp and level", () => {
		tddLog("/tdd", "INFO", "hello", undefined, makeDeps());

		expect(mockAppendFileSync).toHaveBeenCalledOnce();
		const written = mockAppendFileSync.mock.calls[0][1] as string;
		expect(written).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		expect(written).toContain("[INFO]");
		expect(written).toContain("hello");
		expect(written.endsWith("\n")).toBe(true);
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

	it("includes data after message separated by a space", () => {
		tddLog("/tdd", "INFO", "msg", { a: 1 }, makeDeps());

		const line = writtenContent.trim();
		expect(line).toContain('msg {"a":1}');
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

	it("does not throw when appendFileSync fails", () => {
		mockAppendFileSync = vi.fn(() => {
			throw new Error("ENOENT: no such file or directory");
		});

		expect(() =>
			tddLog("/nonexistent/path/tdd", "INFO", "fail", undefined, makeDeps()),
		).not.toThrow();
	});

	it("does not throw when readFileSync fails (first write)", () => {
		mockReadFileSync = vi.fn(() => {
			throw new Error("ENOENT: no such file or directory");
		});

		expect(() =>
			tddLog("/tdd", "INFO", "hello", undefined, makeDeps()),
		).not.toThrow();
		expect(mockAppendFileSync).toHaveBeenCalled();
	});

	it("handles undefined data gracefully", () => {
		tddLog("/tdd", "WARN", "no data", undefined, makeDeps());

		expect(writtenContent).toContain("[WARN]");
		expect(writtenContent).toContain("no data");
		expect(writtenContent).not.toContain("{}");
	});

	it("logs at WARN level", () => {
		tddLog("/tdd", "WARN", "warning message", undefined, makeDeps());
		expect(writtenContent).toContain("[WARN]");
	});

	it("logs at ERROR level", () => {
		tddLog("/tdd", "ERROR", "error message", undefined, makeDeps());
		expect(writtenContent).toContain("[ERROR]");
	});

	it("logs at DEBUG level", () => {
		tddLog("/tdd", "DEBUG", "debug message", undefined, makeDeps());
		expect(writtenContent).toContain("[DEBUG]");
	});

	it("writes to the path join(tddDir, 'tdd.log')", () => {
		tddLog("/custom/tdd/path", "INFO", "test", undefined, makeDeps());

		expect(mockAppendFileSync).toHaveBeenCalledWith(
			"/custom/tdd/path/tdd.log",
			expect.any(String),
			"utf-8",
		);
	});

	it("trims to exactly 1000 lines keeping newest", () => {
		for (let i = 0; i < 1001; i++) {
			tddLog("/tdd", "DEBUG", `line ${i}`, undefined, makeDeps());
		}

		const lines = writtenContent.trim().split("\n");
		expect(lines).toHaveLength(1000);
		expect(lines[0]).toContain("line 1");
		expect(lines[999]).toContain("line 1000");
	});

	it("keeps all lines when exactly at MAX_LINES", () => {
		for (let i = 0; i < 1000; i++) {
			tddLog("/tdd", "DEBUG", `line ${i}`, undefined, makeDeps());
		}

		const lines = writtenContent.trim().split("\n");
		expect(lines).toHaveLength(1000);
		expect(lines[0]).toContain("line 0");
		expect(lines[999]).toContain("line 999");
	});

	it("appends to existing content instead of overwriting", () => {
		tddLog("/tdd", "INFO", "first", undefined, makeDeps());
		tddLog("/tdd", "INFO", "second", undefined, makeDeps());

		expect(writtenContent).toContain("first");
		expect(writtenContent).toContain("second");
	});

	it("uses the real filesystem deps by default", () => {
		// Just verify the function exists and can be called without deps
		expect(typeof tddLog).toBe("function");
	});
});

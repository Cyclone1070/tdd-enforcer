import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { tddLog } from "./log.js";

function setup() {
  const dir = join(tmpdir(), `tdd-log-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function teardown(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

describe("tddLog", () => {
  it("creates the log file if it doesn't exist", () => {
    const dir = setup();
    tddLog(dir, "INFO", "hello");
    expect(existsSync(join(dir, "tdd.log"))).toBe(true);
    teardown(dir);
  });

  it("appends multiple lines", () => {
    const dir = setup();
    tddLog(dir, "INFO", "line one");
    tddLog(dir, "DEBUG", "line two");
    const content = readFileSync(join(dir, "tdd.log"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("[INFO]");
    expect(lines[0]).toContain("line one");
    expect(lines[1]).toContain("[DEBUG]");
    expect(lines[1]).toContain("line two");
    teardown(dir);
  });

  it("includes data as JSON when provided", () => {
    const dir = setup();
    tddLog(dir, "INFO", "with data", { key: "val", num: 42 });
    const content = readFileSync(join(dir, "tdd.log"), "utf-8");
    expect(content).toContain('{"key":"val","num":42}');
    teardown(dir);
  });

  it("trims to last 1000 lines when exceeded", () => {
    const dir = setup();
    for (let i = 0; i < 1005; i++) {
      tddLog(dir, "DEBUG", `line ${i}`);
    }
    const content = readFileSync(join(dir, "tdd.log"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1000);
    expect(lines[0]).toContain("line 5");
    expect(lines[999]).toContain("line 1004");
    teardown(dir);
  });

  it("does not throw on invalid tddDir", () => {
    expect(() => tddLog("/nonexistent/path/tdd", "INFO", "fail")).not.toThrow();
  });

  it("handles missing data field gracefully", () => {
    const dir = setup();
    tddLog(dir, "WARN", "no data");
    const content = readFileSync(join(dir, "tdd.log"), "utf-8");
    expect(content).toContain("[WARN]");
    expect(content).toContain("no data");
    expect(content).not.toContain("{}");
    teardown(dir);
  });
});

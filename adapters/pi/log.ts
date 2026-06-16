import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_LINES = 1000;

export function tddLog(
  tddDir: string,
  level: "INFO" | "WARN" | "ERROR" | "DEBUG",
  msg: string,
  data?: Record<string, unknown>,
): void {
  try {
    const logPath = join(tddDir, "tdd.log");
    const timestamp = new Date().toISOString();
    const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : "";
    const line = `[${timestamp}] [${level}] ${msg}${dataStr}\n`;

    appendFileSync(logPath, line, "utf-8");

    // Trim to last MAX_LINES
    const content = readFileSync(logPath, "utf-8");
    const lines = content.split("\n");
    if (lines.length > MAX_LINES + 1) {
      const trimmed = lines.slice(-MAX_LINES).join("\n") + "\n";
      writeFileSync(logPath, trimmed, "utf-8");
    }
  } catch {
    // Logging never throws — fail silently
  }
}

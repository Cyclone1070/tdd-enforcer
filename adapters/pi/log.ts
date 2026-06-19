import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

const MAX_LINES = 1000;

type FsDeps = {
	existsSync: typeof existsSync;
	mkdirSync: typeof mkdirSync;
	appendFileSync: typeof appendFileSync;
	writeFileSync: typeof writeFileSync;
	readFileSync: typeof readFileSync;
};

export function tddLog(
	tddDir: string,
	level: "INFO" | "WARN" | "ERROR" | "DEBUG",
	msg: string,
	data?: Record<string, unknown>,
	deps: FsDeps = {
		existsSync,
		mkdirSync,
		appendFileSync,
		writeFileSync,
		readFileSync,
	},
): void {
	try {
		const logPath = join(tddDir, "tdd.log");
		const timestamp = new Date().toISOString();
		const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : "";
		const line = `[${timestamp}] [${level}] ${msg}${dataStr}\n`;

		deps.appendFileSync(logPath, line, "utf-8");

		// Trim to last MAX_LINES
		const content = deps.readFileSync(logPath, "utf-8");
		const lines = content.trimEnd().split("\n");
		if (lines.length > MAX_LINES) {
			const trimmed = `${lines.slice(-MAX_LINES).join("\n")}\n`;
			deps.writeFileSync(logPath, trimmed, "utf-8");
		}
	} catch {
		// Logging never throws — fail silently
	}
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./types.js";

const TDD_DIR = ".pi/tdd";

export function configPath(projectRoot: string): string {
  return join(projectRoot, TDD_DIR, "rules.json");
}

export function loadConfig(projectRoot: string): Config {
  const path = configPath(projectRoot);
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.allowedRedPhaseFiles)) {
    throw new Error("rules.json: allowedRedPhaseFiles must be an array");
  }
  if (!Array.isArray(parsed.allowedGreenPhaseFiles)) {
    throw new Error("rules.json: allowedGreenPhaseFiles must be an array");
  }
  if (!Array.isArray(parsed.testCommands)) {
    throw new Error("rules.json: testCommands must be an array");
  }

  return {
    allowedRedPhaseFiles: parsed.allowedRedPhaseFiles,
    allowedGreenPhaseFiles: parsed.allowedGreenPhaseFiles,
    testCommands: parsed.testCommands,
    timeoutSeconds: parsed.timeoutSeconds ?? 120,
  };
}

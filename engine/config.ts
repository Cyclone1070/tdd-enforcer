import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./types.js";

const DEFAULT_CONFIG: Config = {
  allowedRedPhaseFiles: [],
  allowedGreenPhaseFiles: [],
  testCommands: [],
  timeoutSeconds: 120,
};

const TDD_DIR = ".pi/tdd";

export function configPath(projectRoot: string): string {
  return join(projectRoot, TDD_DIR, "rules.json");
}

export function loadConfig(projectRoot: string): Config {
  const path = configPath(projectRoot);
  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);

    return {
      allowedRedPhaseFiles: parsed.allowedRedPhaseFiles ?? [],
      allowedGreenPhaseFiles: parsed.allowedGreenPhaseFiles ?? [],
      testCommands: parsed.testCommands ?? [],
      timeoutSeconds: parsed.timeoutSeconds ?? 120,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

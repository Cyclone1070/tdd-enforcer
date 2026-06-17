---
name: tdd-init
description: Use when the TDD enforcer extension reports missing configuration — .pi/tdd/ directory, rules.json, or state.json not found. Also use when starting TDD on a new project.
---

# TDD Init

## Overview

Set up the TDD enforcer. The extension enforces the Red-Green-Refactor cycle by restricting which files the agent can modify per phase.

## What to Create

```
project-root/
  .pi/
    tdd/
      rules.json        # File patterns and test commands
      state.json        # Phase state (create, then /tdd:on sets enabled)
```

## rules.json

```json
{
  "allowedRedPhaseFiles": ["tests/**/*.test.ts"],
  "allowedGreenPhaseFiles": ["src/**/*.ts"],
  "testCommands": ["npm run test"],
  "timeoutSeconds": 120
}
```

| Field | What | Why |
|-------|------|-----|
| `allowedRedPhaseFiles` | Glob patterns for files writable in RED phase | Typically test files |
| `allowedGreenPhaseFiles` | Glob patterns for files writable in GREEN phase | Typically implementation files |
| `testCommands` | Non-interactive commands (string or array) | Run on phase transitions to check gate |
| `timeoutSeconds` | Per-command timeout (default 120) | Prevents hung suites |

- Globs are relative to project root
- Files matching neither set are free in all phases
- All 3 array fields **must** be non-empty

## state.json

```json
{
  "enabled": false,
  "current": "red"
}
```

Start with `enabled: false`. Run `/tdd:on` — it validates config, initialises the private git repo, snapshots the working tree, and sets `enabled: true`.

## Setup Steps

1. Create `.pi/tdd/` directory
2. Create `.pi/tdd/rules.json` with file patterns and test commands
3. Create `.pi/tdd/state.json` with `enabled: false, current: "red"`
4. Run `/tdd:on` to enable enforcement

## TDD Cycle

| Phase | Allowed | Gate to advance |
|-------|---------|-----------------|
| RED | Test files only | Tests must fail |
| GREEN | Implementation files only | Tests must pass |
| REFACTOR | All files | Tests must pass |

Use `next_tdd_phase` to advance, `previous_tdd_phase` to revert.

## Common Patterns

**Standard split:**
```json
"allowedRedPhaseFiles": ["tests/**/*.test.ts"],
"allowedGreenPhaseFiles": ["src/**/*.ts"]
```

**Monorepo:**
```json
"testCommands": ["npm run test:unit", "npm run test:e2e"]
```

## Recovery

```bash
/tdd:reset    # Destroys snapshot history, resets to RED (disabled)
/tdd:on       # Re-enable with fresh snapshot
```

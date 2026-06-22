---
name: tdd-enforcer
description: Use when working within TDD enforcer extension — understand phase rules, file locks, agent tools vs user commands, and when to call next/previous phase or ask the user for help.
---

# TDD Enforcer Skill

This extension enforces the **Red-Green-Refactor** cycle of TDD.

It locks files per phase — only test files in RED, only implementation files in GREEN, everything allowed in REFACTOR. The entire `.pi/tdd/` directory is locked when TDD is active.

---

## What the Agent Controls vs What the User Controls

| Action | Who |
|--------|-----|
| Create `.pi/tdd/rules.json` with file patterns and test commands | **Agent** |
| Run `/tdd:on` to enable enforcement | **User** |
| Run `/tdd:off` to disable enforcement | **User** |
| Run `/tdd:reset` to nuke all recorded state and start fresh | **User** |
| Run `/tdd:status` to check state and config | **User** |
| Call `next_tdd_phase` to advance through the cycle | **Agent** |
| Call `previous_tdd_phase` to roll back when previous phase work was wrong | **Agent** |
| Call `tdd_status` to check enforcement status | **Agent** |

---

## Setup

1. **Agent** checks if the repo has a test framework set up. If it doesn't, stop and ask the user what they want. Do not make assumptions, pick defaults, or proceed without their explicit decision. Then create `.pi/tdd/rules.json` with these fields:

```json
{
  "blockedInRed":   ["src/**/*.ts", "lib/**/*.ts", "!src/**/*.test.ts"],
  "blockedInGreen": ["**/*.test.ts"],
  "testCommands":   ["npm test"],
  "timeoutSeconds": 30
}
```

- `blockedInRed` — globs the agent **cannot** modify in RED phase (implementation files)
- `blockedInGreen` — globs the agent **cannot** modify in GREEN phase (test files)
- `!` exclusion prefix — optional, carves out subsets from a block list at init time. E.g. `!src/**/*.test.ts` excludes co-located test files from `blockedInRed` so the agent can write them in RED phase
- `testCommands` — determines if a phase transition passes. Exit 0 passes, non-zero blocks. **Runs in parallel** — all entries are started concurrently. Use `&&` inside a single string entry to chain multiple commands in one step (e.g. `"npm run build && npm test"`). Do not rely on array ordering for dependency chains; put dependent commands in the same string entry with `&&`.

  **Prefer auto-fix commands** that apply fixes (formatting, linting, etc.) before reporting remaining violations. Without auto-fix, formatting or lint issues in phase-locked files (e.g. test files in GREEN) will block the gate with no way to fix them — forcing `previous_tdd_phase` and losing all progress. Auto-fix commands avoid this deadlock by fixing locked files before the check runs.
- `timeoutSeconds` — test timeout per command (default: 120)

2. **User** runs `/tdd:on` to enable enforcement.

---

## Phase Rules

### RED
Files matching `blockedInRed` are locked — everything else is free.

Write failing tests for one feature at a time. Think about what could go wrong and test for it — don't just verify the happy path, cover unhappy paths and edge cases too. Minimise the scope of each TDD cycle so reverting is cheap and safe if assumptions turn out wrong.

Call `next_tdd_phase` once tests fail.

### GREEN
Files matching `blockedInGreen` are locked — everything else is free.

Write the simplest code that makes the failing tests pass — nothing more. The tests are your spec; if they pass, you're done.

If the RED phase tests were wrong, call `previous_tdd_phase` to go back and fix them before implementing. All current changes are lost, but that's better since the current changes was building on false assumptions. Don't be afraid to discard — clean slate beats patched code.

Call `next_tdd_phase` once all tests pass.

### REFACTOR
All files are free to modify. Refactor without changing behaviour.
Call `next_tdd_phase` once tests pass to start a new RED cycle.

---

## Hard Rules

- **Never write to `.pi/tdd/`.** The extension owns that directory — writes are blocked and bash changes are reverted.
- **Never run `/tdd:` commands yourself.** They're registered as user-only commands and won't work when you type them.

---

## Agent Tools

### `next_tdd_phase`
Runs transition gate checks. Fails if:
- RED→GREEN: tests don't fail (must have a failing test)
- GREEN→REFACTOR: tests fail (must pass)
- REFACTOR→RED: tests fail (must pass)

Also validates no locked files were modified. On success, records the current state and advances the phase.

### `previous_tdd_phase`
Use when the previous phase's work was wrong and the current phase cannot proceed because of it. Rolls back to the previous phase so that work can be redone correctly. All changes made in the current phase are lost.

### `tdd_status`
Shows the current phase, blocked file globs per phase, and test commands.

---

## TDD is OFF — Enforcement is Suspended

When TDD is disabled (`/tdd:off`), all files are free to modify. The hooks pass through and no blocks or reverts occur. To re-enable, ask the user to run `/tdd:on`.

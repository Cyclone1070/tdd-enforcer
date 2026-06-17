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

1. **Agent** creates `.pi/tdd/rules.json` with these fields:

```json
{
  "allowedRedPhaseFiles": ["tests/**/*.test.ts"],
  "allowedGreenPhaseFiles": ["src/**/*.ts"],
  "testCommands": ["npm test"],
  "timeoutSeconds": 30
}
```

- `allowedRedPhaseFiles` — globs the agent can create/modify in RED phase (tests)
- `allowedGreenPhaseFiles` — globs the agent can create/modify in GREEN phase (implementation)
- `testCommands` — shell commands to run tests
- `timeoutSeconds` — test timeout per command

2. **User** runs `/tdd:on` to enable enforcement.

---

## Phase Rules

### RED
Write failing tests matching `allowedRedPhaseFiles` patterns. Files matching `allowedGreenPhaseFiles` are locked. Files matching neither set are always free. Call `next_tdd_phase` once tests fail.

### GREEN
Implement features matching `allowedGreenPhaseFiles` patterns. Test files from `allowedRedPhaseFiles` are locked. Files matching neither set are always free. Call `next_tdd_phase` once tests pass.

### REFACTOR
All files are free to modify. Refactor without changing behaviour. Call `next_tdd_phase` once tests pass to start a new RED cycle.

---

## Hard Rules

- **Never bypass TDD.** If TDD blocks a change, it's because you're in the wrong phase or the file isn't allowed in this phase. The solution is always to work within the rules, not around them.

  - Need to change a locked file? Either advance through the cycle (`next_tdd_phase`) or roll back to fix earlier work (`previous_tdd_phase`).
  - Wrong assumptions about the task? Roll back with `previous_tdd_phase`, the phase restarts clean.
  - Fundamentally blocked? Ask the user to run the appropriate `/tdd:` command (change phase, disable, or reset).

- **Never write to `.pi/tdd/`.** The extension owns that directory — writes are blocked and bash changes are reverted. Any change you make there is ignored or overwritten.

- **Never run `/tdd:` commands yourself.** They're registered as user-only commands. They won't work when you type them.

- **Don't be afraid to discard.** If the previous phase work was wrong, all current-phase changes are built on false assumptions. Prefer a clean slate — call `previous_tdd_phase` and redo it properly.

- **Keep cycles small but tests comprehensive.** Write tests for one feature at a time. Cover happy path, edge cases, and unhappy paths before moving to GREEN. Small cycles mean less to lose if assumptions turn out wrong. Reverting becomes cheap and safe.

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
Shows the current phase, allowed file globs, and test commands.

---

## TDD is OFF — Enforcement is Suspended

When TDD is disabled (`/tdd:off`), all files are free to modify. The hooks pass through and no blocks or reverts occur. To re-enable, ask the user to run `/tdd:on`.

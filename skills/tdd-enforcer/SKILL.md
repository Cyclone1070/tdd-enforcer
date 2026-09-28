---
name: tdd-enforcer
description: Use when working within the TDD enforcer plugin — understand phase rules, file locks, agent tools vs user commands, how locked files are enforced per host, and when to call next/previous phase or ask the user for help.
---

# TDD Enforcer Skill

This plugin enforces the **Red-Green** cycle of TDD.

It locks files per phase — only test files in RED, only implementation files in GREEN. The TDD state directory itself is always locked while TDD is active.

Supported hosts: the **pi coding agent** and the **DeepSeek Harness (DSH)**. This file ships inside the plugin; DSH registers it at runtime, so there is nothing to copy into your project.

---

## Where the state lives

| Layout | Status |
|--------|--------|
| `.tdd/` | Primary. Used when it exists. |
| `.pi/tdd/` | Fallback, so existing pi projects keep working. |

If both exist, `.tdd/` wins and `.pi/tdd/` is ignored — but both stay write-locked. Tell the user to finish the migration if you see that warning. Only `rules.json`, `state.json`, `tdd.log`, `.gitignore`, and a private `.git/` live there; never write to any of them yourself.

**Migrating:** each layout carries its own state and snapshot history, so the move is: turn TDD off, `mv .pi/tdd .tdd`, turn TDD back on. The re-enable snapshot is what re-records the state directory in the private repo — without it a rollback would restore the old paths. Creating an empty `.tdd/` instead starts from a clean RED baseline and leaves the old directory behind, which is what produces the warning above.

---

## What the Agent Controls vs What the User Controls

| Action | Who |
|--------|-----|
| Create `.tdd/rules.json` with file patterns and test commands | **Agent** |
| Enable enforcement | **User** — `/tdd-on` (DSH) or `/tdd:on` (pi) |
| Disable enforcement | **User** — `/tdd-off` / `/tdd:off` |
| Reset all recorded state | **User** — `/tdd-reset` / `/tdd:reset` |
| Check state and config | **User** — `/tdd-status` / `/tdd:status` |
| Jump straight to a phase | **User** — `/tdd-red`, `/tdd-green` |
| Call `next_tdd_phase` to advance through the cycle | **Agent** |
| Call `previous_tdd_phase` to roll back when previous phase work was wrong | **Agent** |
| Call `tdd_status` to check enforcement status | **Agent** |

---

## Setup

1. **Agent** checks if the repo has a test framework set up. If it doesn't, stop and ask the user what they want. Do not make assumptions, pick defaults, or proceed without their explicit decision. Then create `.tdd/rules.json` with these fields:

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

2. **User** enables enforcement: `/tdd-on` (DSH) or `/tdd:on` (pi).

---

## Phase Rules

### RED
Files matching `blockedInRed` are locked — everything else is free.

Write failing tests for one feature at a time. Think about what could go wrong and test for it — don't just verify the happy path, cover unhappy paths and edge cases too. Minimise the scope of each TDD cycle so reverting is cheap and safe if assumptions turn out wrong.

Call `next_tdd_phase` once tests fail.

### GREEN
Files matching `blockedInGreen` are locked — everything else is free.

Write the simplest code that makes the failing tests pass — nothing more. The tests are your spec; if they pass, you're done.

If the RED phase tests were wrong, call `previous_tdd_phase` to go back and fix them before implementing. All current changes are lost, but that's better since the current changes were building on false assumptions. Don't be afraid to discard — clean slate beats patched code.

Call `next_tdd_phase` once all tests pass to start a new RED cycle.

---

## How locked files are enforced

Enforcement depends on whether the tool names the file it is about to touch.

**`write` and `edit` — blocked before they run.** The path is in the call arguments, so a locked path is denied outright and nothing is written. You get the reason back and should change approach, not retry.

**`bash`, MCP tools, and any other tool — snapshot and revert.** The plugin cannot know what an arbitrary command will touch, so it snapshots the project before the call and diffs it after. A locked file that **both changed and existed before the call** is restored to its pre-call content (whether or not it was ever committed); a locked file the call itself created is removed. Files the current phase allows are left alone. The call is reported as an error with the list of reverted files, plus the list of changes that were kept, and the command's own output is preserved.

**Background `bash` is covered too.** Its snapshot is settled when the job finishes instead of when the tool returns. Because the tool already answered, the revert is reported as a notice on a later tool result, not on the background call itself.

**Read-only tools** (`read`, `glob`, `grep`, and similar) are skipped, so they cost nothing.

Because the revert is path-scoped by the phase rules, concurrent work is safe: a locked file that was touched is restored, everything else survives. Note the limits:

- The snapshot covers the project directory only. Writes outside the repo are not reverted.
- A file changed by an MCP server's own separate process, outside the project tree, cannot be attributed to the call.
- `testCommands` are executed by the plugin in the project root, not through the tool sandbox.

---

## Hard Rules

- **Never write to `.tdd/` or `.pi/tdd/`.** The plugin owns those directories — direct writes are blocked, and bash changes are reverted after the fact.
- **Never run the `/tdd-*` (or `/tdd:*`) commands yourself.** They are user-only commands.

---

## Agent Tools

### `next_tdd_phase`
Runs transition gate checks. Fails if:
- RED→GREEN: tests don't fail (must have a failing test)
- GREEN→RED: tests fail (must pass)

Also validates no locked files were modified. On success, records the current state and advances the phase.

### `previous_tdd_phase`
Use when the previous phase's work was wrong and the current phase cannot proceed because of it. Rolls back to the previous phase so that work can be redone correctly. All changes made in the current phase are lost.

### `tdd_status`
Shows the current phase, blocked file globs per phase, and test commands.

---

## TDD is OFF — Enforcement is Suspended

When TDD is disabled, every file is free to modify: no blocks and no reverts. Ask the user to enable it again when you need the cycle enforced.

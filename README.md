# tdd-enforcer

**Lock files per TDD phase. Gate transitions on test outcomes.**

[![CI](https://github.com/Cyclone1070/tdd-enforcer/actions/workflows/ci.yml/badge.svg)](https://github.com/Cyclone1070/tdd-enforcer/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/tdd-enforcer.svg)](https://www.npmjs.com/package/tdd-enforcer)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Features

- **Phase-locked file access** — prevents the agent from modifying test files in GREEN and implementation files in RED. Everything is open in REFACTOR
- **Guards all file-modifying tools** — `write`, `edit`, and `bash` are all intercepted. All invalid modifications are blocked.
- **Automatic transition gates** — advancing to the next phase requires tests to fail (RED→GREEN) or pass (GREEN→REFACTOR, REFACTOR→RED). Misconfigured or broken transitions are rejected
- **Safe rollback** — if the previous phase's work was wrong, reverting discards all current changes and restores the exact working tree from before that phase
- **Stays out of your way** — TDD enforcement is opt-in (`/tdd:on`). Disable anytime with `/tdd:off` to unlock all files
- **Version-controlled config** — `.pi/tdd/rules.json` lives in your repo alongside the code, so the whole team shares the same rules

---

## Setup

### 1. Install

```bash
pi install npm:tdd-enforcer
```

### 2. Ask the agent to set up TDD

Tell the agent to configure TDD for your project, using the `tdd-enforcer` skill to create `.pi/tdd/rules.json` with the right file globs and test commands for your stack.

### 3. Enable TDD

Once configured, run:

```
/tdd:on
```

### Config reference

`.pi/tdd/rules.json` fields (created by the agent, not manually):

| Field | Description |
|-------|-------------|
| `blockedInRed` | Globs the agent **cannot** touch in RED phase (implementation files) |
| `blockedInGreen` | Globs the agent **cannot** touch in GREEN phase (test files) |
| `!` prefix | Exclusion: carves out subsets from a block (e.g. co-located test files) |
| `testCommands` | Commands run in parallel for gate checks. Exit 0 = pass, non-zero = block. Use `&&` inside a single entry to chain dependent steps |
| `timeoutSeconds` | Test timeout per command (default: 120) |

---

## Usage

### User commands

| Command | Description |
|---------|-------------|
| `/tdd:on` | Enable TDD enforcement |
| `/tdd:off` | Disable TDD enforcement, all files become free |
| `/tdd:status` | Show phase, blocked globs, test commands |
| `/tdd:reset` | **Destructive**: nukes all snapshot history, resets to RED (disabled) |
| `/tdd:red`, `/tdd:green`, `/tdd:refactor` | Skip to a given phase (auto-enables, no gate checks) |

### Agent tools

| Tool | When to use | Effect |
|------|-------------|--------|
| `next_tdd_phase` | Current phase work is complete | Runs allowlist check + gate test, snapshots state, advances phase|
| `previous_tdd_phase` | Previous phase work was wrong | **Discards all current-phase changes**, restores working tree to previous snapshot |
| `tdd_status` | Check current enforcement state | Returns phase, blocked globs, test commands |

---

## How it works

Uses a **private git repository** at `.pi/tdd/.git/` (separate from your project's real git history) to detect locked-file changes, revert invalid modifications, and track state across phase transitions.

```
                 tests fail                  tests pass
     ┌──────┐    (gate check)    ┌────────┐  (gate check)   ┌──────────┐
     │ RED  │ ──────────────────▶│ GREEN  │ ───────────────▶│ REFACTOR │
     │(test)│                    │ (impl) │                 │(cleanup) │
     └──────┘                    └────────┘                 └──────────┘
        ▲                                                        │
        └────────────────────────────────────────────────────────┘
                                tests pass
```

Every phase transition runs two validations before advancing:

1. **Allowlist check** — scans working tree changes against the phase's blocked globs. If any locked file has been modified, the transition is rejected with the violating paths listed
2. **Gate check** — runs `testCommands` in parallel. The required outcome depends on the transition:
   - RED→GREEN: all commands must fail (a passing test suite means there's no failing test to justify moving to GREEN)
   - GREEN→REFACTOR: all commands must pass
   - REFACTOR→RED: all commands must pass

If both checks pass, the working tree is snapshotted and the phase advances.

### File-level enforcement

When TDD is active, every `write`, `edit`, and `bash` tool call is intercepted:

- **`write` / `edit`** — the target file path is checked against the current phase's blocked globs before the tool executes. Locked file writes are blocked with an error message
- **`bash`** — the working tree is stashed before the command runs. After it finishes, the diff is compared against the stash to find what changed. Any locked-file modifications are automatically reverted, and the command output is amended with a warning listing the violations

This means the agent can attempt any change — enforcement happens transparently at the tool layer.

### Rollback mechanics

Each phase transition creates a labeled commit in a private git repository at `.pi/tdd/.git/`. Calling `previous_tdd_phase`:

1. Confirms HEAD is a TDD snapshot (commit message starts with `tdd: {phase}`)
2. Hard-resets the working tree to discard uncommitted changes
3. Soft-resets HEAD~1 to pop the snapshot
4. Sets the phase back

Since TDD owns its own git repo, rollback doesn't touch the project's real git history at all.

### State recovery

If `state.json` is missing or corrupted, the extension recovers by reading the last TDD commit message from `.pi/tdd/.git/`. The label (`tdd: red`, `tdd: green`, etc.) determines the current phase. If no TDD commits exist, it defaults to disabled in RED.

---

## Development

```bash
npm install
npm run check
```

### Project structure

```
tdd-enforcer/
├── engine/                  # Framework-agnostic core
│   ├── types.ts             # Phase, Config, Transition types
│   ├── config.ts            # Load & validate rules.json
│   ├── state.ts             # Load/save/recover phase state
│   ├── enforce.ts           # Glob-based file allowlist checks
│   ├── transition.ts        # Gate checks (test failure/pass per transition)
│   ├── orchestrate.ts       # advancePhase / revertPhase orchestration
│   ├── git.ts               # Private git repo for snapshots & diff
│   ├── log.ts               # Append-only log with line cap
│   └── prompts.ts           # Phase-specific agent nudges
├── adapters/
│   └── pi/                  # pi extension adapter
│       ├── index.ts         # Extension entry: commands (tdd:on/off/status/reset/jump)
│       ├── hooks.ts         # Intercept write/edit/bash tool calls & results
│       └── tools.ts         # Agent tools: next_tdd_phase, previous_tdd_phase, tdd_status
├── skills/
│   └── tdd-enforcer/
│       └── SKILL.md         # Agent instructions for TDD workflows
└── package.json
```

- `engine/` — pure logic, zero pi dependencies. Testable in isolation
- `adapters/pi/` — pi-specific wiring: commands, hooks, agent tools
- `skills/tdd-enforcer/` — agent instructions consumed at runtime

---

## License

[MIT](LICENSE)

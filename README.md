# tdd-enforcer

**Lock files per TDD phase. Gate transitions on test outcomes.**

[![CI](https://github.com/Cyclone1070/tdd-enforcer/actions/workflows/ci.yml/badge.svg)](https://github.com/Cyclone1070/tdd-enforcer/actions/workflows/ci.yml)

[![npm version](https://img.shields.io/npm/v/tdd-enforcer.svg)](https://www.npmjs.com/package/tdd-enforcer)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

<img width="741" height="586" alt="Screenshot 2026-06-26 at 20 52 02" src="https://github.com/user-attachments/assets/4bba490d-ab94-43b1-8c2a-552b34374aee" />

---

## Features

- **Phase-locked file access** — prevents the agent from modifying test files in GREEN and implementation files in RED
- **Guards every tool that can write** — `write` and `edit` are blocked before they run when the path is locked. `bash`, MCP tools, and any other tool get a snapshot-and-revert bracket, so a locked file that a command touches is restored afterwards
- **Background commands included** — a backgrounded `bash` job is diffed and reverted when the job settles, not when the tool returns
- **Automatic transition gates** — advancing to the next phase requires tests to fail (RED→GREEN) or pass (GREEN→RED). Misconfigured or broken transitions are rejected
- **Safe rollback** — if the previous phase's work was wrong, reverting discards all current changes and restores the exact working tree from before that phase
- **Stays out of your way** — TDD enforcement is opt-in. Disable anytime to unlock all files
- **Version-controlled config** — `.tdd/rules.json` lives in your repo alongside the code, so the whole team shares the same rules
- **Two hosts** — the same engine drives the pi coding agent and the DeepSeek Harness (DSH)

TDD state lives in `.tdd/` at the project root. Projects that already have `.pi/tdd/` keep working: that layout is still read, and it stays locked while TDD is active. If both exist, `.tdd/` wins and the plugin warns you to finish the migration.

### Moving a project from `.pi/tdd` to `.tdd`

Each layout keeps its own state and its own private git history, so migrating is a directory move with TDD turned off, then turning it back on:

1. Turn TDD off
2. `mv .pi/tdd .tdd`
3. Turn TDD back on

`rules.json`, `state.json` (enabled flag and phase) and the snapshot history in `.git/` all carry over unchanged. Step 3 takes the snapshot that re-records the state directory in the private repo — until that happens the repo still tracks the old `.pi/tdd` paths, and a rollback would restore them. Creating an empty `.tdd/` instead of moving starts a fresh RED baseline with no history and leaves `.pi/tdd` behind, which is exactly the both-directories warning `tdd_status` reports.

---

## Why Red-Green only?

The **REFACTOR** phase has been left out on purpose.

LLM agents do their best structural work during GREEN. Once the tests pass, refactor phase is often treated as a formality and is usually skipped. The gate can only verify that tests pass, so it cannot verify that refactoring actually happened. A phase nothing can enforce degenerates into ceremony, and the cycle becomes RED→GREEN→RED with extra steps. With poor context or small models REFACTOR phase is also used as a TDD bypass tool since it doesn't enforce any file lock.

Removing it keeps the loop honest:

- RED locks implementation files, GREEN locks test files. Both phases have hard, testable rules
- Every transition has a real gate — tests must fail to enter GREEN, and pass to leave it
- Cycles stay small, so `previous_tdd_phase` is cheap when assumptions turn out wrong

### Refactor deliberately, not automatically

Structure changes are best done as a separate, conscious pass over a green suite — once in a while, not after every cycle:

1. Finish a cycle or a feature with the tests passing
2. Turn TDD off (`/tdd-off` in DSH, `/tdd:off` in pi) to unlock all files
3. Ask for a focused refactor pass — tests stay green, behaviour unchanged — or do it yourself
4. Turn TDD back on when you are ready to continue

The test suite is the safety net; the decision to refactor is yours.

---

## Setup

### 1. Install

For the pi coding agent:

```bash
pi install npm:tdd-enforcer
```

For the DeepSeek Harness, add the package to the profile — the Plugins page in the web UI, or from a terminal:

```bash
npm run build                                  # bundles dist/dsh from the checkout
dsh plugin --profile web add /path/to/tdd-enforcer
```

Installing through the agent's `plugin_manager` tool (`action: install_bundle`, `target: <package path>`) does the same thing.

The harness loads the prebuilt bundle (`dist/dsh/plugin.js`), so build before installing. **Restart DSH after installing or after rebuilding**: Node caches package resolution and imported modules per process, so a running host keeps serving the previous copy of the plugin.

### 2. Ask the agent to set up TDD

Tell the agent to configure TDD for your project, using the `tdd-enforcer` skill to create `.tdd/rules.json` with the right file globs and test commands for your stack.

### 3. Enable TDD

Once configured, run:

```
/tdd-on          # DSH
/tdd:on          # pi
```

### Config reference

`.tdd/rules.json` fields (created by the agent, not manually):

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

pi registers them with a colon, DSH forbids that character in command names, so both spellings are shown.

| Command (DSH / pi) | Description |
|---------|-------------|
| `/tdd-on` `/tdd:on` | Enable TDD enforcement |
| `/tdd-off` `/tdd:off` | Disable TDD enforcement, all files become free |
| `/tdd-status` `/tdd:status` | Show phase, blocked globs, test commands |
| `/tdd-reset` `/tdd:reset` | **Destructive**: nukes all snapshot history, resets to RED (disabled) |
| `/tdd-red` `/tdd-green` `/tdd:red` `/tdd:green` | Skip to a given phase (auto-enables, no gate checks) |

### Agent tools

| Tool | When to use | Effect |
|------|-------------|--------|
| `next_tdd_phase` | Current phase work is complete | Runs allowlist check + gate test, snapshots state, advances phase|
| `previous_tdd_phase` | Previous phase work was wrong | **Discards all current-phase changes**, restores working tree to previous snapshot |
| `tdd_status` | Check current enforcement state | Returns phase, blocked globs, test commands |

---

## How it works

Uses a **private git repository** at `.tdd/.git/` (separate from your project's real git history) to detect locked-file changes, revert invalid modifications, and track state across phase transitions.

```
                tests fail                  tests pass
     ┌──────┐   (gate check)    ┌────────┐  (gate check)
     │ RED  │ ─────────────────▶│ GREEN  │ ───────────────┐
     │(test)│                   │ (impl) │                │
     └──────┘                   └────────┘                │
        ▲                                                 │
        └─────────────────────────────────────────────────┘
                         new cycle
```

Every phase transition runs two validations before advancing:

1. **Allowlist check** — scans working tree changes against the phase's blocked globs. If any locked file has been modified, the transition is rejected with the violating paths listed
2. **Gate check** — runs `testCommands` in parallel. The required outcome depends on the transition:
   - RED→GREEN: all commands must fail (a passing test suite means there's no failing test to justify moving to GREEN)
   - GREEN→RED: all commands must pass

If both checks pass, the working tree is snapshotted and the phase advances.

### File-level enforcement

The two hosts expose different interception points, and each adapter uses the strongest one available.

**pi** hooks `tool_call` / `tool_result` for `write`, `edit`, and `bash`:

- **`write` / `edit`** — the target path is checked against the current phase's blocked globs before the tool executes. Locked writes are rejected with an error message
- **`bash`** — the working tree is snapshotted before the command runs. After it finishes, the diff is compared against the snapshot. Locked-file modifications are reverted and the command output is amended with a warning listing them

**DSH** splits the same idea across the tool pipeline:

- **`write` / `edit`** — a synchronous tool guard denies a locked path before the tool body runs. Guards are monotonic: no later listener can turn a denial back into permission
- **`bash`, MCP tools, and unknown tools** — a snapshot is taken before the call and diffed after it. A locked file that changed and existed before the call is restored to its pre-call content; a locked file the call created is removed. Everything the phase allows is kept. The call comes back as an error listing reverted files, retained changes, and the original tool output
- **background `bash`** — the snapshot is handed to the job id and settled by a `ctx.jobs` subscription. Since the tool already returned, the revert is reported as a notice on a later tool result
- **read-only tools** — skipped entirely, so they add no overhead

In both hosts the revert is path-scoped by the phase rules: only changed-and-locked files are touched, so concurrent changes are never clobbered.

Boundaries worth knowing: the snapshot covers the project directory only, so writes outside the repo are not reverted, and a file written by an MCP server's own separate process cannot be attributed to the call. `testCommands` are executed by the plugin in the project root, not through the host's sandbox.

### Rollback mechanics

Each phase transition creates a labeled commit in a private git repository at `.tdd/.git/`. Calling `previous_tdd_phase`:

1. Confirms HEAD is a TDD snapshot (commit message carries a valid phase label)
2. Hard-resets the working tree to discard uncommitted changes
3. Soft-resets HEAD~1 to pop the snapshot
4. Sets the phase back

If HEAD is not a TDD snapshot, the private repo is nuked and rebuilt with a clean RED baseline instead.

Since TDD owns its own git repo, rollback doesn't touch the project's real git history at all.

### State recovery

`state.json` is read leniently: missing files, malformed JSON, and unknown phase values never crash the extension. A valid `state.json` phase wins; otherwise the phase is recovered from the last TDD commit message in the private repo (`.tdd/.git/`, or `.pi/tdd/.git/` for the legacy layout) (`tdd: red`, `tdd: green`). A root commit with no parent is treated as a fresh baseline in RED (disabled).

If the private git repo itself is unusable — git commands throw, or HEAD is not a TDD snapshot — the history is treated as corrupt: the private repo is nuked and re-initialised with a clean RED baseline. `previous_tdd_phase` follows the same rule, so a corrupt history resets instead of failing.

---

## Development

```bash
npm install
npm run check     # biome + vitest
npm run build     # bundle the DSH plugin into dist/dsh
```

### Project structure

```
tdd-enforcer/
├── engine/                  # Framework-agnostic core
│   ├── types.ts             # Phase, Config, Transition types
│   ├── paths.ts             # .tdd layout + .pi/tdd fallback resolution
│   ├── config.ts            # Load & validate rules.json
│   ├── state.ts             # Load/save/recover phase state
│   ├── enforce.ts           # Glob-based file allowlist checks
│   ├── transition.ts        # Gate checks (test failure/pass per transition)
│   ├── orchestrate.ts       # advancePhase / revertPhase orchestration
│   ├── git.ts               # Private git repo for snapshots & diff
│   ├── log.ts               # Append-only log with line cap
│   └── prompts.ts           # Phase-specific agent nudges
├── adapters/
│   ├── shared/
│   │   └── actions.ts       # next/previous phase + status, host-neutral
│   ├── pi/                  # pi extension adapter
│   │   ├── index.ts         # Extension entry: commands (tdd:on/off/status/reset/jump)
│   │   ├── hooks.ts         # Intercept write/edit/bash tool calls & results
│   │   └── tools.ts         # Agent tools: next_tdd_phase, previous_tdd_phase, tdd_status
│   └── dsh/                 # DSH host plugin adapter
│       ├── index.ts         # apply(): guard, tool pipeline listeners, registrations
│       ├── enforcement.ts   # Tool guard + snapshot-and-revert bracket (+ background jobs)
│       ├── commands.ts      # tdd-on/off/status/reset/red/green
│       ├── tools.ts         # The same three agent tools
│       ├── skill.ts         # Registers the shipped SKILL.md at runtime
│       └── types.ts         # Minimal structural types for the host surface
├── skills/
│   └── tdd-enforcer/
│       └── SKILL.md         # Agent instructions for TDD workflows
├── scripts/
│   └── build-dsh.mjs        # Bundles adapters/dsh into dist/dsh
├── cordis.patch.yml         # DSH bundle manifest (inserts the plugin row)
└── package.json
```

- `engine/` — pure logic, zero host dependencies. Testable in isolation
- `adapters/shared/` — phase actions both adapters call, so host wiring stays thin
- `adapters/pi/` — pi-specific wiring: commands, hooks, agent tools
- `adapters/dsh/` — DSH-specific wiring: tool guard, tool pipeline listeners, commands, tools
- `skills/tdd-enforcer/` — agent instructions; DSH registers this file itself, so nothing is copied into your project

---

## License

[MIT](LICENSE)

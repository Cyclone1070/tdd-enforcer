# TDD Enforcer — pi Extension Design

## Concept

A pi extension that enforces the Red-Green-Refactor TDD cycle by:
- Tracking current phase (RED / GREEN / REFACTOR)
- Restricting which files the agent can modify per phase
- Running tests on phase transitions to enforce red/green gate
- Nudging the agent with phase-appropriate prompts

## Tools

### `next_tdd_phase`

Advances the cycle:

```
RED ──(tests fail)──► GREEN ──(tests pass)──► REFACTOR ──(tests pass)──► RED
```

### `previous_tdd_phase`

Reverts to the previous snapshot by parsing the phase label from the last git snapshot commit. Restores working tree to exact prior state. No gate checks — just revert. Must have clear warning in the tool schema that this will revert all changes in the current state.

---

## Phase Rules

| Phase | `allowedRedPhaseFiles` | `allowedGreenPhaseFiles` | Everything else |
|-------|----------------------|------------------------|-----------------|
| RED | ✅ Allowed | ❌ Locked | ✅ Free |
| GREEN | ❌ Locked | ✅ Allowed | ✅ Free |
| REFACTOR | ✅ Allowed | ✅ Allowed | ✅ Free |

### Transition Gates

- **RED → GREEN**: Tests must **fail**. If tests pass, tool returns error — agent must break a test first.
- **GREEN → REFACTOR**: Tests must **pass** (all exit codes zero).
- **REFACTOR → RED**: Tests must **pass** (all exit codes zero).

### Nudging Prompts

Each successful transition returns a message guiding the agent:

- **→ RED**: *"You are now in **RED** phase. Write failing tests matching `allowedRedPhaseFiles` patterns. Only these files can be modified. Once tests fail, call `next_tdd_phase` to proceed to GREEN."* (list matched files)
- **→ GREEN**: *"You are now in **GREEN** phase. Files matching `allowedRedPhaseFiles` are locked. Implement features in `allowedGreenPhaseFiles` to make tests pass. Call `next_tdd_phase` to proceed to REFACTOR."*
- **→ REFACTOR**: *"You are now in **REFACTOR** phase. Both `allowedRedPhaseFiles` and `allowedGreenPhaseFiles` are free to modify. Refactor without changing behavior. Call `next_tdd_phase` to start a new RED cycle."*

---

## File Enforcement: Private Git + `tool_call` Fast-Feedback

### Source of truth: private git repo

A separate git repository at `.pi/tdd/.git/` that tracks the project root as its working tree. The user's `.git/` is never touched.

```
.pi/tdd/
├── .gitignore           # private git — excludes file patterns from snapshots
├── state.json           # {current: "red", enabled: true}
├── rules.json           # user config
└── .git/                # private git — init with --git-dir
```

**Setup:** `git init` with `--git-dir=.pi/tdd/.git --work-tree=<project-root>`.

**On phase entry (snapshot):**
`git add -A && git commit -m "tdd: <phase> <ts>"` — captures entire working tree state.

**On `next_tdd_phase` / `previous_tdd_phase` (allowlist check):**
- `git diff --name-only HEAD` against previous snapshot commit
- Cross-reference each changed file against phase allowlist
- Violations → BLOCK with list of disallowed files
- Also check for untracked files (`git ls-files --others --exclude-standard`)

**On `previous_tdd_phase` (revert):**
- `git restore --source=<prev-commit> --worktree -- .` — restores project to exact prior snapshot
- Pop the last snapshot commit in the private git repo

### Benefits of private git

- Catches ALL modifications — write, edit, bash, sed, python, C, anything — because it diffs the working tree, not tool calls
- Cross-platform (git is everywhere)
- No shell parsing, no fragile regexes, no edge cases
- Zero interference with user's git — different `.git/`, no shared refs, no hooks, no global config
- `.pi/tdd/` is disposable — user can nuke it anytime
- Free diff, merge, partial restore, binary handling — no custom engine to write

### Fast feedback: per-tool enforcement

The transition-time check catches everything, but it's wasteful to let the agent work on wrong files for a full phase. We enforce per-tool:

#### `write` / `edit` — pre-execution block

The file path is a direct parameter. In `tool_call`:
- If path is disallowed in current phase → `{ block: true, reason: "..." }`
- Otherwise → allow

#### `bash` — post-execution detect-and-revert

Bash can modify files indirectly (redirects, `sed -i`, scripts, compilers). Parsing command strings to predict targets is fragile. Instead:

1. **Let bash run** — no pre-check
2. **In `tool_result`:** `git diff --name-only HEAD` + `git ls-files --others --exclude-standard` to get all changes since phase snapshot
3. For each file: if it's disallowed in current phase → `git restore <filepath>` and append warning

No in-memory tracking needed. The check is the same for every file regardless of how it was modified — write/edit changes that passed pre-check naturally match the allowed globs, violations get reverted.

#### Why not regex bash parsing?

Everyone else does it (pi-proof, pi-superteam, tdd-guard). It's fragile — misses `$(dynamic paths)`, glob expansion, scripts calling other scripts, piped commands, heredocs with variables. Our git-based post-check catches everything regex misses, with zero false negatives.

Regex pre-check is optional (could catch obvious cases for better UX) but the git post-check is the reliable enforcer.

---

### `.gitignore`

The private git's work-tree is the project root, so it respects the project's `.gitignore` automatically — no copy needed, no separate file needed.

If the user wants to exclude additional files from TDD snapshots only, they can create `.pi/tdd/.gitignore` with those patterns. Git checks `.gitignore` starting from the work-tree root, so a file there is picked up naturally.

---

## Config: `.pi/tdd/rules.json`

```json
{
  "allowedRedPhaseFiles": ["tests/**/*.test.ts", "specs/**/*.spec.ts"],
  "allowedGreenPhaseFiles": ["src/**/*.ts"],
  "testCommands": ["npm run test:unit", "npm run test:integration"],
  "timeoutSeconds": 120
}
```

- `allowedRedPhaseFiles`: Glob patterns for files allowed in RED phase (typically test files).
- `allowedGreenPhaseFiles`: Glob patterns for files allowed in GREEN phase (typically implementation files).
- Files matching neither set are free in all phases.
- `testCommands`: `string` (shell-chained with `&&` for sequential) or `string[]` (run in parallel). Must be non-interactive.
- `timeoutSeconds`: Per-command timeout. Extension passes it as pi's `bash` tool timeout param, so we don't rely on system `timeout` binary.

---



---

## Phase State Persistence

Stored in `.pi/tdd/state.json`:

```json
{
  "current": "green",
  "enabled": true
}
```

The snapshot history lives in the private git repo's commit log — no explicit stack array needed. `previous_tdd_phase` reads the phase label from the HEAD commit message and restores to the parent. Survives session restarts and extension reloads.

---

## Open Questions

### Initial state

How does a project start?

- **Auto RED**: Start in RED unconditionally. If tests already pass, agent sees a warning that there's no failing test yet — it needs to write one or break one.
- **Auto-detect**: Run tests on startup. If failing → RED. If passing → GREEN (agent is already in the "make it pass" phase).
- **Prompt**: Ask the user what phase to start in.

### Enabling/disabling

Should we have `/tdd:on` and `/tdd:off` commands to toggle without unloading the extension?

### Config location

Only `.pi/tdd/rules.json` in project root? Or support nested configs?

### Multiple projects / monorepos

If the project root has sub-projects with different test commands, does rules.json support multiple entries keyed by directory?

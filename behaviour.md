# TDD Enforcer — Behaviour Spec

## Entry Gate — `loadTddState(root)` (all surfaces)

Every surface (commands, hooks, tools) hits this first:

```
loadTddState(root):
   │
   ├── .pi/tdd/ exists?       NO → "Missing .pi/tdd/. See the tdd-enforcer skill."
   │
   ├── rules.json exists?     NO → "Missing .pi/tdd/rules.json. See the tdd-enforcer skill."
   │
   ├── rules.json valid?      NO → "Invalid .pi/tdd/rules.json. See the tdd-enforcer skill."
   │
   ├── .pi/tdd/.git/ exists?  NO → initGit(root)
   │                              FAIL → "Failed to initialise private git repo."
   │
   ├── state.json exists?     NO → recoverState()
   │   │
   │   └── recoverState():
   │       ├── .git exists? + headMessage readable?
   │       │   ├── "tdd: init"        → { enabled: false, current: "red" }
   │       │   ├── "tdd: red"         → { enabled: true,  current: "green" }
   │       │   ├── "tdd: green"       → { enabled: true,  current: "refactor" }
   │       │   ├── "tdd: refactor"    → { enabled: true,  current: "red" }
   │       │   └── no match / error   → { enabled: false, current: "red" }
   │       └── no .git / no commits   → { enabled: false, current: "red" }
   │
   ├── state.json valid?       NO → recoverState() (same as above)
   │
   └── return { ok: true, state, config }
```

After this gate, every surface has `state` + `config`. Then branches on `state.enabled`.

---

## Commands (user only)

| Command | Gate check | After gate |
|---------|-----------|------------|
| `tdd:on` | Setup valid? | If `enabled` → error "already on". Init git (if missing), snapshot, set `enabled: true`. |
| `tdd:off` | Setup valid? | If `disabled` → error "already off". Set `enabled: false`. |
| `tdd:status` | Setup valid? | Show state + config regardless of `enabled`. |
| `tdd:reset` | Setup valid? | Nuke private git, re-init, snapshot, set `enabled: false`. |
| `tdd:red` / `tdd:green` / `tdd:refactor` | Setup valid? | If `disabled` → error "not enabled". Set `current` to target phase. |

All errors reference the tdd-enforcer skill.

---

## Hooks (agent — automatic)

| Hook | Gate + enabled | Behaviour |
|------|---------------|-----------|
| `tool_call` (write/edit) | Setup broken → pass through. Disabled → pass through. **Enabled** → block if `relPath` starts with `.pi/tdd/` OR phase-locked. | |
| `tool_result` (bash) | Setup broken → pass through. Disabled → pass through. **Enabled** → revert if path starts with `.pi/tdd/` OR phase-locked. RETOOL revert paths to `.pi/tdd/` prefix check. | |

---

## Tools (agent — callable)

| Tool | Gate + enabled | Behaviour |
|------|---------------|-----------|
| `next_tdd_phase` | Disabled → error. Enabled → run gate + snapshot + transition. | |
| `previous_tdd_phase` | Disabled → error. Enabled → revert to previous snapshot. | |
| `tdd_status` | Disabled → error. Enabled → show state + config. | |

---

## Flow Diagrams

### Initial Setup Flow

```
User creates .pi/tdd/rules.json
       │
       ▼
User runs /tdd:on
       │
       ▼
Gate: .pi/tdd/ exists? ──NO──► error (agent creates it)
       │
      YES
       │
       ▼
Gate: rules.json exists? ──NO──► error (agent creates it)
       │
      YES
       │
       ▼
Gate: rules.json valid? ──NO──► error (agent fixes it)
       │
      YES
       │
       ▼
Gate: state.json exists? ──NO──► auto-create
       │
      YES/auto-created
       │
       ▼
Init git (if missing) ──► snapshot ──► enabled: true
       │
       ▼
TDD active — RED phase, enforcement on
```

### Phase Cycle Flow

```
RED: write tests
  │  tests fail? ──NO──► "Tests passed. Add a failing test before transitioning."
  │ YES
  ├─► next_tdd_phase ──► GREEN
  │
GREEN: implement features
  │  tests pass? ──NO──► "Tests failed. Fix them before transitioning."
  │ YES
  ├─► next_tdd_phase ──► REFACTOR
  │
REFACTOR: refactor freely
  │  tests pass? ──NO──► "Tests failed. Fix them before transitioning."
  │ YES
  ├─► next_tdd_phase ──► RED (new cycle)
```

### Bash Enforcement Flow

```
Agent runs bash command
       │
       ▼
tool_call hook: stash pre-command state
       │
       ▼
Bash executes (modifies files)
       │
       ▼
tool_result hook: diff against stash
       │
       ▼
For each changed file:
  ├── path starts with ".pi/tdd/"? ──YES──► revert, flag as violation
  ├── locked in current phase? ──YES──► revert, flag as violation
  └── no violations ──► keep changes
       │
       ▼
Return warning listing reverted vs retained files
```

---

## Protection Summary

| Surface | `.pi/tdd/` locked? | Phase-locked files? |
|---------|-------------------|-------------------|
| write/edit (TDD enabled) | ✅ Block | ✅ Block |
| write/edit (TDD disabled) | ❌ Free | ❌ Free |
| bash (TDD enabled) | ✅ Reverted | ✅ Reverted |
| bash (TDD disabled) | ❌ Free | ❌ Free |

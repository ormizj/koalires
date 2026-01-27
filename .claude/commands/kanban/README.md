# Kanban

Task management system for breaking down features into agent-delegated work.

## Quick Start

```bash
/kanban:init              # One-time setup (auto-runs verify-tests)
/kanban:init:verify-tests # Verify/setup test infrastructure
/kanban:create <feature>  # Create board from feature description
/kanban:process           # Execute tasks with parallel workers
npm run kanban            # Open viewer

# Reference docs
/kanban:SCHEMA            # Strict schema definitions for all data files
/kanban:ANTHROPIC_REFERENCE  # Design principles from Anthropic research
```

## Commands

### `/kanban:init`

One-time setup. Creates `.kanban/` directory, copies viewer HTML, adds npm script. Automatically runs `/kanban:init:verify-tests` to ensure test infrastructure is ready for TDD workflow.

### `/kanban:init:verify-tests`

Verifies and sets up testing infrastructure for the kanban TDD workflow. Can be run independently or is auto-invoked by `/kanban:init`.

**Phases:**

1. **Detect** - Scans for existing test framework (Vitest, Jest, pytest, etc.)
2. **Validate** - Checks config, dependencies, test command works
3. **Setup** - If missing, recommends and installs appropriate framework based on project type

**Framework Detection:**

| Project Type  | Detection                          | Recommended Framework |
| ------------- | ---------------------------------- | --------------------- |
| Nuxt/Vue+Vite | `nuxt.config.*` or `vite.config.*` | Vitest                |
| React (CRA)   | `react-scripts` in package.json    | Jest                  |
| Node/Express  | `express` in deps                  | Vitest or Jest        |
| Python        | `manage.py` or `fastapi`           | pytest                |
| Go            | `go.mod`                           | go test (built-in)    |

### `/kanban:create <feature>`

Breaks a feature description into categorized tasks. Auto-detects project type and generates `kanban-board.json`.

**Example:**

```bash
/kanban:create Add user profile page with avatar upload and settings
```

### `/kanban:process`

Dispatches tasks to parallel `claude -p` workers in dependency waves:

1. Groups tasks by category into waves (data/config → api → integration → ui → testing)
2. Spawns up to N workers per wave (default: 3)
3. Workers create output files, dispatcher updates kanban files
4. On failure, prompts: retry/skip/stop

**Flags:**

- `-Parallel N` - Max concurrent workers (default: 3)
- `-DryRun` - Preview without executing

## Files

| File                           | Purpose                                         |
| ------------------------------ | ----------------------------------------------- |
| `.kanban/kanban-board.json`    | Task definitions                                |
| `.kanban/kanban-progress.json` | Progress tracking (log, affected files, agents) |
| `.kanban/kanban-viewer.html`   | Interactive board UI                            |
| `.kanban/workers/`             | Worker status files (parallel dispatch)         |
| `.kanban/worker-logs/`         | Worker output logs                              |

For strict schema definitions of all data files, see [SCHEMA.md](./SCHEMA.md).

## Task Categories

| Category      | Agent              | Purpose                  |
| ------------- | ------------------ | ------------------------ |
| `data`        | backend-developer  | Database schemas, models |
| `api`         | backend-developer  | Endpoints, services      |
| `ui`          | vue-expert         | Components, styling      |
| `integration` | backend-developer  | Connecting services      |
| `config`      | backend-developer  | Configuration, env setup |
| `testing`     | kanban-unit-tester | Test cases (TDD)         |

## Status Flow

```
pending → in-progress → code-review → completed
              ↓
           blocked (if dependencies not met)
```

- **pending** - Not started
- **blocked** - Cannot proceed due to unmet dependencies
- **in-progress** - Agent working on task
- **code-review** - Verification passed, awaiting commit approval
- **completed** - Committed to git

## Viewer

Run `npm run kanban` to open the interactive viewer at `http://localhost:4150/.kanban/kanban-viewer.html`.

Features:

- Real-time updates (1s refresh)
- 5-column board (Pending | Blocked | In Progress | Code Review | Completed)
- Expandable task cards with description, steps, affected files
- Progress bar and statistics

## Design Principles

Based on Anthropic's research on effective harnesses for long-running agents. See [ANTHROPIC_REFERENCE.md](./ANTHROPIC_REFERENCE.md) for full article.

Key patterns implemented:

- **Progress file** - `kanban-progress.json` maintains a log of work done, enabling agents to understand state across context windows
- **Incremental commits** - Each task results in a git commit, leaving codebase in a clean state
- **Feature decomposition** - Complex features broken into discrete, verifiable tasks
- **Human-in-the-loop** - User confirmation before starting tasks and approving commits
- **Verification steps** - Each task has explicit QA steps before marking complete
- **Affected files tracking** - Changes documented for review and potential rollback

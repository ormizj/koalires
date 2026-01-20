# Kanban

Task management system for breaking down features into agent-delegated work.

## Quick Start

```bash
/kanban:init              # One-time setup
/kanban:create <feature>  # Create board from feature description
/kanban:process           # Execute tasks with parallel workers
/kanban:code-review       # Review and commit completed tasks
npm run kanban            # Open viewer
```

## Commands

### `/kanban:init`

One-time setup. Creates `.kanban/` directory, copies viewer HTML, adds npm script.

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
3. Workers self-update kanban files on completion
4. On failure, prompts: retry/skip/stop

**Flags:**
- `-Parallel N` - Max concurrent workers (default: 3)
- `-DryRun` - Preview without executing

### `/kanban:code-review`

Reviews completed tasks and creates git commits:

1. Shows task summary (name, description, affected files, agents)
2. Displays git diff for changed files
3. Prompts user: approve/reject/skip/stop
4. Creates individual commits for approved tasks
5. Rejected tasks return to pending for re-work

**Flags:**
- `--batch` - Auto-approve all tasks without prompts

## Files

| File                           | Purpose                                         |
|--------------------------------|-------------------------------------------------|
| `.kanban/kanban-board.json`    | Task definitions                                |
| `.kanban/kanban-progress.json` | Progress tracking (log, affected files, agents) |
| `.kanban/kanban-viewer.html`   | Interactive board UI                            |
| `.kanban/workers/`             | Worker status files (parallel dispatch)         |
| `.kanban/logs/`                | Worker output logs                              |

## Task Categories

| Category      | Agent             | Purpose                  |
|---------------|-------------------|--------------------------|
| `data`        | backend-developer | Database schemas, models |
| `api`         | backend-developer | Endpoints, services      |
| `ui`          | vue-expert        | Components, styling      |
| `integration` | backend-developer | Connecting services      |
| `config`      | backend-developer | Configuration, env setup |
| `testing`     | backend-developer | Test cases               |

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

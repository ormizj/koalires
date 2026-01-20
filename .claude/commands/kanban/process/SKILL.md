---
name: kanban:process
description: Process kanban-board.json by dispatching tasks to parallel claude -p workers. Tasks execute in dependency waves. Use after kanban:create to execute planned work.
allowed-tools: Bash, Read, Write
---

# Process Kanban Skill

Process the kanban board by dispatching tasks to parallel `claude -p` worker processes. Workers execute independently and self-update kanban files on completion.

## Overview

This skill orchestrates parallel task execution using a wave-based system:

1. Tasks are grouped into waves by category dependencies
2. Each wave runs up to N tasks in parallel via `claude -p` workers
3. Workers self-update `kanban-progress.json` with status tracking
4. The dispatcher monitors progress.json entries and reports results
5. Failed tasks can be retried, skipped, or halt execution

## Prerequisites

- `.kanban/kanban-board.json` must exist (created by `kanban:create`)
- `.kanban/kanban-progress.json` must exist (created by `kanban:create`)
- `claude` CLI must be available in PATH

## File Locations

All kanban files are in the `.kanban/` directory:

| Path                           | Purpose                                            |
| ------------------------------ | -------------------------------------------------- |
| `.kanban/kanban-board.json`    | Task definitions with passes field                 |
| `.kanban/kanban-progress.json` | Status tracking, work logs, affected files, agents |
| `.kanban/logs/`                | Worker output logs (created by dispatcher)         |

## Task Status Logic

Task status is derived from the `passes` field (kanban-board.json) and `status` field (kanban-progress.json):

| passes  | progress.json status | Derived Status  |
| ------- | -------------------- | --------------- |
| `false` | (no entry)           | **pending**     |
| `false` | `running`            | **in-progress** |
| `false` | `completed` / `error`| **in-progress** |
| `false` | `blocked`            | **blocked**     |
| `true`  | NOT `completed`      | **code-review** |
| `true`  | `completed`          | **completed**   |
| `true`  | (no entry)           | **completed**   |

## Wave System

Tasks are processed in waves based on category dependencies:

| Wave | Categories   | Depends On |
| ---- | ------------ | ---------- |
| 1    | data, config | None       |
| 2    | api          | Wave 1     |
| 3    | integration  | Wave 2     |
| 4    | ui           | Wave 3     |
| 5    | testing      | Wave 4     |

Each wave completes before the next begins, ensuring dependent tasks have their prerequisites ready.

## Agent Mapping

Workers are assigned agents based on task category:

| Category    | Agent             |
| ----------- | ----------------- |
| data        | backend-developer |
| config      | backend-developer |
| api         | backend-developer |
| integration | backend-developer |
| ui          | vue-expert        |
| testing     | backend-developer |

---

## Workflow

### Phase 1: Initialization

Read and validate kanban files, then display progress summary.

```
Read: .kanban/kanban-board.json
Read: .kanban/kanban-progress.json
```

Calculate status for each task and display:

```
KANBAN PROGRESS
---------------
Total Tasks: X
Pending: X
In Progress: X
Code Review: X
Completed: X
```

If no pending tasks remain:

- If code-review tasks exist, direct user to run `kanban:code-review`
- Otherwise, report completion

### Phase 2: Dispatch

Run the PowerShell dispatcher script:

```bash
powershell -ExecutionPolicy Bypass -File ".claude/commands/kanban/process/scripts/parallel-dispatch.ps1"
```

**Optional Parameters**:

| Parameter     | Description                           | Default |
| ------------- | ------------------------------------- | ------- |
| `-Parallel N` | Maximum concurrent workers            | 3       |
| `-DryRun`     | Show what would run without executing | false   |

**Examples**:

```bash
# Default: 3 parallel workers
powershell -ExecutionPolicy Bypass -File ".claude/commands/kanban/process/scripts/parallel-dispatch.ps1"

# Run 5 tasks at once
powershell -ExecutionPolicy Bypass -File ".claude/commands/kanban/process/scripts/parallel-dispatch.ps1" -Parallel 5

# Preview without executing
powershell -ExecutionPolicy Bypass -File ".claude/commands/kanban/process/scripts/parallel-dispatch.ps1" -DryRun
```

### Phase 3: Monitor and Handle Failures

The dispatcher script handles monitoring automatically:

1. Displays live progress as workers complete
2. Shows pass/fail status for each task
3. On failure, prompts user:
   - **[R]etry** - Retry failed tasks
   - **[S]kip** - Skip and continue to next wave
   - **[Q]uit** - Stop all processing

### Phase 4: Completion

When all waves complete, the dispatcher shows final summary:

```
============================================
EXECUTION COMPLETE
============================================
Total Passed:  X
Total Failed:  X

Run 'kanban:code-review' to review and commit completed tasks.
```

---

## Worker Details

Each worker is a `claude -p` process that:

1. Receives a task prompt with full context
2. **Immediately** marks task as "running" in progress.json
3. Implements the task following project patterns
4. Runs verification steps
5. Updates kanban files on completion:
   - Updates progress.json with `status: "completed"`, log, affected files
   - Sets `passes: true` in kanban-board.json (if verification passes)

**Worker Prompt Template**: `.claude/commands/kanban/process/prompts/worker-task.md`

### Progress Entry Schema

Workers update `kanban-progress.json` entries. The dispatcher monitors these for status:

**Initial Entry** (written immediately when work starts):

```json
{
  "task-name": {
    "status": "running",
    "startedAt": "2026-01-19T12:00:00.000Z",
    "agents": ["backend-developer"]
  }
}
```

**Final Entry** (written when work completes):

```json
{
  "task-name": {
    "status": "completed",
    "startedAt": "2026-01-19T12:00:00.000Z",
    "completedAt": "2026-01-19T12:15:00.000Z",
    "log": "## Work Summary\n\nBrief description...",
    "affectedFiles": ["path/to/file1.ts", "path/to/file2.ts"],
    "agents": ["backend-developer"]
  }
}
```

**Status Values**:

- `running` - Task in progress (set at start)
- `completed` - All verification steps passed
- `error` - Execution error occurred (include details in log)

---

## Error Handling

### Worker Failure

When a worker reports failure or error:

1. Progress entry contains `status: "error"` with details in log field
2. Full output available in `.kanban/logs/{task-name}.log`
3. User prompted for action (retry/skip/quit)
4. Task remains in pending state until successfully completed

### No Progress Entry

If a worker completes without updating progress.json:

1. Dispatcher reports task as failed with "No progress entry created"
2. Check the log file for worker output
3. Task may need manual investigation

### Script Execution Errors

If the PowerShell script fails to start:

1. Verify PowerShell is available (Windows has it built-in)
2. Check script permissions
3. Run with `-DryRun` to validate setup

---

## Resume Capability

This skill supports resuming interrupted sessions:

1. **Pending tasks**: No progress entry, will be processed
2. **In-progress tasks**: Have `status: "running"` entry, treated as pending for retry
3. **Code-review tasks**: Passed (`passes: true`) but `status != "completed"`, skip processing
4. **Completed tasks**: Have `passes: true` AND `status: "completed"`, skip entirely

The dispatcher automatically determines which tasks need processing based on current state.

---

## Execution Summary

1. **Read** kanban files and calculate task statuses
2. **Display** progress summary to user
3. **Run** `parallel-dispatch.ps1` script with optional parameters
4. **Monitor** worker completion via progress.json entries
5. **Handle** failures with retry/skip/quit options
6. **Report** final summary when all waves complete
7. **Direct** user to `kanban:code-review` for commits

---

## Notes

- Code review and git commits are handled by the separate `kanban:code-review` skill
- Workers operate independently and may run concurrently
- Each worker has full access to project files and CLAUDE.md context
- Worker logs are preserved in `.kanban/logs/` for debugging
- **Workers run with `--dangerously-skip-permissions`** to enable autonomous execution without permission prompts
- `kanban-progress.json` is the single source of truth for worker status tracking

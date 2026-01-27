---
name: kanban:process
description: Process kanban-board.json by dispatching tasks to parallel claude -p workers. Tasks execute in dependency waves. Use after kanban:create to execute planned work.
allowed-tools: Bash, Read, Write
---

# Process Kanban Skill

Process the kanban board by dispatching tasks to parallel `claude -p` worker processes. The dispatcher parses raw worker logs to extract results, ensuring consistent tracking regardless of worker behavior.

## Overview

This skill orchestrates parallel task execution using a wave-based system:

1. Tasks are grouped into waves by category dependencies
2. Each wave runs up to N tasks in parallel via `claude -p` workers
3. Dispatcher marks tasks "running" before spawning workers
4. Workers implement tasks and output verification results in text
5. **Dispatcher parses raw worker logs** to create output files
6. Dispatcher updates `kanban-progress.json` and `kanban-board.json`
7. Failed tasks can be retried, skipped, or halt execution

## Architecture

### Data Flow (Dispatcher-Owned Output)

```
Worker executes task
    ↓
Raw session log written to .kanban/worker-logs/{task}.json
    ↓
parse-worker-log.ps1 extracts:
  - Affected files (from Write/Edit tool calls)
  - Token usage (from message.usage fields)
  - Verification results (from text patterns)
  - Success/failure status (from result entry)
    ↓
Creates .kanban/worker-logs/{task}-output.json (normalized format)
    ↓
process-worker-output.ps1 updates:
  - kanban-progress.json (work log, files, tokens)
  - kanban-board.json (passes: true if verification passed)
```

### Why Dispatcher Owns Output Files

Previous approach had workers create output files, but AI workers are unpredictable:

- Used wrong field names (`status: "passed"` vs `passed: true`)
- Inconsistent file path formats
- Fabricated timestamps
- Missed tracking files

New approach: Dispatcher parses the raw session log as the single source of truth.

## Prerequisites

- `.kanban/kanban-board.json` must exist (created by `kanban:create`)
- `.kanban/kanban-progress.json` must exist (created by `kanban:create`)
- `claude` CLI must be available in PATH

## File Locations

All kanban files are in the `.kanban/` directory:

| Path                                     | Purpose                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `.kanban/kanban-board.json`              | Task definitions with passes field                 |
| `.kanban/kanban-progress.json`           | Status tracking, work logs, affected files, agents |
| `.kanban/worker-logs/`                   | Worker output logs                                 |
| `.kanban/worker-logs/{task}.json`        | Raw worker session log (JSON format)               |
| `.kanban/worker-logs/{task}-output.json` | Parsed/normalized output (created by dispatcher)   |

## Scripts

| Script                      | Purpose                                                 |
| --------------------------- | ------------------------------------------------------- |
| `parallel-dispatch.ps1`     | Main orchestrator - spawns workers, coordinates parsing |
| `parse-worker-log.ps1`      | Parses raw JSON log, creates normalized output file     |
| `process-worker-output.ps1` | Updates kanban files from normalized output             |

## Task Status Logic

Task status is derived from the `passes` field (kanban-board.json) and `status` field (kanban-progress.json):

| passes  | progress.json status  | Derived Status  |
| ------- | --------------------- | --------------- |
| `false` | (no entry)            | **pending**     |
| `false` | `running`             | **in-progress** |
| `false` | `completed` / `error` | **in-progress** |
| `false` | `blocked`             | **blocked**     |
| `true`  | NOT `completed`       | **code-review** |
| `true`  | `completed`           | **completed**   |
| `true`  | (no entry)            | **completed**   |

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

| Category    | Agent              |
| ----------- | ------------------ |
| data        | backend-developer  |
| config      | backend-developer  |
| api         | backend-developer  |
| integration | backend-developer  |
| ui          | vue-expert         |
| testing     | kanban-unit-tester |

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

| Parameter            | Description                                            | Default |
| -------------------- | ------------------------------------------------------ | ------- |
| `-Parallel N`        | Maximum concurrent workers                             | 3       |
| `-DryRun`            | Show what would run without executing                  | false   |
| `-AllowDbMigrations` | Run Prisma db push + generate after Wave 1             | false   |
| `-FailFast`          | Stop immediately if any task fails                     | false   |
| `-RunVerification`   | Run typecheck/lint/tests after each wave               | false   |
| `-NonInteractive`    | No prompts (auto-detected in CI)                       | false   |
| `-DefaultFailAction` | Action on failure in non-interactive (Skip/Retry/Quit) | Skip    |

**Examples**:

```bash
# Default: 3 parallel workers
powershell -ExecutionPolicy Bypass -File ".claude/commands/kanban/process/scripts/parallel-dispatch.ps1"

# Run 5 tasks at once
powershell -ExecutionPolicy Bypass -File ".claude/commands/kanban/process/scripts/parallel-dispatch.ps1" -Parallel 5

# Preview without executing
powershell -ExecutionPolicy Bypass -File ".claude/commands/kanban/process/scripts/parallel-dispatch.ps1" -DryRun

# Run with database migrations and fail-fast
powershell -ExecutionPolicy Bypass -File ".claude/commands/kanban/process/scripts/parallel-dispatch.ps1" -AllowDbMigrations -FailFast

# Run with full verification (typecheck, lint, tests) after each wave
powershell -ExecutionPolicy Bypass -File ".claude/commands/kanban/process/scripts/parallel-dispatch.ps1" -RunVerification -FailFast
```

### Phase 3: Monitor and Handle Failures

The dispatcher script handles monitoring automatically:

1. Displays live progress as workers complete
2. Parses raw logs to extract results
3. Shows pass/fail status for each task
4. On failure, prompts user:
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
2. Implements the task following project patterns
3. Runs verification steps and documents results
4. **Does NOT create any output files** - dispatcher handles this

**Worker Prompt Template**: `.claude/commands/kanban/process/prompts/worker-task.md`

### Worker Output Detection

The dispatcher extracts data from raw worker logs:

| Data            | Source in Raw Log                                                   |
| --------------- | ------------------------------------------------------------------- |
| Affected Files  | `type: "assistant"` → `tool_use` with `name: "Write"` or `"Edit"`   |
| Token Usage     | `type: "assistant"` → `message.usage` or `type: "result"` → `usage` |
| Success/Failure | `type: "result"` → `is_error` and `subtype`                         |
| Duration        | `type: "result"` → `duration_ms`                                    |
| Work Summary    | `type: "result"` → `result` (final text response)                   |
| Verification    | Text patterns like "Step N: PASS/FAIL" in assistant messages        |

### Normalized Output File Schema

The dispatcher creates `.kanban/worker-logs/{task-name}-output.json`:

```json
{
  "taskName": "task-name",
  "status": "success",
  "startedAt": "2026-01-19T12:00:00.000Z",
  "completedAt": "2026-01-19T12:15:00.000Z",
  "agent": "backend-developer",
  "verification": {
    "passed": true,
    "steps": [
      { "description": "Step 1", "passed": true },
      { "description": "Step 2", "passed": true }
    ]
  },
  "workLog": ["Brief description of work done", "Change 1", "Change 2"],
  "affectedFiles": ["path/to/file1.ts", "path/to/file2.ts"],
  "tokensUsed": [45000, 89000, 120000],
  "durationMs": 174026
}
```

**Status Values**:

- `success` - Worker completed without errors, result indicates success
- `error` - Execution error occurred or result indicates failure

### Dispatcher Responsibilities

The dispatcher (`parallel-dispatch.ps1`) handles:

1. Marking tasks as `status: "running"` before spawning workers
2. **Calling `parse-worker-log.ps1`** to extract data from raw logs
3. Creating normalized output files
4. Calling `process-worker-output.ps1` to update kanban files
5. Setting `passes: true` in board when verification passes
6. Tracking and displaying token usage

---

## Error Handling

### Worker Failure

When a worker fails:

1. Parse script extracts error information from raw log
2. Progress entry contains `status: "error"` with details
3. Full output available in `.kanban/worker-logs/{task-name}.json`
4. User prompted for action (retry/skip/quit)

### Parse Failure

If the parse script fails to extract data:

1. Dispatcher reports parse error with details
2. Task marked as error
3. Raw log preserved for manual investigation

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
4. **Parse** raw worker logs to create normalized output files
5. **Update** kanban files with extracted data
6. **Handle** failures with retry/skip/quit options
7. **Report** final summary when all waves complete
8. **Direct** user to `kanban:code-review` for commits

---

## Notes

- Code review and git commits are handled by the separate `kanban:code-review` skill
- Workers operate independently and may run concurrently
- Each worker has full access to project files and CLAUDE.md context
- Worker logs are preserved in `.kanban/worker-logs/` for debugging
- **Workers run with `--dangerously-skip-permissions`** to enable autonomous execution
- **Dispatcher owns output file creation** - workers do not create tracking files
- `kanban-progress.json` is the single source of truth for worker status tracking

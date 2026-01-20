---
name: kanban:code-review
description: Review and commit completed kanban tasks. Use after kanban:process to approve changes and create git commits.
allowed-tools: Bash, Read, Write, Edit
---

# Code Review Kanban Skill

Review tasks that have passed verification but are not yet committed, then create git commits for approved changes.

## Overview

This skill handles the code review and git commit phase of the kanban workflow. It processes tasks with `passes: true` and `status != "completed"` (code-review status), allowing the user to review changes and create individual commits for each approved task.

## Prerequisites

- `.kanban/kanban-board.json` must exist
- `.kanban/kanban-progress.json` must exist
- At least one task must be in code-review status (`passes: true`, `status != "completed"`)
- Run `kanban:process` first to execute and verify tasks

## Task Status Reference

Task status is derived from the `passes` field (kanban-board.json) and `status` field (kanban-progress.json):

| passes  | In progress.json | status          | Derived Status  |
| ------- | ---------------- | --------------- | --------------- |
| `false` | No               | -               | **pending**     |
| `false` | Yes              | any             | **in-progress** |
| `false` | Yes              | `blocked`       | **blocked**     |
| `true`  | Yes              | NOT `completed` | **code-review** |
| `true`  | Yes              | `completed`     | **completed**   |
| `true`  | No               | -               | **completed**   |

This skill only processes tasks in **code-review** status.

---

## Workflow

### Phase 1: Load and Analyze

Read kanban files and identify tasks ready for code review.

```
Read: .kanban/kanban-board.json
Read: .kanban/kanban-progress.json
```

Calculate status for each task and display summary:

```
CODE REVIEW STATUS
------------------
Tasks ready for review: X
Already committed: X
Pending/In-progress: X
```

If no code-review tasks exist:

- Display message: "No tasks ready for code review."
- If pending tasks exist, direct user to run `kanban:process`
- Exit

### Phase 2: Review Each Task

For each task in code-review status, present the following information:

```
============================================
TASK: <task-name>
============================================
Category: <category>
Description:
<first 3 lines of description>

Affected Files:
- <file1>
- <file2>
...

Agents Used:
- <agent1>
- <agent2>

Work Log:
<progress log entry>
```

Then show the git diff for affected files:

```bash
git diff HEAD -- <affected-files>
```

If the task modified files that are not in the staged area, show unstaged changes:

```bash
git diff -- <affected-files>
```

### Phase 3: User Decision

After presenting task information and diff, ask the user for action:

**Options:**

| Option          | Action                                                   |
| --------------- | -------------------------------------------------------- |
| **approve** (a) | Create git commit for this task                          |
| **reject** (r)  | Mark task for re-work (set `passes: false`)              |
| **skip** (s)    | Skip this task, continue to next                         |
| **stop** (q)    | Stop review session, keep remaining tasks in code-review |

Display prompt:

```
Action: [a]pprove / [r]eject / [s]kip / [q]uit >
```

### Phase 4: Execute Action

#### On Approve

1. Stage affected files:

   ```bash
   git add <affected-files>
   ```

2. Create commit with standardized format:

   ```bash
   git commit -m "$(cat <<'EOF'
   feat(<category>): <task-name>

   <brief description from task description, first paragraph>

   Affected files:
   - <file1>
   - <file2>

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   EOF
   )"
   ```

3. Update progress.json: Set `status: "completed"` for this task

4. Display confirmation:
   ```
   [OK] Committed: <task-name>
   ```

#### On Reject

1. Update kanban-board.json: Set `passes: false` for this task

2. Update progress.json: Set `status: "running"` to indicate task needs re-work

3. Display message:
   ```
   [REJECTED] Task '<task-name>' marked for re-work
   Run 'kanban:process' to retry this task
   ```

#### On Skip

1. Leave task unchanged (remains in code-review status)

2. Display message:
   ```
   [SKIPPED] Task '<task-name>' - will remain in code review
   ```

#### On Stop

1. Display current session summary
2. Exit the skill

### Phase 5: Summary

After processing all tasks (or on stop), display final summary:

```
============================================
CODE REVIEW COMPLETE
============================================
Approved & Committed: X
Rejected (needs re-work): X
Skipped (still in review): X
Remaining to review: X
```

If rejected tasks exist:

```
Rejected tasks will be re-processed on next 'kanban:process' run.
```

---

## Git Commit Format

Commits follow a consistent format for traceability:

```
feat(<category>): <task-name>

<brief description>

Affected files:
- <file1>
- <file2>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Commit Type Mapping:**

| Category    | Commit Type |
| ----------- | ----------- |
| data        | feat        |
| api         | feat        |
| ui          | feat        |
| integration | feat        |
| config      | chore       |
| testing     | test        |

---

## Batch Mode

For automated workflows, use the `--batch` flag to auto-approve all code-review tasks:

```
/kanban:code-review --batch
```

In batch mode:

- All code-review tasks are approved without prompts
- Each task gets its own commit
- Summary displayed at end
- Rejected/skip options not available

**Warning**: Use batch mode only when you trust all completed tasks and want to commit them without individual review.

---

## Error Handling

### No Affected Files

If a task has no `affectedFiles` in progress.json:

- Display warning: "Task has no recorded affected files"
- Show `git status` to help identify changes
- Ask user if they want to commit all staged changes or skip

### Git Conflicts

If git operations fail:

- Display the error message
- Do not update progress.json
- Ask user to resolve manually and retry

### Missing Files

If affected files no longer exist:

- Display warning about missing files
- Show which files are missing
- Allow user to approve (commit existing files) or skip

### Unstaged Changes

If there are unstaged changes to affected files:

- Show both staged and unstaged changes
- Warn user that only staged changes will be committed
- Ask if they want to stage all changes first

---

## File Updates

### kanban-board.json

On reject, update the task's `passes` field:

```json
{
  "name": "task-name",
  "passes": false // Changed from true
}
```

### kanban-progress.json

On approve, set `status: "completed"`:

```json
{
  "task-name": {
    "status": "completed",  // Updated from "running" or other
    "log": "...",
    "affectedFiles": [...],
    "agents": [...]
  }
}
```

---

## Execution Summary

1. **Read** kanban files and identify code-review tasks
2. **Display** review status summary
3. **For each** code-review task:
   - Show task details (name, category, description, files, agents)
   - Show git diff for affected files
   - Prompt user for action
   - Execute action (approve/reject/skip/stop)
4. **Update** kanban files based on actions
5. **Display** final summary

---

## Notes

- Each task is committed individually (not batched)
- Rejected tasks go back to pending status for re-processing
- The skill preserves work logs and affected files in progress.json
- Use `git log` to see commit history after approvals
- Run `kanban:process` after rejecting tasks to retry them

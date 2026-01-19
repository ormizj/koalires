---
name: kanban:process
description: Process kanban-board.json by delegating tasks to specialized agents in priority/dependency order. Use after kanban:create to execute planned work.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Task
---

# Process Kanban Skill

Process the kanban board by delegating tasks to specialized agents. Based on Anthropic's "Effective harnesses for long-running agents" approach with human-in-the-loop confirmation at each step.

## Prerequisites

- `.kanban/kanban-board.json` must exist (created by `kanban:create`)
- `.kanban/kanban-progress.json` must exist (created by `kanban:create`)
- User has reviewed and approved the task list

## File Locations

All kanban files are in the `.kanban/` directory:

- `.kanban/kanban-board.json` - The task definitions
- `.kanban/kanban-progress.json` - Tracks which tasks are in-progress or code-review

## Task Structure

Each task in `kanban-board.json` has this structure:

```typescript
{
  "name": string,        // Short name describing the task
  "description": string, // Extended information in markdown format
  "category": string,    // Category: data, api, ui, integration, config, testing
  "steps": string[],     // Verification steps to ensure task works
  "passes": boolean      // Whether the task is done
}
```

## Task Status Logic

Task status is derived from two factors: the `passes` field and presence in `kanban-progress.json`:

| passes  | In kanban-progress.json | Status          | Description                    |
| ------- | ----------------------- | --------------- | ------------------------------ |
| `false` | No                      | **pending**     | Task not started               |
| `false` | Yes (inProgress)        | **in-progress** | Task being worked on           |
| `true`  | Yes (codeReview)        | **code-review** | Task done, awaiting review     |
| `true`  | No                      | **completed**   | Task fully done and reviewed   |

### kanban-progress.json Structure

```json
{
  "inProgress": ["task-name-1"],
  "codeReview": ["task-name-2"]
}
```

## Agent Mapping

The agents available depend on the project's `CLAUDE.md` configuration. Common agents include:

| Agent                 | Domain                                                    |
| --------------------- | --------------------------------------------------------- |
| `backend-developer`   | API routes, server logic, database operations             |
| `vue-expert`          | Frontend Vue/Nuxt work, components, pages, composables    |
| `ui-designer`         | Visual design, styling, UI components, accessibility      |
| `websocket-engineer`  | Real-time features, WebSocket connections, live updates   |

**Note**: Always check the project's `CLAUDE.md` for the complete list of available agents.

## Workflow

### Step 1: Read and Validate Kanban Files

Read both kanban files:

```
Read: .kanban/kanban-board.json
Read: .kanban/kanban-progress.json
```

Validate:

1. Both files exist and are valid JSON
2. Each task has required fields: name, description, category, steps, passes
3. Progress file has inProgress and codeReview arrays

If validation fails, report errors and stop.

### Step 2: Calculate Status and Find Next Task

For each task, derive its status:

```javascript
function getTaskStatus(task, progress) {
  if (task.passes === true) {
    if (progress.codeReview.includes(task.name)) {
      return 'code-review';
    }
    return 'completed';
  } else {
    if (progress.inProgress.includes(task.name)) {
      return 'in-progress';
    }
    return 'pending';
  }
}
```

Display progress summary:

```
KANBAN PROGRESS
---------------
Total Tasks: X
Pending: X
In Progress: X
Code Review: X
Completed: X
```

Find the next task to work on:

1. First, check for tasks in-progress (resume those)
2. Then, select the first pending task

If no pending or in-progress tasks remain, check for code-review tasks or report completion.

### Step 3: Display Task and Request Confirmation

Present the task to the user:

```
============================================
NEXT TASK
============================================

Name: create-user-schema
Status: pending → in-progress
Category: data

Description:
## User Schema

Create the Prisma schema for user data...

Verification Steps:
1. Schema file exists
2. Migration runs successfully
3. User model is accessible

============================================
Proceed with this task? (yes/no/skip/stop)
============================================
```

Wait for user response:

- **yes**: Proceed to Step 4
- **no** or **skip**: Mark task as skipped, return to Step 2
- **stop**: Save progress and exit

### Step 4: Start Task (Update Progress)

Add the task to inProgress:

```json
{
  "inProgress": ["task-name"],
  "codeReview": []
}
```

Write updated `.kanban/kanban-progress.json`.

### Step 5: Delegate to Agent

Determine the appropriate agent based on category:

| Category      | Typical Agent        |
| ------------- | -------------------- |
| `data`        | `backend-developer`  |
| `api`         | `backend-developer`  |
| `ui`          | `vue-expert`         |
| `integration` | `backend-developer`  |
| `config`      | `backend-developer`  |
| `testing`     | `backend-developer`  |

Delegate the task using the Task tool:

```
Task: <agent-name>
Prompt: |
  ## Task Assignment

  **Name**: <task.name>
  **Category**: <task.category>

  ## Description
  <task.description>

  ## Verification Steps
  When complete, ensure these pass:
  <task.steps> (numbered list)

  ## Requirements
  - Follow the project's existing patterns and conventions
  - Ensure code passes any configured linting/type checks
  - Follow the project's architecture guidelines (see CLAUDE.md)

  ## When Complete
  Provide a summary of changes made.
```

### Step 6: Run Change Impact Analysis

After the agent completes, invoke the change-impact-analyzer:

```
Task: change-impact-analyzer
Prompt: |
  Analyze the changes made for task <task.name>

  Check for:
  - Breaking changes to other files
  - Missing imports or exports
  - Architecture/layer violations
  - Type errors or lint issues

  Report any files that need updates.
```

If the analyzer finds issues:

1. Address each issue (delegate to appropriate agent if needed)
2. Run change-impact-analyzer again
3. Repeat until no issues are found

### Step 7: Mark Task as Passing

Update the task in `kanban-board.json`:

```json
{
  "name": "task-name",
  "description": "...",
  "category": "...",
  "steps": ["..."],
  "passes": true
}
```

### Step 8: Move to Code Review

Update `kanban-progress.json`:

```json
{
  "inProgress": [],
  "codeReview": ["task-name"]
}
```

Ask user if they want to review now or continue:

```
Task "task-name" is ready for code review.
- review: Review and complete this task now
- continue: Move to next task, review later
- stop: Save progress and exit
```

If **review**:
- Present the changes made
- Ask for approval
- If approved, remove from codeReview (task becomes completed)
- If rejected, set passes back to false, move back to inProgress

### Step 9: Create Git Commit

Create a git commit for the completed task:

```bash
git add -A
git commit -m "feat(<category>): <task.name>

<brief description from task.description>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Step 10: Loop or Complete

Return to Step 2 to process the next task.

When all tasks are complete (no pending, in-progress, or code-review):

```
============================================
KANBAN BOARD COMPLETE
============================================

All tasks have been processed successfully.

Summary:
- Total Tasks: X
- Completed: X
- Commits Created: X

============================================
```

---

## Error Handling

### Agent Failure

If an agent reports failure:

1. Keep `passes: false`
2. Keep task in `inProgress`
3. Log the error
4. Ask user: retry, skip, or stop

### Validation Errors

If change-impact-analyzer finds critical issues after 3 attempts:

1. Keep task in inProgress
2. Set `passes: false`
3. Notify user of the issue
4. Offer to skip or stop

---

## Resume Capability

This skill supports resuming interrupted sessions:

1. On start, read both `.kanban/` files
2. Tasks in `inProgress` are offered for retry/continue
3. Tasks in `codeReview` can be reviewed
4. Tasks with `passes: true` and not in progress/review are skipped (completed)

---

## Execution Summary

1. **Read** `.kanban/kanban-board.json` and `.kanban/kanban-progress.json`
2. **Calculate** status for each task
3. **Find** next pending or in-progress task
4. **Confirm** with user before starting
5. **Add** task to inProgress
6. **Delegate** to appropriate agent
7. **Run** change-impact-analyzer (repeat until clean)
8. **Set** `passes: true` in kanban-board.json
9. **Move** task to codeReview in progress.json
10. **Offer** code review or continue
11. **Commit** changes
12. **Loop** until all tasks complete
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
  "steps": string[],     // Sequential test steps (like manual QA) to verify the task
  "passes": boolean      // Whether the task verification passed
}
```

## Task Status Logic

Task status is derived from: `passes` field in kanban-board.json, presence in kanban-progress.json, and `committed` field:

| passes  | In progress.json | committed | Status          |
| ------- | ---------------- | --------- | --------------- |
| `false` | No               | -         | **pending**     |
| `false` | Yes              | `false`   | **in-progress** |
| `true`  | Yes              | `false`   | **code-review** |
| `true`  | Yes              | `true`    | **completed**   |
| `true`  | No               | -         | **completed**   |

Note: `passes: false` + `committed: true` is an invalid state and should not occur.

### kanban-progress.json Structure

```json
{
  "user-profile-api": {
    "log": "Created GET endpoint, added auth middleware. Verified all test steps pass.",
    "committed": false,
    "affectedFiles": [
      "server/api/users/profile.get.ts",
      "server/middleware/auth.ts"
    ],
    "agents": [
      "backend-developer",
      "change-impact-analyzer"
    ]
  }
}
```

- `log` - Narrative of work done, useful for resuming context across sessions
- `committed` - Whether this work has been committed to git
- `affectedFiles` - Array of file paths that were created, modified, or deleted during this task
- `agents` - Array of agent names that worked on this task (in order of invocation)

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
3. Progress file is a valid JSON object (keys are task names)

If validation fails, report errors and stop.

### Step 2: Calculate Status and Find Next Task

For each task, derive its status:

```javascript
function getTaskStatus(task, progress) {
  const entry = progress[task.name];

  if (task.passes === true) {
    if (entry && entry.committed === false) {
      return 'code-review';
    }
    return 'completed';
  } else {
    if (entry) {
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

Add an entry for the task to progress.json:

```json
{
  "task-name": {
    "log": "",
    "committed": false,
    "affectedFiles": [],
    "agents": []
  }
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
  Provide a summary of changes made AND list all files that were created, modified, or deleted in a clearly labeled section:

  ### Affected Files
  - path/to/file1.ts (created)
  - path/to/file2.ts (modified)
  - path/to/file3.ts (deleted)
```

### Step 5.5: Record Agent and Affected Files

After the agent completes, update progress with agent name and affected files:

1. Add the agent name to the `agents` array (if not already present)
2. Parse the "Affected Files" section from the agent's response
3. Extract file paths (ignore the action type in parentheses for storage)
4. Update the task entry in kanban-progress.json

```json
{
  "task-name": {
    "log": "",
    "committed": false,
    "affectedFiles": [
      "path/to/file1.ts",
      "path/to/file2.ts",
      "path/to/file3.ts"
    ],
    "agents": ["backend-developer"]
  }
}
```

**Note**: Each time an agent works on the task, add its name to the `agents` array. This tracks all agents involved, even if multiple agents contribute (e.g., primary implementation + change-impact-analyzer + fix agents).

**Fallback**: If the agent doesn't provide a clear "Affected Files" section, use `git status --porcelain` to detect changed files and populate the array.

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

### Step 7: Execute E2E Verification Steps

Before marking the task as passing, execute the sequential test steps defined in the task to verify the implementation works end-to-end:

1. Read the `steps` array from the task
2. Execute each step in order (these are manual QA-style steps)
3. Document results as you go

```
============================================
E2E VERIFICATION: task-name
============================================

Step 1: Navigate to the login page
→ PASS: Login page loads at /login

Step 2: Enter valid email and password
→ PASS: Form accepts input

Step 3: Click the 'Sign In' button
→ PASS: Button triggers submission

Step 4: Verify redirect to dashboard
→ PASS: Redirected to /dashboard

All verification steps passed!
============================================
```

If any step fails:
1. Report the failure to the user
2. Delegate fixes to the appropriate agent
3. Re-run verification from the beginning
4. Repeat until all steps pass (max 3 attempts)

### Step 8: Mark Task as Passing

After E2E verification succeeds, update the task in `kanban-board.json`:

```json
{
  "name": "task-name",
  "description": "...",
  "category": "...",
  "steps": ["..."],
  "passes": true
}
```

Update the log in `kanban-progress.json` with work summary:

```json
{
  "task-name": {
    "log": "Implemented feature X. Created Y component. Added Z endpoint. All verification steps pass.",
    "committed": false
  }
}
```

Note: The task now has status **code-review** (passes: true, committed: false).

### Step 9: Code Review

First, display affected files and verify their status:

```
============================================
FILES CHANGED IN THIS TASK
============================================

1. server/api/users/profile.get.ts
2. server/middleware/auth.ts

Checking for uncommitted changes...
→ All affected files are staged/clean

Ready for code review.
============================================
```

**Verification logic**:
1. Read the `affectedFiles` array from progress.json for this task
2. Run `git status --porcelain` on those specific files
3. If any affected files have uncommitted changes, warn the user
4. Only allow commit when all affected files are staged or have no changes

Ask user if they want to review now or continue:

```
Task "task-name" is ready for code review.
- review: Review and complete this task now
- continue: Move to next task, review later
- stop: Save progress and exit
```

If **review**:
- Present the changes made (show git diff or file summaries)
- Ask for approval
- If approved, proceed to Step 10 (commit)
- If rejected:
  - Set `passes: false` in kanban-board.json
  - Update log with rejection reason
  - Return to Step 5 to address issues

If **continue**:
- Leave task in code-review status
- Proceed to Step 11 (next task)

### Step 10: Create Git Commit

Create a git commit for the approved task:

```bash
git add -A
git commit -m "feat(<category>): <task.name>

<brief description from task.description>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

After successful commit, update `kanban-progress.json`:

```json
{
  "task-name": {
    "log": "Implemented feature X. Created Y component. Added Z endpoint. All verification steps pass.",
    "committed": true
  }
}
```

Note: The task now has status **completed** (passes: true, committed: true).

### Step 11: Loop or Complete

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
2. Keep task entry in progress.json
3. Update log with error details
4. Ask user: retry, skip, or stop

### E2E Verification Failure

If verification steps fail after 3 fix attempts:

1. Keep `passes: false`
2. Update log with failure details
3. Notify user of the issue
4. Offer to skip or stop

### Validation Errors

If change-impact-analyzer finds critical issues after 3 attempts:

1. Keep `passes: false`
2. Update log with issues found
3. Notify user of the issue
4. Offer to skip or stop

---

## Resume Capability

This skill supports resuming interrupted sessions:

1. On start, read both `.kanban/` files
2. Check progress.json for existing task entries
3. Tasks with entry but `passes: false` → **in-progress** (resume work)
4. Tasks with entry, `passes: true`, `committed: false` → **code-review** (offer review)
5. Tasks with entry, `passes: true`, `committed: true` → **completed** (skip)
6. Tasks without entry → **pending** (not started)

When resuming an in-progress task:
- Read the `log` field to understand previous work done
- Read the `affectedFiles` array to see which files were touched
- Read the `agents` array to see which agents have already worked on this task

---

## Execution Summary

1. **Read** `.kanban/kanban-board.json` and `.kanban/kanban-progress.json`
2. **Calculate** status for each task
3. **Find** next pending or in-progress task
4. **Confirm** with user before starting
5. **Add** task entry to progress.json
6. **Delegate** to appropriate agent
7. **Record** affected files from agent response
8. **Run** change-impact-analyzer (repeat until clean)
9. **Execute** E2E verification steps (repeat until all pass)
10. **Set** `passes: true` and update log
11. **Verify** affected files status before code review
12. **Offer** code review or continue
13. **Commit** and set `committed: true`
14. **Loop** until all tasks complete
# Kanban Schema Reference

Strict, unambiguous schema definitions for all kanban data files. No interpolation - exact types, required/optional fields, and enum values defined.

---

## File Locations

| Path                                          | Purpose                                    | Required           |
| --------------------------------------------- | ------------------------------------------ | ------------------ |
| `.kanban/kanban-board.json`                   | Task definitions with passes field         | Yes                |
| `.kanban/kanban-progress.json`                | Status tracking, work logs, affected files | Yes                |
| `.kanban/kanban-viewer.html`                  | Interactive viewer UI                      | Yes                |
| `.kanban/worker-logs/`                        | Worker output logs (runtime)               | Created at runtime |
| `.kanban/worker-logs/{task-name}.json`        | Claude session log for token tracking      | Created at runtime |
| `.kanban/worker-logs/{task-name}-output.json` | Worker output file with results            | Created by worker  |

---

## 1. kanban-board.json

### TypeScript Interface

```typescript
interface KanbanBoard {
  project: string; // REQUIRED - Feature/project name
  created: string; // REQUIRED - ISO 8601 timestamp (e.g., "2026-01-20T10:00:00Z")
  projectType: string; // REQUIRED - Project framework (e.g., "nuxt", "next", "react")
  tasks: Task[]; // REQUIRED - Array of tasks (min 1)
}

interface Task {
  name: string; // REQUIRED - kebab-case identifier (e.g., "file-share-schema")
  description: string; // REQUIRED - Markdown description of the task
  category: TaskCategory; // REQUIRED - One of the enum values below
  steps: string[]; // REQUIRED - Verification steps array (min 1 step)
  passes: boolean; // REQUIRED - true if verification passed, false otherwise
}

type TaskCategory =
  | 'data'
  | 'api'
  | 'ui'
  | 'integration'
  | 'config'
  | 'testing';
```

### Example

```json
{
  "project": "File Sharing with Permission Controls",
  "created": "2026-01-20T10:00:00Z",
  "projectType": "nuxt",
  "tasks": [
    {
      "name": "file-share-schema",
      "description": "## File Share Database Schema\n\nCreate a Prisma schema...",
      "category": "data",
      "steps": [
        "Open server/database/schemas/fileShare.prisma",
        "Verify FileShare model exists",
        "Run npm run db:generate"
      ],
      "passes": false
    }
  ]
}
```

### Field Constraints

| Field                 | Type    | Constraints                                    |
| --------------------- | ------- | ---------------------------------------------- |
| `project`             | string  | Non-empty, describes the feature               |
| `created`             | string  | ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ`        |
| `projectType`         | string  | Framework identifier (lowercase)               |
| `tasks`               | array   | Minimum 1 task                                 |
| `tasks[].name`        | string  | kebab-case, unique within board                |
| `tasks[].description` | string  | Markdown format                                |
| `tasks[].category`    | enum    | See TaskCategory enum                          |
| `tasks[].steps`       | array   | Minimum 1 step, strings                        |
| `tasks[].passes`      | boolean | `false` initially, `true` on verification pass |

---

## 2. kanban-progress.json

### TypeScript Interface

```typescript
interface KanbanProgress {
  [taskName: string]: ProgressEntry; // Keys match task.name from board
}

interface ProgressEntry {
  status: TaskStatus; // REQUIRED - Current execution state
  startedAt: string; // REQUIRED - ISO 8601 timestamp when work began
  agent: string; // REQUIRED - Agent name that worked on task
  completedAt?: string; // OPTIONAL - ISO 8601 timestamp when work finished
  workLog?: string[]; // OPTIONAL - Array of work log entries
  affectedFiles?: string[]; // OPTIONAL - File paths created/modified/deleted
  tokensUsed?: number[]; // OPTIONAL - Context window usage per API turn
}

type TaskStatus = 'running' | 'code-review' | 'completed' | 'error' | 'blocked';
```

### Initial Entry (Written at Task Start)

```json
{
  "task-name": {
    "status": "running",
    "startedAt": "2026-01-20T10:00:00.000Z",
    "agent": "backend-developer"
  }
}
```

### Final Entry (Written on Completion)

```json
{
  "task-name": {
    "status": "code-review",
    "startedAt": "2026-01-20T10:00:00.000Z",
    "completedAt": "2026-01-20T10:15:00.000Z",
    "workLog": [
      "Created Prisma schema with FileShare model",
      "Generated Prisma client successfully",
      "Verified all verification steps pass"
    ],
    "affectedFiles": ["path/to/file1.ts", "path/to/file2.ts"],
    "agent": "backend-developer",
    "tokensUsed": [29260, 30000, 30500, 30782]
  }
}
```

### Error Entry

```json
{
  "task-name": {
    "status": "error",
    "startedAt": "2026-01-20T10:00:00.000Z",
    "completedAt": "2026-01-20T10:05:00.000Z",
    "workLog": [
      "Failed to complete task due to missing dependency",
      "Suggested fix: Install required package first"
    ],
    "affectedFiles": [],
    "agent": "backend-developer"
  }
}
```

### Blocked Entry

```json
{
  "task-name": {
    "status": "blocked",
    "startedAt": "2026-01-20T10:00:00.000Z",
    "completedAt": "2026-01-20T10:05:00.000Z",
    "workLog": [
      "Task blocked due to unmet dependencies",
      "Missing: required-task-name"
    ],
    "affectedFiles": [],
    "agent": "backend-developer"
  }
}
```

### Field Constraints

| Field           | Type     | Required | Constraints                                                       |
| --------------- | -------- | -------- | ----------------------------------------------------------------- |
| `status`        | enum     | Yes      | One of: `running`, `code-review`, `completed`, `error`, `blocked` |
| `startedAt`     | string   | Yes      | ISO 8601 format with milliseconds                                 |
| `agent`         | string   | Yes      | Agent name string                                                 |
| `completedAt`   | string   | No\*     | ISO 8601 format, set when status != `running`                     |
| `workLog`       | string[] | No\*     | Array of work log entry strings                                   |
| `affectedFiles` | array    | No\*     | Relative file paths from project root                             |
| `tokensUsed`    | number[] | No       | Context window usage per API turn                                 |

**Token Usage Tracking**: The `tokensUsed` field contains an array of context window usage values, one per API turn during task execution. Each value represents the total context size at that turn (input + output + cache tokens). This data is populated by the dispatcher after worker completion. The token limit is 200,000 (context window). Typical per-turn values are 30k-50k tokens.

**\*Worker Protocol Requirements**: While these fields are technically optional in the JSON schema, the worker protocol expects them to be populated:

- `completedAt`, `workLog`, and `affectedFiles` are **expected** for `completed` entries
- `completedAt` and `workLog` are **expected** for `error` and `blocked` entries
- The dispatcher validates entries and displays warnings for missing/empty fields

---

## 3. Enums

### TaskCategory

| Value         | Agent              | Description                                    |
| ------------- | ------------------ | ---------------------------------------------- |
| `data`        | backend-developer  | Database schemas, Prisma models, types, stores |
| `api`         | backend-developer  | Server endpoints, business logic               |
| `ui`          | vue-expert         | Vue components, pages, visual design           |
| `integration` | backend-developer  | Service connections, API clients               |
| `config`      | backend-developer  | Configuration files                            |
| `testing`     | kanban-unit-tester | Test files (TDD workflow)                      |

### TaskStatus

| Value         | Description                                         |
| ------------- | --------------------------------------------------- |
| `running`     | Task execution in progress                          |
| `code-review` | Task finished, verification passed, awaiting commit |
| `completed`   | Task finished and committed                         |
| `error`       | Task failed due to an error                         |
| `blocked`     | Task cannot proceed, dependencies not met           |

---

## 4. Wave Processing Order

Tasks execute in waves based on category dependencies. Each wave completes before the next begins.

| Wave | Categories       | Depends On | Description         |
| ---- | ---------------- | ---------- | ------------------- |
| 1    | `data`, `config` | None       | Foundation layer    |
| 2    | `api`            | Wave 1     | Server endpoints    |
| 3    | `integration`    | Wave 2     | Service connections |
| 4    | `ui`             | Wave 3     | User interface      |
| 5    | `testing`        | Wave 4     | Test coverage       |

---

## 5. Derived Status (Decision Table)

The UI/viewer derives task status from `passes` (kanban-board.json) and `status` (kanban-progress.json):

| `passes` | Progress Entry | `status`        | **Derived Status** |
| -------- | -------------- | --------------- | ------------------ |
| `false`  | None           | -               | **pending**        |
| `false`  | Exists         | `running`       | **in-progress**    |
| `false`  | Exists         | `completed`     | **in-progress**    |
| `false`  | Exists         | `error`         | **in-progress**    |
| `false`  | Exists         | `blocked`       | **blocked**        |
| `true`   | Exists         | NOT `completed` | **code-review**    |
| `true`   | Exists         | `completed`     | **completed**      |
| `true`   | None           | -               | **completed**      |

**Key insights**:

- `passes: true` + `status: "completed"` = task is finished AND committed
- `passes: false` + `status: "blocked"` = task has unmet dependencies (gets own red column in viewer)
- `passes: false` with any other status = in-progress (worker hasn't passed verification yet)
- `passes: true` + `status` NOT `"completed"` = code-review (verification passed, awaiting commit)

### Status Color Mapping (for viewer)

| Derived Status | Color  | Hex     |
| -------------- | ------ | ------- |
| pending        | Gray   | #8b949e |
| in-progress    | Orange | #f0883e |
| code-review    | Purple | #a371f7 |
| completed      | Green  | #3fb950 |
| blocked        | Red    | #f85149 |

---

## 6. Agent Mapping

Workers are assigned based on task category:

| Category      | Agent                | Focus Areas                                 |
| ------------- | -------------------- | ------------------------------------------- |
| `data`        | `backend-developer`  | Prisma schemas, repositories, types, stores |
| `config`      | `backend-developer`  | Configuration files, environment setup      |
| `api`         | `backend-developer`  | Server routes, business logic, middleware   |
| `integration` | `backend-developer`  | API clients, service connections            |
| `ui`          | `vue-expert`         | Vue components, Nuxt pages, composables     |
| `testing`     | `kanban-unit-tester` | Unit tests, integration tests               |

---

## 6.1 TDD (Test-Driven Development) Workflow

The kanban dispatcher implements a TDD workflow where tests are created BEFORE implementation begins.

### TDD Categories

The following task categories receive pre-implementation tests:

- `data` - Database schemas, types, stores
- `api` - Server endpoints, business logic
- `integration` - Service connections, API clients
- `ui` - Vue components, pages
- `config` - Configuration files

**Note**: `testing` category tasks do NOT receive pre-tests (they ARE the tests).

### TDD Execution Flow

```
For each batch of tasks:

PHASE 1: TEST CREATION
┌─────────────────────────────────────────────────┐
│ 1. Filter tasks that need tests (TDD categories)│
│ 2. Spawn kanban-unit-tester agents in parallel         │
│ 3. kanban-unit-tester analyzes task description/steps  │
│ 4. Creates test files that will FAIL initially  │
│ 5. Extract created test file paths from logs    │
└─────────────────────────────────────────────────┘
                       ↓
PHASE 2: IMPLEMENTATION
┌─────────────────────────────────────────────────┐
│ 1. Build worker prompts with test file paths    │
│ 2. Spawn implementation workers in parallel     │
│ 3. Workers read tests to understand requirements│
│ 4. Workers implement feature                    │
│ 5. Workers run tests - must ALL pass            │
│ 6. Workers verify manual steps                  │
└─────────────────────────────────────────────────┘
```

### Test Creation Output

The kanban-unit-tester creates test files based on task requirements:

| Task Category | Test File Location                            | Example                                 |
| ------------- | --------------------------------------------- | --------------------------------------- |
| `data`        | Same directory as implementation + `.test.ts` | `server/database/schemas/user.test.ts`  |
| `api`         | Same directory as implementation + `.test.ts` | `server/api/auth/login.test.ts`         |
| `ui`          | Same directory as implementation + `.test.ts` | `client/features/auth/ui/Login.test.ts` |
| `integration` | Same directory as implementation + `.test.ts` | `server/services/email.test.ts`         |
| `config`      | Same directory as implementation + `.test.ts` | `config/app.test.ts`                    |

### Worker Prompt with Test Files

Implementation workers receive test file paths in their prompt:

```markdown
### Pre-Created Test Files

The following test files have been created for this task. Your implementation MUST pass all tests:

- `server/api/auth/login.test.ts`
- `server/utils/jwt.test.ts`

Run tests with: `npm run test` or the project's test command.
```

### Test File Detection

The dispatcher extracts test files from kanban-unit-tester logs by detecting:

- Write/Edit tool calls creating files matching test patterns
- Patterns: `*.test.ts`, `*.spec.ts`, `test_*.py`, `*_test.py`, `*_test.go`

### TDD Log Files

For each task, the following log files are created:

| File                                                  | Purpose                           |
| ----------------------------------------------------- | --------------------------------- |
| `.kanban/worker-logs/{task}-test-creation.json`       | kanban-unit-tester session log    |
| `.kanban/worker-logs/{task}-test-creation-prompt.txt` | Prompt sent to kanban-unit-tester |
| `.kanban/worker-logs/{task}.json`                     | Implementation worker session log |
| `.kanban/worker-logs/{task}-output.json`              | Normalized implementation output  |

---

## 7. Validation Rules

### kanban-board.json

1. `project` - Must be non-empty string
2. `created` - Must be valid ISO 8601 timestamp
3. `projectType` - Must be non-empty string
4. `tasks` - Must have at least 1 task
5. `tasks[].name` - Must be unique, kebab-case recommended
6. `tasks[].category` - Must be valid TaskCategory enum value
7. `tasks[].steps` - Must have at least 1 step
8. `tasks[].passes` - Must be boolean

### kanban-progress.json

1. Task name keys must match `tasks[].name` from board
2. `status` - Must be valid TaskStatus enum value
3. `startedAt` - Must be valid ISO 8601 timestamp
4. `agent` - Must be non-empty agent name string
5. `completedAt` - Required when status is not `running`
6. `affectedFiles` - Paths must be relative to project root

---

## 8. File Update Protocol

The dispatcher owns all `kanban-progress.json` and `kanban-board.json` updates. Workers create output files.

### Dispatcher: Before Spawning Worker

1. Read `kanban-progress.json`
2. Add entry with:
   - `status: "running"`
   - `startedAt: "<current ISO timestamp>"`
   - `agent: "<agent-name>"`
3. Write `kanban-progress.json`
4. Spawn worker process

### Worker: Create Output File

Workers create `.kanban/worker-logs/{task-name}-output.json`:

```json
{
  "taskName": "<task-name>",
  "status": "success|error|blocked",
  "startedAt": "<ISO timestamp>",
  "completedAt": "<ISO timestamp>",
  "agent": "<agent-name>",
  "verification": {
    "passed": true|false,
    "steps": [{ "description": "...", "passed": true|false }]
  },
  "workLog": ["<log entry 1>", "<log entry 2>"],
  "affectedFiles": ["<path1>", "<path2>"]
}
```

For error/blocked status, include:

```json
{
  "error": {
    "message": "What went wrong",
    "type": "execution|verification|dependency",
    "suggestedFix": "How to resolve"
  }
}
```

**Important**: Workers do NOT update `kanban-progress.json` or `kanban-board.json` directly.

### Dispatcher: After Worker Completes

1. Read worker output file (`.kanban/worker-logs/{task-name}-output.json`)
2. Update `kanban-progress.json` with:
   - `status` mapped from worker output (`success` → `code-review`)
   - `completedAt`, `workLog`, `affectedFiles` from output
   - `tokensUsed` extracted from Claude session log
3. If `verification.passed: true` in output:
   - Read `kanban-board.json`
   - Set `passes: true` for task
   - Write `kanban-board.json`

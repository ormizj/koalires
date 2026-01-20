# Kanban Schema Reference

Strict, unambiguous schema definitions for all kanban data files. No interpolation - exact types, required/optional fields, and enum values defined.

---

## File Locations

| Path                           | Purpose                                    | Required           |
| ------------------------------ | ------------------------------------------ | ------------------ |
| `.kanban/kanban-board.json`    | Task definitions with passes field         | Yes                |
| `.kanban/kanban-progress.json` | Status tracking, work logs, affected files | Yes                |
| `.kanban/kanban-viewer.html`   | Interactive viewer UI                      | Yes                |
| `.kanban/.gitignore`           | Ignores logs/ directory                    | Optional           |
| `.kanban/logs/`                | Worker output logs (runtime)               | Created at runtime |
| `.kanban/logs/{task-name}.log` | One log file per task worker               | Created at runtime |

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
  agents: string[]; // REQUIRED - Agent names that worked on task
  completedAt?: string; // OPTIONAL - ISO 8601 timestamp when work finished
  log?: string; // OPTIONAL - Markdown work summary
  affectedFiles?: string[]; // OPTIONAL - File paths created/modified/deleted
}

type TaskStatus = 'running' | 'completed' | 'error' | 'blocked';
```

### Initial Entry (Written at Task Start)

```json
{
  "task-name": {
    "status": "running",
    "startedAt": "2026-01-20T10:00:00.000Z",
    "agents": ["backend-developer"]
  }
}
```

### Final Entry (Written on Completion)

```json
{
  "task-name": {
    "status": "completed",
    "startedAt": "2026-01-20T10:00:00.000Z",
    "completedAt": "2026-01-20T10:15:00.000Z",
    "log": "## Work Summary\n\nBrief description...\n\n### Changes Made\n- Item 1\n- Item 2",
    "affectedFiles": ["path/to/file1.ts", "path/to/file2.ts"],
    "agents": ["backend-developer"]
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
    "log": "## Error\n\nFailed due to...\n\n### Suggested Fix\n...",
    "affectedFiles": [],
    "agents": ["backend-developer"]
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
    "log": "## Task Blocked\n\n### Missing Dependencies\n- required-task-name",
    "affectedFiles": [],
    "agents": ["backend-developer"]
  }
}
```

### Field Constraints

| Field           | Type   | Required | Constraints                                        |
| --------------- | ------ | -------- | -------------------------------------------------- |
| `status`        | enum   | Yes      | One of: `running`, `completed`, `error`, `blocked` |
| `startedAt`     | string | Yes      | ISO 8601 format with milliseconds                  |
| `agents`        | array  | Yes      | At least 1 agent name string                       |
| `completedAt`   | string | No\*     | ISO 8601 format, set when status != `running`      |
| `log`           | string | No\*     | Markdown format with `\n` for newlines             |
| `affectedFiles` | array  | No\*     | Relative file paths from project root              |

**\*Worker Protocol Requirements**: While these fields are technically optional in the JSON schema, the worker protocol expects them to be populated:

- `completedAt`, `log`, and `affectedFiles` are **expected** for `completed` entries
- `completedAt` and `log` are **expected** for `error` and `blocked` entries
- The dispatcher validates entries and displays warnings for missing/empty fields

---

## 3. Enums

### TaskCategory

| Value         | Agent             | Description                                    |
| ------------- | ----------------- | ---------------------------------------------- |
| `data`        | backend-developer | Database schemas, Prisma models, types, stores |
| `api`         | backend-developer | Server endpoints, business logic               |
| `ui`          | vue-expert        | Vue components, pages, visual design           |
| `integration` | backend-developer | Service connections, API clients               |
| `config`      | backend-developer | Configuration files                            |
| `testing`     | backend-developer | Test files                                     |

### TaskStatus

| Value       | Description                               |
| ----------- | ----------------------------------------- |
| `running`   | Task execution in progress                |
| `completed` | Task finished, all verification passed    |
| `error`     | Task failed due to an error               |
| `blocked`   | Task cannot proceed, dependencies not met |

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

| Category      | Agent               | Focus Areas                                 |
| ------------- | ------------------- | ------------------------------------------- |
| `data`        | `backend-developer` | Prisma schemas, repositories, types, stores |
| `config`      | `backend-developer` | Configuration files, environment setup      |
| `api`         | `backend-developer` | Server routes, business logic, middleware   |
| `integration` | `backend-developer` | API clients, service connections            |
| `ui`          | `vue-expert`        | Vue components, Nuxt pages, composables     |
| `testing`     | `backend-developer` | Unit tests, integration tests               |

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
4. `agents` - Must have at least 1 agent name
5. `completedAt` - Required when status is not `running`
6. `affectedFiles` - Paths must be relative to project root

---

## 8. File Update Protocol

### When Worker Starts

1. Read `kanban-progress.json`
2. Add/update entry with:
   - `status: "running"`
   - `startedAt: "<current ISO timestamp>"`
   - `agents: ["<agent-name>"]`
3. Write `kanban-progress.json`

### When Worker Completes Successfully

1. Read `kanban-progress.json`
2. Update entry with:
   - `status: "completed"`
   - `completedAt: "<current ISO timestamp>"`
   - `log: "<markdown summary>"`
   - `affectedFiles: ["<paths>"]`
3. Write `kanban-progress.json`
4. Read `kanban-board.json`
5. Find task by name, set `passes: true`
6. Write `kanban-board.json`

### When Worker Fails

1. Read `kanban-progress.json`
2. Update entry with:
   - `status: "error"` or `status: "blocked"`
   - `completedAt: "<current ISO timestamp>"`
   - `log: "<error details>"`
   - `affectedFiles: []`
3. Write `kanban-progress.json`
4. Do NOT update `passes` in `kanban-board.json`

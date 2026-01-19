---
name: kanban:create
description: Generate a kanban board of tasks from a feature description. Use when planning new features or breaking down complex requirements into actionable tasks.
allowed-tools: Read, Write, Glob, Grep, Bash, AskUserQuestion
---

# Create Kanban Skill

Generate a structured kanban board of tasks from a feature description. This skill analyzes the feature requirements, examines the codebase to understand existing patterns, and produces a comprehensive task breakdown saved to `.kanban/kanban-board.json`.

Based on Anthropic's "Effective harnesses for long-running agents" approach for systematic task decomposition.

## Usage

```
/kanban:create <feature description>
```

**IMPORTANT**: This command REQUIRES a feature description as an argument. If no feature description is provided, inform the user that a feature description is required and do NOT proceed with any task generation.

## Prerequisite Check

**Before doing anything else**, verify that user provided a feature description:

```
IF args is empty or only whitespace:
  THEN:
    - Output: "A feature description is required to create a kanban board."
    - Output: "Usage: /kanban:create <feature description>"
    - Output: "Example: /kanban:create Add user profile page with avatar upload"
    - STOP execution - do not proceed further
```

## Existing Board Safety Check

**After validating the feature description**, check for existing kanban board data that would be overwritten:

### Check Steps

1. **Check if `.kanban/kanban-board.json` exists**
   - Use Glob to check for `.kanban/kanban-board.json`
   - If file does NOT exist → proceed to workflow (no warning needed)
   - If file exists → continue to step 2

2. **Read existing board and progress files**
   - Read `.kanban/kanban-board.json`
   - Read `.kanban/kanban-progress.json` (if exists)

3. **Analyze existing tasks**
   - Count tasks where `passes: false` (incomplete tasks)
   - Count tasks in `kanban-progress.json` (tasks with active work)
   - Separate tasks by status: in-progress (`committed: false`) vs code-review (`passes: true && committed: false`)

4. **Warn if incomplete work exists**

```
IF kanban-board.json exists:
  incomplete_count = count tasks where passes == false
  progress_entries = Object.keys(kanban-progress.json)
  in_progress_count = count entries where committed == false
  in_review_count = count entries where task.passes == true && committed == false

  IF incomplete_count > 0 OR progress_entries.length > 0:
    THEN:
      - Output: "⚠️ WARNING: Existing kanban board detected with incomplete work!"
      - Output: ""
      - Output: "Current board: [project name from existing board]"
      - Output: "- Incomplete tasks: [incomplete_count]"
      - Output: "- Tasks in progress: [in_progress_count]"
      - Output: "- Tasks in code review: [in_review_count]"
      - Output: ""
      - Output: "Creating a new kanban board will OVERWRITE these files:"
      - Output: "  - .kanban/kanban-board.json"
      - Output: "  - .kanban/kanban-progress.json"
      - Output: ""
      - Use AskUserQuestion tool to ask:
        Question: "Do you want to overwrite the existing kanban board?"
        Options:
          - "Yes, overwrite" - Proceed with creating new board
          - "No, cancel" - Stop execution

      IF user selects "No, cancel":
        - Output: "Cancelled. Existing kanban board preserved."
        - STOP execution - do not proceed further
```

## Output Files

All kanban files are stored in the `.kanban/` directory:

- `.kanban/kanban-board.json` - The structured task list
- `.kanban/kanban-progress.json` - Tracks in-progress and code-review tasks

## Task Structure

Each task follows this simplified structure:

```typescript
{
  "name": string,        // Short name describing the task
  "description": string, // Extended information in markdown format
  "category": string,    // Category of the task (data, api, ui, etc.)
  "steps": string[],     // Sequential test steps (like manual QA) to verify the task
  "passes": boolean      // Whether the task is done (completed)
}
```

### Steps Field - Sequential Test Steps

The `steps` array must contain **sequential test steps** that describe the exact flow a tester would follow to verify the feature works. Think of these as manual QA test scripts that Claude can execute in order.

**Good steps** (sequential, actionable):
```json
"steps": [
  "Navigate to the login page",
  "Enter valid email and password",
  "Click the 'Sign In' button",
  "Verify redirect to dashboard",
  "Check that user name appears in header"
]
```

**Bad steps** (assertions, not sequential):
```json
"steps": [
  "Login works correctly",
  "User is authenticated",
  "Dashboard shows user data"
]
```

Each step should be:
1. **Actionable** - Describes a specific action to take
2. **Sequential** - Builds on the previous step
3. **Verifiable** - Has a clear pass/fail outcome
4. **Specific** - Names exact UI elements, endpoints, or data

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

## Workflow

### Step 1: Validate Feature Description

**CRITICAL**: Check if a feature description was provided as an argument.

- If NO feature description → Output error message and STOP
- If feature description exists → Continue to Step 2

### Step 2: Detect Project Type

Before generating tasks, understand the project context by examining key files:

#### 2.1 Check for Project Configuration

Look for these files to detect the project type:

```
# Package manager / language
Glob: package.json, requirements.txt, go.mod, Cargo.toml, pom.xml, build.gradle

# Frameworks
Glob: nuxt.config.*, next.config.*, vite.config.*, angular.json, vue.config.*
Glob: manage.py, app.py, main.py, Gemfile, composer.json

# Project documentation
Read: README.md, CLAUDE.md (if exists)
```

#### 2.2 Identify Architecture Patterns

```
# Frontend patterns
Glob: src/components/**/*
Glob: src/pages/**/* OR app/**/* OR pages/**/*
Glob: src/features/**/* OR src/modules/**/*

# Backend patterns
Glob: src/api/**/* OR api/**/* OR routes/**/*
Glob: src/services/**/* OR services/**/*
Glob: src/models/**/* OR models/**/*

# Database
Glob: prisma/**/*.prisma, migrations/**/*.sql, *.schema.ts
```

#### 2.3 Check for Related Code

Use Grep to find code related to the feature:

```
Grep: [relevant keywords from feature description]
```

### Step 3: Categorize Feature Requirements

Break down the feature into these universal categories:

| Category      | Description                                              |
| ------------- | -------------------------------------------------------- |
| `data`        | Database schemas, models, data structures                |
| `api`         | Backend endpoints, services, business logic              |
| `ui`          | User interface components and styling                    |
| `integration` | Connecting different parts, third-party services         |
| `config`      | Configuration, environment, setup                        |
| `testing`     | Test cases and validation                                |

### Step 4: Generate Task List

For each requirement, create a task with this structure:

```json
{
  "name": "short-task-name",
  "description": "## Task Description\n\nDetailed description in markdown format.\n\n### Implementation Notes\n- Note 1\n- Note 2",
  "category": "data|api|ui|integration|config|testing",
  "steps": [
    "Step to verify implementation works",
    "Another verification step"
  ],
  "passes": false
}
```

#### Task Name Convention

Use descriptive, kebab-case names:

- `create-user-schema`
- `user-crud-endpoints`
- `profile-page-component`
- `connect-auth-service`
- `setup-database-config`
- `user-api-tests`

#### Steps Field - Sequential Test Steps

The `steps` array must contain **sequential test steps** describing the exact flow to verify the feature. These are like manual QA test scripts:

**For API tasks:**
```json
"steps": [
  "Start the development server",
  "Open API testing tool (curl, Postman, or browser)",
  "Send GET request to /api/users/profile without auth header",
  "Verify response is 401 Unauthorized",
  "Send GET request with valid auth token",
  "Verify response is 200 with user data (name, email, avatar)"
]
```

**For UI tasks:**
```json
"steps": [
  "Navigate to /profile in the browser",
  "Verify the page loads without console errors",
  "Check that user avatar is displayed and centered",
  "Check that user name and email are visible",
  "Click the 'Edit Profile' button",
  "Verify edit form or modal appears"
]
```

### Step 5: Write kanban-board.json

Ensure `.kanban/` directory exists, then write the task board:

```json
{
  "project": "Feature name/description",
  "created": "ISO timestamp",
  "projectType": "detected project type (e.g., nuxt, next, django, express)",
  "tasks": [
    {
      "name": "task-name",
      "description": "## Description\n\nMarkdown description...",
      "category": "category",
      "steps": ["verification step 1", "verification step 2"],
      "passes": false
    }
  ]
}
```

### Step 6: Initialize kanban-progress.json

Create an empty progress tracker:

```json
{}
```

**Structure (keyed by task name):**
```json
{
  "user-profile-api": {
    "log": "Created GET endpoint, added auth middleware. Need to add error handling next session.",
    "committed": false,
    "affectedFiles": [
      "server/api/users/profile.get.ts",
      "server/middleware/auth.ts"
    ],
    "agents": [
      "backend-developer",
      "change-impact-analyzer"
    ]
  },
  "profile-page-ui": {
    "log": "Completed Vue page with avatar, name, email display. Edit button opens modal. Ready for review.",
    "committed": true,
    "affectedFiles": [
      "client/pages/profile.vue",
      "client/components/Avatar.vue"
    ],
    "agents": [
      "vue-expert"
    ]
  }
}
```

- `log` - Narrative of work done, useful for resuming context across sessions
- `committed` - Whether this work has been committed to git
- `affectedFiles` - Array of file paths that were created, modified, or deleted during this task
- `agents` - Array of agent names that worked on this task (in order of invocation)

The log field serves as a narrative history that helps agents understand context when resuming work (following Anthropic's "claude-progress.txt" pattern for cross-session context).

## Example Task Breakdown

### Example: User Profile Feature

For a "create user profile page" feature:

```json
{
  "project": "User Profile Page",
  "created": "2024-01-15T10:30:00Z",
  "projectType": "nuxt",
  "tasks": [
    {
      "name": "user-profile-api",
      "description": "## User Profile API Endpoint\n\nCreate a GET endpoint at `/api/users/profile` that returns the authenticated user's profile data.\n\n### Requirements\n- Return user data (name, email, avatar URL)\n- Require authentication\n- Handle user not found case",
      "category": "api",
      "steps": [
        "Start the development server with npm run dev",
        "Open a terminal or API testing tool",
        "Send GET request to http://localhost:3000/api/users/profile without auth header",
        "Verify response status is 401 Unauthorized",
        "Log in to get a valid auth token",
        "Send GET request to /api/users/profile with Authorization header",
        "Verify response status is 200",
        "Verify response body contains name, email, and avatarUrl fields"
      ],
      "passes": false
    },
    {
      "name": "profile-page-ui",
      "description": "## Profile Page Component\n\nCreate a Vue page at `client/pages/profile.vue` displaying user information.\n\n### Layout\n- User avatar (large, centered)\n- User name and email\n- Edit profile button",
      "category": "ui",
      "steps": [
        "Start the development server with npm run dev",
        "Log in to the application",
        "Navigate to /profile in the browser",
        "Open browser DevTools and check for console errors",
        "Verify the page loads without JavaScript errors",
        "Check that user avatar image is displayed and centered",
        "Check that user name is displayed below the avatar",
        "Check that user email is displayed",
        "Locate the 'Edit Profile' button",
        "Click the 'Edit Profile' button",
        "Verify an edit form or modal appears"
      ],
      "passes": false
    },
    {
      "name": "profile-tests",
      "description": "## Profile Feature Tests\n\nWrite tests for the profile API and page component.",
      "category": "testing",
      "steps": [
        "Run npm run test to execute the test suite",
        "Verify all profile API tests pass",
        "Verify profile component tests pass",
        "Check test coverage report for profile-related files",
        "Verify edge cases are tested (no user, network error, etc.)"
      ],
      "passes": false
    }
  ]
}
```

## Adapting to Different Project Types

### Web Frontend (React/Vue/Angular)

- Focus on component hierarchy
- Consider state management patterns
- Include routing tasks if needed
- Add styling/theming tasks

### Backend API (Express/FastAPI/Django)

- Start with data models
- Group CRUD operations logically
- Include middleware/authentication tasks
- Add API documentation tasks

### Full-Stack (Next.js/Nuxt/Rails)

- Combine frontend and backend patterns
- Consider SSR/SSG implications
- Include API routes and pages
- Handle shared types/interfaces

## Notes

- **CRITICAL**: Do NOT execute if no feature description is provided
- The skill does NOT execute tasks - it only plans them
- User should review `.kanban/kanban-board.json` before running `kanban:process`
- Tasks are designed to be executed by specialized agents
- The `passes` field is updated by `kanban:process` after task completion
- Task status is derived from `passes` and presence in `kanban-progress.json`
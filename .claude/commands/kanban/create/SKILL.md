---
name: kanban:create
description: Generate a kanban board of tasks from a feature description. Use when planning new features or breaking down complex requirements into actionable tasks.
allowed-tools: Read, Write, Glob, Grep, Bash
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
  "steps": string[],     // How to verify the task works correctly
  "passes": boolean      // Whether the task is done (completed)
}
```

## Task Status Logic

Task status is derived from two factors: the `passes` field and presence in `kanban-progress.json`:

| passes  | In kanban-progress.json | Status        |
| ------- | ----------------------- | ------------- |
| `false` | No                      | **pending**   |
| `false` | Yes                     | **in-progress** |
| `true`  | Yes                     | **code-review** |
| `true`  | No                      | **completed** |

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

#### Steps Field

The `steps` array should contain verification steps - how to ensure the feature works:

- "User can see their profile information"
- "API returns 200 on valid request"
- "Form validation prevents invalid input"
- "Database migration runs without errors"

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
{
  "inProgress": [],
  "codeReview": []
}
```

The `inProgress` and `codeReview` arrays will contain task names when tasks are being worked on or reviewed.

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
        "GET /api/users/profile returns 200 with user data",
        "Returns 401 if not authenticated",
        "Returns correct user fields"
      ],
      "passes": false
    },
    {
      "name": "profile-page-ui",
      "description": "## Profile Page Component\n\nCreate a Vue page at `client/pages/profile.vue` displaying user information.\n\n### Layout\n- User avatar (large, centered)\n- User name and email\n- Edit profile button",
      "category": "ui",
      "steps": [
        "Page renders without errors",
        "User data displays correctly",
        "Edit button is visible and clickable"
      ],
      "passes": false
    },
    {
      "name": "profile-tests",
      "description": "## Profile Feature Tests\n\nWrite tests for the profile API and page component.",
      "category": "testing",
      "steps": [
        "All API tests pass",
        "Component renders in test environment",
        "Edge cases are covered"
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
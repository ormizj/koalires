---
name: kanban:create
description: Interactive planning session to create a kanban board. Explores codebase, asks questions, iterates until approved. Use when planning new features or breaking down complex requirements into actionable tasks.
allowed-tools: Read, Write, Glob, Grep, Bash, AskUserQuestion, Task
---

# Create Kanban Skill (Interactive)

This skill conducts an **interactive planning session** to create a structured kanban board. Rather than autonomously generating tasks, it explores the codebase, asks relevant questions, presents findings, and iterates with the user until the board is explicitly approved.

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
   - If file does NOT exist -> proceed to workflow (no warning needed)
   - If file exists -> continue to step 2

2. **Read existing board and progress files**
   - Read `.kanban/kanban-board.json`
   - Read `.kanban/kanban-progress.json` (if exists)

3. **Analyze existing tasks**
   - Count tasks where `passes: false` (incomplete tasks)
   - Count tasks in `kanban-progress.json` (tasks with active work)
   - Separate tasks by status: in-progress (`passes: false` + entry exists) vs code-review (`passes: true` + `status != "completed"`)

4. **Warn if incomplete work exists**

```
IF kanban-board.json exists:
  incomplete_count = count tasks where passes == false
  progress_entries = Object.keys(kanban-progress.json)
  in_progress_count = count entries where task.passes == false && entry exists
  in_review_count = count entries where task.passes == true && status != "completed"

  IF incomplete_count > 0 OR progress_entries.length > 0:
    THEN:
      - Output: "WARNING: Existing kanban board detected with incomplete work!"
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

## Logs Directory Clearing

Before creating a new kanban board, offer to clear the existing logs directory to start fresh.

### Check Steps

1. **Check if `.kanban/worker-logs/` directory exists and has files**
   - Use Glob to check for `.kanban/worker-logs/*`
   - If directory is empty or doesn't exist -> skip this section
   - If files exist -> continue to step 2

2. **Prompt user for clearing**
   - Use AskUserQuestion tool:
     - Question: "Clear existing worker-logs directory before creating new board?"
     - Options:
       - "Yes, clear logs" - Delete all files in `.kanban/worker-logs/`
       - "No, keep logs" - Preserve existing log files

3. **Execute clearing if requested**
   - If user selects "Yes, clear logs":
     - Delete all files in `.kanban/worker-logs/` directory
     - Keep the directory itself
     - Output: "Cleared .kanban/worker-logs/ directory"
   - If user selects "No, keep logs":
     - Output: "Preserving existing log files"

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
  "blockedBy": string[], // Task names that must complete first
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

Task status is derived from: `passes` field in kanban-board.json and `status` field in kanban-progress.json:

| passes  | In progress.json | status          | Derived Status  |
| ------- | ---------------- | --------------- | --------------- |
| `false` | No               | -               | **pending**     |
| `false` | Yes              | any             | **in-progress** |
| `false` | Yes              | `blocked`       | **blocked**     |
| `true`  | Yes              | NOT `completed` | **code-review** |
| `true`  | Yes              | `completed`     | **completed**   |
| `true`  | No               | -               | **completed**   |

---

## Interactive Workflow

This skill follows a 5-phase interactive workflow:

```
Phase 1: Discovery        -> Explore codebase, understand what exists
Phase 2: Requirements     -> Ask user questions, gather preferences
Phase 3: Summary          -> Present findings and proposed approach
Phase 4: Task Generation  -> Generate specific, deterministic tasks
Phase 5: Iteration        -> Review with user, refine until approved
```

**CRITICAL**: Files are ONLY written after explicit user approval in Phase 5. Until then, the board exists only in conversation.

---

### Phase 1: Deep Discovery

**Purpose**: Understand the current state of the codebase before planning any changes.

#### 1.1 Detect Project Type

Examine key files to detect the project type:

```
# Package manager / language
Glob: package.json, requirements.txt, go.mod, Cargo.toml, pom.xml, build.gradle

# Frameworks
Glob: nuxt.config.*, next.config.*, vite.config.*, angular.json, vue.config.*
Glob: manage.py, app.py, main.py, Gemfile, composer.json

# Project documentation
Read: README.md, CLAUDE.md (if exists)
```

#### 1.2 Identify Architecture Patterns

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

#### 1.3 Search for Related Existing Code

Use Grep to find code related to the feature using keywords from the feature description:

```
Grep: [relevant keywords from feature description]
```

Look for:

- Similar features already implemented
- Patterns to follow for consistency
- Components or utilities that can be reused

#### 1.4 Deep Codebase Analysis with Explore Agent

Use the Task tool with `subagent_type="Explore"` for comprehensive analysis:

```
Task tool with:
- subagent_type: "Explore"
- prompt: "Find all files related to [feature keywords]. Analyze:
  1. Existing implementations of similar features
  2. Patterns used for comparable functionality
  3. Components and utilities available for reuse
  4. Integration points (stores, APIs, types) the new feature will connect to
  5. Any partial implementations that should not be duplicated"
```

#### 1.5 Discovery Output

Compile internal notes about:

- What exists (related code, similar features)
- Patterns to follow (how similar things are done)
- Components to reuse (existing utilities, stores, types)
- Integration points (what the new feature connects to)
- Partial implementations (to avoid duplication)

---

### Phase 2: Requirements Gathering

**Purpose**: Ask smart, relevant questions to pin down exact implementation details.

**Principle**: Questions are good. Don't be afraid to ask. The more clarity upfront, the more deterministic the output.

#### Question Strategy

- Questions are **dynamically generated** based on discovery findings
- Only ask what's relevant to THIS specific feature
- Each question should resolve an ambiguity or decision point
- Always include "Other - let me specify" as an option where appropriate

#### Question Categories

Ask questions from these categories as relevant to the feature:

**1. Scope and Boundaries**

- What's the MVP vs nice-to-have?
- Any features explicitly NOT wanted?
- Time or complexity constraints?

**2. Implementation Approach** (based on discovered options)

- If multiple patterns found: "How should X be implemented? We have Y pattern in fileA and Z pattern in fileB"
- UI decisions: modal vs page, inline vs separate component
- Technical decisions: polling vs websockets, local state vs store, client-side vs server-side

**3. Integration Decisions** (based on discovered components)

- Which existing components to reuse vs create new?
- How should this connect to existing features?
- Should this extend existing functionality or be standalone?

**4. Data and API Design**

- What fields/properties are needed? (list explicitly)
- What endpoints with what exact paths?
- What error cases to handle?
- Validation rules?

**5. UI/UX Preferences**

- Layout preferences (location, size, arrangement)
- Interaction patterns (click, hover, drag)
- Responsive behavior requirements
- Accessibility requirements

#### Implementation

Use `AskUserQuestion` tool with options. Questions can be batched (2-4 per interaction for efficiency).

Example question format:

```
Question: "Based on the existing auth flow in `client/features/auth/`, how should login errors be displayed?"
Options:
- "Toast notification (like current signup flow)"
- "Inline error below form field (like password reset)"
- "Modal dialog"
- "Other - let me specify"
```

#### Capturing Answers

Record each answer to form the basis of locked implementation decisions in Phase 4.

---

### Phase 3: Summary and Confirmation

**Purpose**: Ensure alignment before generating tasks by presenting all findings and proposed approach.

#### Present Discovery Summary

Output a structured summary to the user:

```markdown
## Discovery Summary

### Project Context

- **Type**: [detected project type, e.g., Nuxt 4 with FSD architecture]
- **Relevant directories**: [key paths discovered]

### What Currently Exists

- [List of related existing code/features found]
- [Components available for reuse]
- [Patterns already established]

### How Related Flows Work

- [Brief explanation of relevant existing patterns]
- [Key integration points identified]

### Proposed Approach

Based on your requirements:

- [Approach decision 1 - from user answers]
- [Approach decision 2 - from user answers]
- [Technical choice - from user answers]

### Integration Points

Will integrate with:

- [Component/API 1]
- [Component/API 2]
- [Store/Type 3]

### Out of Scope (per your input)

- [Items explicitly excluded]
```

#### Confirmation

Use AskUserQuestion:

```
Question: "Does this summary accurately capture your requirements and the proposed approach?"
Options:
- "Yes, proceed to task generation"
- "No, I need to clarify something"
- "Start over with different requirements"
```

If "No, I need to clarify something":

- Ask what needs clarification
- Update the summary
- Re-present and ask for confirmation again

If "Start over":

- Return to Phase 2 with fresh questions

---

### Phase 4: Task Generation

**Purpose**: Generate specific, deterministic tasks based on locked-in requirements from Phases 1-3.

#### 4.1 Categorize Feature Requirements

Break down the feature into these universal categories:

| Category      | Description                                      |
| ------------- | ------------------------------------------------ |
| `data`        | Database schemas, models, data structures        |
| `api`         | Backend endpoints, services, business logic      |
| `ui`          | User interface components and styling            |
| `integration` | Connecting different parts, third-party services |
| `config`      | Configuration, environment, setup                |
| `testing`     | Test cases and validation                        |

#### 4.2 Generate Task List with Locked Details

For each requirement, create a task with **deterministic naming** and **explicit implementation details**:

```json
{
  "name": "exact-task-name",
  "description": "## Task Description\n\n[What to implement]\n\n## Implementation Approach (LOCKED)\n\n- Use pattern from: `exact/path/to/reference/file.ts`\n- Create file at: `exact/path/to/new/file.ts`\n- Follow naming: `exactFunctionName`\n\n## API Contract (LOCKED)\n\n[From user answers in Phase 2]\n\n## Steps\n\n[Sequential verification steps]",
  "category": "data|api|ui|integration|config|testing",
  "blockedBy": [],
  "steps": ["Step 1", "Step 2"],
  "passes": false
}
```

**Key principles for task generation**:

1. **Deterministic Naming**: Task names follow strict conventions based on user answers
2. **Explicit Implementation Details**: Include specific file paths, function signatures
3. **Locked API Contracts**: Based on user answers from Phase 2, not AI decisions
4. **Reference Existing Code**: Point to specific files to follow patterns from

#### 4.3 Identify Dependencies (blockedBy)

For each task, determine its `blockedBy` list by analyzing what types, stores, or APIs it needs:

| Task Category | Typically Depends On | blockedBy Examples               |
| ------------- | -------------------- | -------------------------------- |
| `data`        | Usually none         | `[]` (foundation layer)          |
| `config`      | Usually none         | `[]` (foundation layer)          |
| `api`         | Data schemas         | `["user-schema", "file-schema"]` |
| `integration` | APIs, data           | `["user-api", "auth-service"]`   |
| `ui`          | Stores, types, APIs  | `["user-store", "chat-api"]`     |
| `testing`     | Features to test     | `["user-api", "profile-page"]`   |

**Analysis Process** for each task:

1. **Identify what the task needs** - What types, stores, or APIs does it use?
2. **Find which tasks provide those** - Match needs to other task outputs
3. **Set blockedBy** - List task names that must complete first

**Task Name Convention**: Use descriptive, kebab-case names:

- `create-user-schema`
- `user-crud-endpoints`
- `profile-page-component`
- `connect-auth-service`
- `setup-database-config`
- `user-api-tests`

#### 4.4 Add Explicit API Contracts (CRITICAL)

**IMPORTANT**: To prevent client-server miscoordination, every API task MUST include an explicit contract section. UI tasks that depend on APIs MUST reference this contract.

**For API Tasks** - Add a "## API Contract" section:

```markdown
## API Contract

- **Endpoint**: `POST /api/chat/invitations`
- **Request Body**: `{ toEmail: string }`
- **Response (200)**: `{ id: number, toUserId: number, status: string }`
- **Errors**:
  - 400: Invalid email format
  - 401: Not authenticated
  - 404: User not found
  - 409: Invitation already exists
```

**For UI Tasks That Use APIs** - Add a "## API Dependencies" section:

```markdown
## API Dependencies

This component uses the following API endpoints from `chat-invitation-api`:

- `POST /api/chat/invitations` - Send invitation
  - Request: `{ toEmail: string }`
  - Response: `{ id, toUserId, status }`

**IMPORTANT**: Read the API task's affected files FIRST to verify the exact endpoint path and request/response format before implementing.
```

**Why This Matters**: Without explicit contracts, API workers might create endpoints at `/api/chat/invite` while UI workers assume `/api/chat/invitations`, resulting in 404 errors despite both tasks "passing".

#### 4.5 Auto-Generate E2E Integration Test Task

**When to Generate**: Generate an `e2e-integration-test` task if:

- There is at least one `api` category task AND
- There is at least one `ui` category task that depends on the API

**E2E Task Template**:

```json
{
  "name": "e2e-integration-test",
  "description": "## End-to-End Integration Test\n\nValidate that all client-server interactions work correctly after implementation.\n\n### Purpose\nThis task catches integration bugs that unit tests miss, such as:\n- Endpoint path mismatches (client calls wrong URL)\n- Request/response format mismatches\n- Authentication flow issues\n\n### Test Approach\n1. Start the dev server\n2. Test each API endpoint with actual HTTP requests\n3. Verify UI components make correct API calls\n4. Check error handling for edge cases",
  "category": "testing",
  "blockedBy": ["<all-ui-task-names>"],
  "steps": [
    "Start the development server with npm run dev",
    "Open browser DevTools Network tab",
    "Navigate through each feature UI that calls an API",
    "Verify each API request URL matches the expected endpoint",
    "Verify each request body contains correct field names",
    "Verify each response is parsed correctly by the UI",
    "Test error cases (invalid input, network errors)",
    "Verify no 404 or 500 errors in the Network tab"
  ],
  "passes": false
}
```

The `blockedBy` array should list ALL `ui` category tasks from this feature.

---

### Phase 5: Iteration and Approval

**Purpose**: Allow unlimited refinement rounds until user explicitly approves the board.

**CRITICAL**: Files are ONLY written after explicit "Approve and create board" selection. Until then, the board exists only in conversation.

#### Presentation Format

Present the proposed board in this format:

```markdown
## Proposed Kanban Board

**Project**: [Feature Name]
**Tasks**: [N total]
**Categories**: [data: X, api: Y, ui: Z, testing: W]

### Task Overview

| #   | Task Name            | Category | Depends On  |
| --- | -------------------- | -------- | ----------- |
| 1   | task-name-1          | data     | -           |
| 2   | task-name-2          | api      | task-name-1 |
| 3   | task-name-3          | ui       | task-name-2 |
| 4   | e2e-integration-test | testing  | task-name-3 |

### Task Details

**1. task-name-1** (data)

> [First 2-3 lines of description]

- **Files**: `exact/path/to/create.ts`
- **Pattern from**: `existing/reference/file.ts`

**2. task-name-2** (api)

> [First 2-3 lines of description]

- **Endpoint**: `POST /api/exact/path`
- **Depends on**: task-name-1

**3. task-name-3** (ui)

> [First 2-3 lines of description]

- **Files**: `client/pages/feature.vue`
- **Uses API**: task-name-2

[...repeat for each task...]
```

#### Iteration Flow

1. **Present board summary** (table + details as shown above)

2. **Ask for review** using AskUserQuestion:

   ```
   Question: "Review the kanban board above. What would you like to do?"
   Options:
   - "Approve and create board"
   - "Add more tasks"
   - "Remove tasks"
   - "Modify a task"
   - "Change task order/dependencies"
   - "Start over from requirements"
   ```

3. **Handle each response**:

   **"Approve and create board"**:
   - Write `.kanban/kanban-board.json`
   - Write `.kanban/kanban-progress.json` (empty: `{}`)
   - Output success message with next steps
   - DONE

   **"Add more tasks"**:
   - Ask: "What additional tasks should be added?"
   - Generate new tasks based on response
   - Re-present updated board
   - Return to step 2

   **"Remove tasks"**:
   - Ask: "Which tasks should be removed? (provide task names or numbers)"
   - Remove specified tasks
   - Update blockedBy references in remaining tasks
   - Re-present updated board
   - Return to step 2

   **"Modify a task"**:
   - Ask: "Which task do you want to modify? (provide task name or number)"
   - Then ask: "What should be changed about this task?"
   - Update the task based on response
   - Re-present updated board
   - Return to step 2

   **"Change task order/dependencies"**:
   - Ask: "What changes to the order or dependencies?"
   - Update blockedBy fields as specified
   - Re-present updated board
   - Return to step 2

   **"Start over from requirements"**:
   - Clear current board state
   - Return to Phase 2 (Requirements Gathering)
   - Begin fresh question session

4. **Loop continues** until "Approve and create board" is selected

#### Exit Conditions

- **User selects "Approve and create board"**: Write files, skill complete
- **User selects "Start over from requirements"**: Clear state, return to Phase 2
- **User abandons conversation**: Nothing written, no changes made

---

## Example Task Breakdown

### Example: User Profile Feature (Interactive Result)

After completing Phases 1-4 for "create user profile page with avatar upload":

```json
{
  "project": "User Profile Page with Avatar Upload",
  "created": "2024-01-15T10:30:00Z",
  "projectType": "nuxt",
  "tasks": [
    {
      "name": "user-profile-api",
      "description": "## User Profile API Endpoint\n\nCreate a GET endpoint at `/api/users/profile` that returns the authenticated user's profile data.\n\n## Implementation Approach (LOCKED)\n\n- Use pattern from: `server/api/auth/login.post.ts`\n- Create file at: `server/api/users/profile.get.ts`\n- Follow auth middleware pattern from existing endpoints\n\n## API Contract (LOCKED)\n\n- **Endpoint**: `GET /api/users/profile`\n- **Request**: No body (authentication via cookie)\n- **Response (200)**: `{ id: number, name: string, email: string, avatarUrl: string | null }`\n- **Errors**:\n  - 401: Not authenticated\n  - 404: User not found in database",
      "category": "api",
      "blockedBy": [],
      "steps": [
        "Start the development server with npm run dev",
        "Open a terminal or API testing tool",
        "Send GET request to http://localhost:3000/api/users/profile without auth cookie",
        "Verify response status is 401 Unauthorized",
        "Log in via /api/auth/login to get auth cookie",
        "Send GET request to /api/users/profile with auth cookie",
        "Verify response status is 200",
        "Verify response body contains id, name, email, and avatarUrl fields"
      ],
      "passes": false
    },
    {
      "name": "avatar-upload-api",
      "description": "## Avatar Upload API Endpoint\n\nCreate a POST endpoint for uploading user avatars.\n\n## Implementation Approach (LOCKED)\n\n- Use pattern from: `server/api/files/upload.post.ts`\n- Create file at: `server/api/users/avatar.post.ts`\n- Store files in: `public/uploads/avatars/`\n- File naming: `{userId}-{timestamp}.{ext}`\n\n## API Contract (LOCKED)\n\n- **Endpoint**: `POST /api/users/avatar`\n- **Request**: `multipart/form-data` with `avatar` file field\n- **Response (200)**: `{ avatarUrl: string }`\n- **Validation**: Max 2MB, image/jpeg or image/png only\n- **Errors**:\n  - 400: Invalid file type or size\n  - 401: Not authenticated",
      "category": "api",
      "blockedBy": [],
      "steps": [
        "Start the development server",
        "Log in to get auth cookie",
        "Send POST to /api/users/avatar with a 3MB file",
        "Verify response is 400 with size error",
        "Send POST with a .txt file",
        "Verify response is 400 with type error",
        "Send POST with valid 1MB JPEG",
        "Verify response is 200 with avatarUrl",
        "Verify file exists at the returned URL path"
      ],
      "passes": false
    },
    {
      "name": "profile-page-ui",
      "description": "## Profile Page Component\n\nCreate a Vue page displaying user profile with edit capability.\n\n## Implementation Approach (LOCKED)\n\n- Use pattern from: `client/pages/settings.vue`\n- Create file at: `client/pages/profile.vue`\n- Use existing `UiAvatar` component from `client/shared/ui/`\n- Use `useAuthStore` for user state\n\n## Layout (LOCKED per user requirements)\n\n- Centered card layout (max-w-md)\n- Avatar: 128px, clickable for upload\n- Name and email below avatar\n- \"Edit Profile\" button opens inline form (not modal)\n\n## API Dependencies\n\n- `GET /api/users/profile` from `user-profile-api`\n- `POST /api/users/avatar` from `avatar-upload-api`\n\n**IMPORTANT**: Read API task affected files to verify exact response format.",
      "category": "ui",
      "blockedBy": ["user-profile-api", "avatar-upload-api"],
      "steps": [
        "Start the development server with npm run dev",
        "Log in to the application",
        "Navigate to /profile in the browser",
        "Verify page loads without console errors",
        "Verify avatar displays centered at 128px",
        "Verify name and email display below avatar",
        "Click on the avatar",
        "Verify file picker opens",
        "Select a valid image file",
        "Verify avatar updates after upload completes",
        "Click 'Edit Profile' button",
        "Verify inline edit form appears (not modal)",
        "Modify name field and save",
        "Verify name updates on page"
      ],
      "passes": false
    },
    {
      "name": "e2e-integration-test",
      "description": "## End-to-End Integration Test\n\nValidate client-server integration for profile feature.\n\n### Purpose\nCatches integration bugs that unit tests miss:\n- Endpoint path mismatches\n- Request/response format mismatches\n- File upload handling issues",
      "category": "testing",
      "blockedBy": ["profile-page-ui"],
      "steps": [
        "Start the development server with npm run dev",
        "Open browser DevTools Network tab",
        "Log in and navigate to /profile",
        "Verify GET /api/users/profile request appears",
        "Verify request URL is exactly /api/users/profile",
        "Verify response contains id, name, email, avatarUrl",
        "Click avatar to upload new image",
        "Verify POST /api/users/avatar request appears",
        "Verify request is multipart/form-data with avatar field",
        "Verify response contains new avatarUrl",
        "Verify avatar image updates in UI",
        "Test with invalid file, verify error displayed",
        "Verify no 404 or 500 errors in Network tab"
      ],
      "passes": false
    }
  ]
}
```

---

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

---

## Notes

- **CRITICAL**: Do NOT execute if no feature description is provided
- **This skill is an interactive planning session**, not autonomous generation
- **Board is only written after explicit user approval** in Phase 5
- **Multiple iteration rounds are expected and encouraged** - refine until right
- **Questions asked during Phase 2 are dynamically generated** based on discovery findings
- The skill does NOT execute tasks - it only plans them
- User should review the board before running `kanban:process`
- Tasks are designed to be executed by specialized agents
- The `passes` field is updated by `kanban:process` after task completion
- Task status is derived from `passes` and presence in `kanban-progress.json`

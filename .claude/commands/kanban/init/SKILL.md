---
name: kanban:init
description: Initialize kanban board infrastructure in project. Creates .kanban directory, copies viewer HTML, adds npm script. Use when setting up kanban board for first time.
allowed-tools: Bash, Read, Write, Edit
---

# Init Kanban Skill

Sets up the kanban board viewer infrastructure in the project.

## Steps

Execute these steps in order:

### 1. Create .kanban Directory

```bash
mkdir -p .kanban
```

### 2. Copy Viewer Template (Always Override)

Read the template file from this skill directory and write it to the project:

- Source: `.claude/commands/kanban/init/kanban-viewer.template.html`
- Destination: `.kanban/kanban-viewer.html`

**Always overwrite** the existing file to ensure the latest template is used.

### 3. Initialize Empty Progress File (Skip if Exists)

Create an empty progress tracker at `.kanban/kanban-progress.json` **only if it doesn't exist**:

```json
{}
```

This is an object where keys are task names and values contain progress data:

```json
{
  "task-name": {
    "log": "Narrative of work done, useful for resuming context across sessions",
    "committed": false
  }
}
```

Task status is derived from:
- `passes: true` + `committed: true` in progress.json → completed
- `passes: true` + `committed: false` in progress.json → code-review
- `passes: false` + entry exists in progress.json → in-progress
- No entry in progress.json → pending

Skip this step if the file already exists to preserve progress state.

### 4. Add NPM Script

Read `package.json`, add the following script to the `scripts` object:

```json
"kanban": "start http://localhost:4150/.kanban/kanban-viewer.html && npx serve . -p 4150 --cors"
```

Use the Edit tool to add this script.

## Completion

After completing all steps, report:
- Created `.kanban/` directory
- Created `.kanban/kanban-viewer.html`
- Created `.kanban/kanban-progress.json`
- Added `kanban` script to package.json

The user can now:
1. Run `/kanban:create <feature description>` to create a kanban board
2. Run `npm run kanban` to open the kanban board viewer
3. Run `/kanban:process` to start processing tasks
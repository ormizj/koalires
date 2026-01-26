---
name: kanban:init
description: Initialize kanban board infrastructure in project. Creates .kanban directory, copies viewer HTML, adds npm script. Use when setting up kanban board for first time.
allowed-tools: Bash
---

# Init Kanban Skill

Sets up the kanban board viewer infrastructure in the project.

## Workflow

### Execute the PowerShell Script

Run the kanban-init script:

```bash
powershell -ExecutionPolicy Bypass -File ".claude/commands/kanban/init/scripts/kanban-init.ps1"
```

The script handles:

- Creating `.kanban/` and `.kanban/worker-logs/` directories
- Copying `kanban-unit-tester.md` agent to `.claude/agents/`
- Copying viewer template to `.kanban/kanban-viewer/`
- Initializing `kanban-board.json` and `kanban-progress.json`
- Adding `kanban` npm script to `package.json`

### Step 8: Verify Test Infrastructure

After the PowerShell script completes, always run the verify-tests sub-skill:

```
/kanban:init:verify-tests
```

This ensures testing is ready for the kanban TDD workflow. The verify-tests skill will:

1. Detect the existing test framework (Vitest, Jest, pytest, etc.)
2. Validate the configuration and dependencies
3. Offer to set up missing infrastructure if needed

## After Initialization

The user can now:

1. Run `/kanban:create <feature description>` to create a kanban board
2. Run `npm run kanban` to open the kanban board viewer
3. Run `/kanban:process` to start processing tasks

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
- Copying kanban agents to `.claude/agents/`:
  - `kanban-unit-tester.md` - TDD specialist for pre-implementation tests
  - `kanban-command-updater.md` - Kanban command maintenance specialist
- Copying viewer template to `.kanban/kanban-viewer/`
- Initializing `kanban-board.json`, `kanban-progress.json`, and `config.json` (with `postProcessRules` for the detected project type)
- Adding kanban script to the project's package manager configuration

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

**Important:** New agents were added to `.claude/agents/`:

- `kanban-unit-tester.md` - TDD specialist for creating pre-implementation tests
- `kanban-command-updater.md` - Specialist for maintaining/extending kanban commands

Claude Code must be restarted to recognize new agents. Exit this session and start a new one before using kanban workflows.

The user can now:

1. Run `/kanban:create <feature description>` to start an **interactive planning session**
   - This explores the codebase first, then asks clarifying questions
   - The board is only created after explicit user approval
   - Multiple iteration rounds are supported
2. Run `npm run kanban` to open the kanban board viewer
3. Run `/kanban:process` to start processing tasks

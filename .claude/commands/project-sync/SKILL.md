# Project Sync Command

Run comprehensive project validation and documentation synchronization by executing three skills in sequence.

## Overview

This command orchestrates a complete project sync by running:

1. `/architecture-check` - Validate FSD architecture against rules
2. `/sync-agents` - Update CLAUDE.md agent documentation
3. `/sync-claude-md` - Validate CLAUDE.md structure

## Workflow

### Execute the PowerShell Script

Run the project-sync script which spawns three separate `claude -p` processes:

```bash
powershell -ExecutionPolicy Bypass -File ".claude/commands/project-sync/scripts/project-sync.ps1"
```

The script handles:

- Sequential execution of each skill
- Progress output with phase indicators
- Exit code checking for each phase
- Color-coded status messages

## When to Use

- After adding new agents to `.claude/agents/`
- After modifying architecture rules in `.claude/rules/`
- Before major commits to ensure documentation is current
- During code review to validate project structure
- After refactoring to verify FSD compliance
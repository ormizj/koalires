# Project Validate Fix Command

Run comprehensive project validation and fixes by executing four skills in sequence.

## Overview

This command validates and fixes the project by running:

1. `/lint` - Run Prettier, ESLint, and TypeScript checks with auto-fix
2. `/architecture-check` - Validate FSD architecture against rules
3. `/sync-agents` - Update CLAUDE.md agent documentation
4. `/sync-claude-md` - Validate CLAUDE.md structure

## Workflow

### Execute the PowerShell Script

Run the project-validate-fix script which spawns four separate `claude -p` processes:

```bash
powershell -ExecutionPolicy Bypass -File ".claude/commands/project-validate-fix/scripts/project-validate-fix.ps1"
```

The script handles:

- Sequential execution of each skill
- Progress output with phase indicators
- Exit code checking for each phase
- Color-coded status messages

## When to Use

- After making code changes to ensure lint passes
- After adding new agents to `.claude/agents/`
- After modifying architecture rules in `.claude/rules/`
- Before major commits to ensure documentation is current
- During code review to validate project structure
- After refactoring to verify FSD compliance

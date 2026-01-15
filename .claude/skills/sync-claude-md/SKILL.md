---
name: sync-claude-md
description: Update CLAUDE.md project instructions file. Use when documenting new patterns, conventions, commands, or architecture changes. Validates structure and places content in appropriate sections.
allowed-tools: Read, Edit, Glob, Grep
---

# Sync CLAUDE.md Skill

Update and maintain the CLAUDE.md project instructions file while preserving structure integrity and ensuring content is placed in the appropriate sections.

## When to Use

- Adding new project conventions or patterns
- Documenting new commands or scripts
- Updating architecture information
- Adding new key conventions
- Modifying project overview details
- Any changes to project-level documentation that Claude should know

## CLAUDE.md Structure Reference

The CLAUDE.md file has the following standard sections in order:

| Section                      | Purpose                                            |
| ---------------------------- | -------------------------------------------------- |
| `## Project Overview`        | High-level description of the project              |
| `## Commands`                | npm/build commands with descriptions               |
| `## Architecture`            | Directory structure and key files                  |
| `## Key Conventions`         | Auto-imports, routing, TypeScript settings         |
| `## Implementation Rules`    | Agent delegation rules (managed by `sync-agents`)  |
| `## Available Agents`        | Agent table (managed by `sync-agents`)             |
| `## Agent Selection Guidelines` | When to use which agent (managed by `sync-agents`) |

**Important:** The last three sections (Implementation Rules, Available Agents, Agent Selection Guidelines) are managed by the `sync-agents` skill. Do not modify these sections with this skill.

---

## Workflow

### Step 1: Read Current CLAUDE.md

```
Read: CLAUDE.md
```

Understand the current structure and content of each section.

### Step 2: Identify Target Section

Based on the user's request, determine which section needs updating:

| Change Type               | Target Section         |
| ------------------------- | ---------------------- |
| Project description       | `## Project Overview`  |
| npm scripts, build tools  | `## Commands`          |
| Directory structure       | `## Architecture`      |
| Auto-imports, conventions | `## Key Conventions`   |

### Step 3: Validate the Change

Before making changes, verify:

1. **Section exists** - The target section is present in CLAUDE.md
2. **No duplicates** - The content being added doesn't already exist
3. **Correct section** - The content belongs in the identified section
4. **Format consistency** - The new content matches existing format

### Step 4: Apply the Update

Use the Edit tool to update the appropriate section:

```
Edit: CLAUDE.md
old_string: <existing section content>
new_string: <updated section content>
```

Rules for editing:

1. Preserve section ordering
2. Match existing formatting (bullet points, code blocks, bold text)
3. Keep content concise and actionable
4. Use consistent markdown formatting

### Step 5: Generate Report

Output a summary of changes:

```
============================================
CLAUDE.md Update Report
============================================

Section Updated: ## <Section Name>

Changes Made:
-------------
- Added: <description of addition>
- Modified: <description of modification>
- Removed: <description of removal>

Before:
-------
<relevant snippet before change>

After:
------
<relevant snippet after change>

============================================
CLAUDE.md has been updated successfully
============================================
```

---

## Section-Specific Guidelines

### Project Overview

- Keep it to 1-2 sentences
- Include tech stack (Nuxt version, Vue version, TypeScript)
- Mention the project name (Koalires)

Example format:
```markdown
## Project Overview

Koalires is a Nuxt 4 application built with Vue 3 and TypeScript.
```

### Commands

- Use bash code blocks
- Include comment above each command explaining what it does
- Group related commands together
- Standard commands: install, dev, build, preview, generate

Example format:
```markdown
## Commands

\`\`\`bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev
\`\`\`
```

### Architecture

- Start with a brief intro sentence
- Use bullet points for directory descriptions
- Bold the path names
- Include purpose for each directory/file

Example format:
```markdown
## Architecture

This is a Nuxt 4 project using the `app/` directory structure:

- **app/app.vue** - Root Vue component (entry point)
- **app/pages/** - File-based routing (create files here for new routes)
```

### Key Conventions

- Use bullet points with bold labels
- Explain the "what" and "why" briefly
- Focus on things Claude needs to know when working with code

Example format:
```markdown
## Key Conventions

- **Auto-imports**: Components in `app/components/` and composables in `app/composables/` are automatically imported
- **File-based routing**: Files in `app/pages/` automatically become routes
```

---

## Validation Checks

After updating, verify:

- [ ] Section headers are properly formatted (`## Section Name`)
- [ ] Content is placed in the correct section
- [ ] No duplicate information across sections
- [ ] Markdown formatting is consistent
- [ ] Code blocks have language hints (bash, typescript, etc.)
- [ ] File paths use backticks for inline code
- [ ] Agent-managed sections (Implementation Rules, Available Agents, Agent Selection Guidelines) are untouched

---

## Common Operations

### Adding a New Command

```
Target: ## Commands section
Action: Add new command with comment in the bash code block

Example:
# Type check the project
npm run typecheck
```

### Updating Architecture

```
Target: ## Architecture section
Action: Add new directory or file entry

Example:
- **app/middleware/** - Route middleware for authentication and guards
```

### Adding a New Convention

```
Target: ## Key Conventions section
Action: Add new bullet point with bold label

Example:
- **Middleware**: Custom middleware in `app/middleware/` runs before route navigation
```

### Updating Project Overview

```
Target: ## Project Overview section
Action: Modify the description paragraph

Note: Keep concise, mention key technologies
```

---

## Notes

- This skill handles the non-agent sections of CLAUDE.md
- For agent-related updates, use the `sync-agents` skill instead
- Always read CLAUDE.md before making changes to ensure accurate edits
- Preserve the existing section order when making updates
- When uncertain about placement, ask the user for clarification
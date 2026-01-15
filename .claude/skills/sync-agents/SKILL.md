---
name: sync-agents
description: Scan .claude/agents/ for agent definitions and update CLAUDE.md to ensure all agents are documented in Implementation Rules and Available Agents sections. Use when adding new agents or auditing agent documentation.
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# Sync Agents Skill

Synchronize agent documentation in CLAUDE.md with the actual agent definitions in `.claude/agents/`. This skill ensures all specialized agents are properly documented and delegation rules are complete.

## Workflow

### Step 1: Discover All Agent Definitions

Find all agent definition files in the `.claude/agents/` directory:

```
Glob: .claude/agents/**/*.md
```

This discovers all markdown agent definition files.

### Step 2: Parse Agent Metadata

For each discovered agent file, read and extract the YAML frontmatter:

```yaml
---
name: <agent-name> # The agent identifier
description: <description> # When to use this agent
tools: <tools> # What tools the agent can use
model: <model> # Model configuration
---
```

Extract the following for each agent:

- `name` - The agent identifier (used in Task tool calls)
- `description` - What the agent does and when to use it
- Primary domain/specialty (inferred from description)

### Step 3: Categorize Agents

Group agents into categories based on their specialization:

| Category           | Agent Types                              |
| ------------------ | ---------------------------------------- |
| **Frontend**       | Vue/Nuxt, UI design, FSD architecture    |
| **Backend**        | APIs, databases, server-side logic       |
| **Real-time**      | WebSocket, live communication            |
| **Coordination**   | Multi-agent orchestration, organization  |
| **Documentation**  | Context management, documenting patterns |
| **Quality**        | Linting, architecture validation         |
| **Skill Creation** | Creating new CLAUDE skills               |

### Step 4: Read Current CLAUDE.md

Read the existing CLAUDE.md file:

```
Read: CLAUDE.md
```

Identify the current:

- `## Implementation Rules` section
- `## Available Agents` table
- `## Agent Selection Guidelines` section

### Step 5: Generate Updated Sections

#### Implementation Rules Section

Generate the updated Implementation Rules section using this exact format:

```markdown
## Implementation Rules

- **MANDATORY**: All implementation tasks MUST be delegated to specialized subagents:
  - Frontend Vue/Nuxt work -> `vue-expert`
  - Backend API/server work -> `backend-developer`
  - UI/visual design work -> `ui-designer`
  - WebSocket/real-time features -> `websocket-engineer`
  - FSD architecture validation -> `fsd-architecture-guardian`
  - ESLint/linting issues -> `eslint-guardian`
  - [Additional mappings for any new agents...]
  - Do NOT implement code directly. Only use Edit/Write for trivial single-line fixes.
```

Rules for generating mappings:

1. Each agent with a clear implementation domain gets a mapping line
2. Format: `- <Domain description> -> \`<agent-name>\``
3. Order: Frontend agents first, then Backend, then specialized, then coordination
4. Always end with the "Do NOT implement code directly" reminder

#### Available Agents Table

Generate the updated Available Agents table:

```markdown
## Available Agents

| Agent        | When to Use                                   |
| ------------ | --------------------------------------------- |
| `agent-name` | Concise description of when to use this agent |
```

Rules for the table:

1. Use backticks around agent names
2. Description should be actionable (what triggers use of this agent)
3. Keep descriptions under 100 characters when possible
4. Group by category (Frontend, Backend, Coordination, etc.) but present as single flat table
5. Include ALL agents discovered in Step 1

#### Agent Selection Guidelines

Generate numbered guidelines that help users choose the right agent:

```markdown
## Agent Selection Guidelines

1. **For Vue/Nuxt frontend work**: Use `vue-expert`
2. **For backend/API work**: Use `backend-developer`
   [... additional guidelines based on discovered agents ...]
   N. **For codebase exploration**: Use `Explore` agent (built-in)
   N+1. **For planning complex features**: Use `Plan` agent (built-in)
   N+2. **When uncertain**: Ask the user for clarification
```

### Step 6: Update CLAUDE.md

Use the Edit tool to update each section in CLAUDE.md:

1. Replace the `## Implementation Rules` section with the generated content
2. Replace the `## Available Agents` table with the generated table
3. Replace the `## Agent Selection Guidelines` section with the generated guidelines

### Step 7: Generate Report

Output a summary of changes:

```
============================================
Agent Documentation Sync Report
============================================

Agents Discovered: X
- agent-name-1 (category)
- agent-name-2 (category)
...

Changes Made to CLAUDE.md:
--------------------------
[x] Updated Implementation Rules (added Y new delegation mappings)
[x] Updated Available Agents table (Z agents total)
[x] Updated Agent Selection Guidelines (N guidelines)

New Agents Added:
-----------------
- agent-name: Brief description

Agents Removed (no longer in .claude/agents/):
----------------------------------------------
- old-agent-name (if any)

============================================
CLAUDE.md is now in sync with agent definitions
============================================
```

---

## Agent-to-Mapping Reference

Use this reference to generate appropriate delegation mappings:

| Agent Name                  | Delegation Mapping               |
| --------------------------- | -------------------------------- |
| `vue-expert`                | Frontend Vue/Nuxt work           |
| `backend-developer`         | Backend API/server work          |
| `ui-designer`               | UI/visual design work            |
| `websocket-engineer`        | WebSocket/real-time features     |
| `fsd-architecture-guardian` | FSD architecture validation      |
| `eslint-guardian`           | ESLint/linting verification      |
| `context-manager`           | Context storage/retrieval        |
| `context-documenter`        | Updating CLAUDE.md documentation |
| `agent-organizer`           | Multi-agent team assembly        |
| `multi-agent-coordinator`   | Complex workflow orchestration   |
| `claude-skill-creator`      | Creating CLAUDE skills           |

For agents not in this table, infer the mapping from their description field.

---

## Execution Instructions

When this skill is invoked:

1. **Discover agents first:**

   ```
   Glob: .claude/agents/**/*.md
   ```

2. **Read each agent file to extract:**
   - name (from frontmatter)
   - description (from frontmatter)
   - primary specialty (inferred)

3. **Read current CLAUDE.md:**

   ```
   Read: CLAUDE.md
   ```

4. **Generate updated sections** following the format specifications above

5. **Apply updates** using Edit tool for each section

6. **Report results** showing what was discovered and changed

---

## Validation Checks

After updating, verify:

- [ ] All agents in `.claude/agents/` appear in Available Agents table
- [ ] All implementation-focused agents have delegation mappings
- [ ] Agent Selection Guidelines covers all primary use cases
- [ ] No duplicate entries in any section
- [ ] Formatting is consistent (backticks, arrow notation, etc.)

---

## Notes

- This skill should be run after adding new agents to `.claude/agents/`
- Built-in agents (Explore, Plan) are always included in guidelines but not in the Available Agents table
- The skill preserves other sections of CLAUDE.md (Project Overview, Commands, Architecture, etc.)
- Only the three agent-related sections are modified

---
name: architecture-check
description: Validate project architecture against rules in .claude/rules/. Use when checking code structure, before commits, or during review.
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# Architecture Validation Skill

Validate project architecture and code patterns against the rules defined in `.claude/rules/`. This skill dynamically reads all rule files and checks the codebase for compliance.

## Workflow

### Step 1: Discover Rule Files

Find all rule files in the `.claude/rules/` directory:

```
Glob: .claude/rules/**/*.md
```

This will discover all markdown rule files organized by category (e.g., `frontend/`, `backend/`, `general.md`).

### Step 2: Read and Parse Rules

For each discovered rule file:

1. Read the file contents using the Read tool
2. Understand the architectural rules and patterns described
3. Identify what needs to be validated:
   - Directory structure requirements
   - Import/export patterns
   - Naming conventions
   - Code organization rules
   - Forbidden patterns

### Step 3: Map Rules to Validation Checks

Based on the rules content, determine what checks to perform:

| Rule Type | How to Validate |
|-----------|-----------------|
| Directory structure | Glob for expected directories, flag missing/extra |
| Import hierarchy | Grep imports, verify layer compliance |
| Public API (index.ts) | Check cross-module imports use public API |
| Naming conventions | Grep/Glob for pattern violations |
| Forbidden patterns | Grep for disallowed code patterns |
| Required patterns | Grep to verify required patterns exist |

### Step 4: Execute Validation

For each rule category:

1. **Structural Rules** - Use Glob to verify directory structure matches expected patterns
2. **Import Rules** - Use Grep to extract imports and validate against hierarchy rules
3. **Naming Rules** - Use Glob/Grep to check file and directory naming
4. **Code Pattern Rules** - Use Grep to find violations or verify compliance

### Step 5: Generate Report

Output a structured report showing:

```
============================================
Architecture Validation Report
============================================

Rules Loaded:
- .claude/rules/general.md
- .claude/rules/frontend/nuxt-fsd.md

ERRORS (must fix):
------------------
[rule-file:rule-name] file:line
  Description of violation
  Expected: <what should be>
  Found: <what was found>

WARNINGS (should fix):
----------------------
[rule-file:rule-name] file:line
  Description of issue

AUTO-FIXABLE:
-------------
- Description of what can be auto-fixed

============================================
Summary: X errors, Y warnings, Z auto-fixable
============================================
```

### Step 6: Auto-Fix (when applicable)

For violations that can be automatically corrected:

1. Missing index.ts files - Generate with appropriate exports
2. Import path issues - Normalize to correct format
3. Simple naming fixes - Rename files/directories

Use the Edit tool to apply fixes.

---

## Execution Instructions

When this skill is invoked:

1. **Always start by discovering rules:**
   ```
   Glob: .claude/rules/**/*.md
   ```

2. **Read each rule file and understand:**
   - What architectural constraints are defined
   - What patterns are required or forbidden
   - What directory structure is expected

3. **For each rule, determine the validation approach:**
   - Structure rules → Glob to check directories exist
   - Import rules → Grep to find and validate imports
   - Pattern rules → Grep to find violations

4. **Execute checks and collect violations**

5. **Present findings in the report format above**

6. **Offer to auto-fix where possible**

---

## Example: Processing FSD Rules

If `.claude/rules/frontend/nuxt-fsd.md` defines:
- Layer hierarchy: shared < entities < features < widgets < pages < app
- Public API requirement: Cross-slice imports use index.ts
- Segment naming: ui, api, model, lib, config

Then validate:
1. Grep for imports, check layer compliance
2. Grep for imports bypassing index.ts
3. Glob directories, check segment names

---

## Notes

- The skill adapts to whatever rules are defined in `.claude/rules/`
- Adding new rule files automatically extends validation coverage
- Rule files should be written clearly so the skill can parse validation requirements
- Focus on actionable feedback with specific file locations and fix suggestions

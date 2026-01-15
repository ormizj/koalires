---
name: lint
description: Run ESLint with auto-fix, then manually fix remaining issues. Use when code needs linting or before commits.
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# ESLint Lint Skill

Run ESLint to find and fix code quality issues in the Nuxt 4 project.

## Workflow

### Step 1: Run ESLint with Auto-Fix

Execute ESLint with the `--fix` flag to automatically resolve fixable issues:

```bash
npm run lint:fix
```

Capture and analyze the output. Note any files that were modified and any errors that remain.

### Step 2: Check for Remaining Issues

Run ESLint again without the fix flag to get a clean report of remaining issues:

```bash
npm run lint
```

If no issues remain, report success and stop.

### Step 3: Analyze Remaining Errors

If issues remain after auto-fix:

1. Parse the ESLint output to identify each error
2. Group errors by file and rule
3. Prioritize errors over warnings

### Step 4: Manual Fix Attempt

For each remaining error:

1. Read the affected file using the Read tool
2. Understand the ESLint rule being violated
3. Apply the appropriate fix using the Edit tool
4. Common fixes include:
   - Adding missing imports
   - Removing unused variables
   - Fixing TypeScript type errors
   - Correcting Vue component issues
   - Resolving formatting problems

### Step 5: Verify Fixes

After manual fixes, run the linter again:

```bash
npm run lint
```

Repeat Steps 3-5 if issues remain (maximum 3 iterations to prevent infinite loops).

### Step 6: Report Results

Provide a summary including:
- Number of issues auto-fixed
- Number of issues manually fixed
- Any remaining issues that could not be resolved (with explanations)

## Error Handling

- If `npm run lint` fails to execute, check that dependencies are installed (`npm install`)
- If ESLint config is missing, inform the user to run `npx nuxt prepare` first
- For errors that cannot be auto-fixed or manually resolved, provide clear explanations of what the issue is and why it requires human intervention

## Common ESLint Rules

Reference for common rules in Nuxt/Vue projects:

| Rule | Description |
|------|-------------|
| `vue/multi-word-component-names` | Component names should be multi-word |
| `@typescript-eslint/no-unused-vars` | Remove unused variables |
| `vue/no-unused-components` | Remove unused component imports |
| `@typescript-eslint/no-explicit-any` | Avoid using `any` type |
| `vue/require-default-prop` | Props should have default values |
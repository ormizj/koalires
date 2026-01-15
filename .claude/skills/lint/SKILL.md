---
name: lint
description: Run Prettier, ESLint, and TypeScript checks with auto-fix, then manually fix remaining issues. Use when code needs formatting, linting, or type validation.
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# Code Quality Skill

Run Prettier (formatting), ESLint (linting), and TypeScript (type checking) to find and fix code quality issues in the Nuxt 4 project.

## Workflow

### Step 1: Run Prettier Auto-Format

Execute Prettier to automatically format all files:

```bash
npm run format
```

Capture the output. Note any files that were formatted.

### Step 2: Run ESLint with Auto-Fix

Execute ESLint with the `--fix` flag to automatically resolve fixable linting issues:

```bash
npm run lint:fix
```

Capture and analyze the output. Note any files that were modified and any errors that remain.

### Step 3: Check for Remaining Issues

Run the full lint command which includes both TypeScript type checking and ESLint:

```bash
npm run lint
```

This command runs `nuxi typecheck && eslint .` to catch:

- TypeScript type errors
- ESLint rule violations

If no issues remain, report success and stop.

### Step 4: Analyze Remaining Errors

If issues remain after auto-fix:

1. Parse the output to identify each error
2. Group errors by type (TypeScript errors vs ESLint errors)
3. Group errors by file and rule
4. Prioritize errors over warnings

### Step 5: Manual Fix Attempt

For each remaining error:

1. Read the affected file using the Read tool
2. Understand the rule or type constraint being violated
3. Apply the appropriate fix using the Edit tool
4. Common fixes include:
   - Adding missing imports
   - Removing unused variables
   - Fixing TypeScript type errors (see Common Type Errors table)
   - Adding proper type annotations
   - Correcting Vue component issues
   - Resolving ESLint rule violations (see Common ESLint Rules table)

### Step 6: Verify Fixes

After manual fixes, run the full lint check again:

```bash
npm run lint
```

Repeat Steps 4-6 if issues remain (maximum 3 iterations to prevent infinite loops).

### Step 7: Report Results

Provide a summary including:

- Number of files formatted by Prettier
- Number of ESLint issues auto-fixed
- Number of type errors manually fixed
- Number of lint errors manually fixed
- Any remaining issues that could not be resolved (with explanations)

## Error Handling

- If `npm run format` fails, check for Prettier config issues in `.prettierrc` or `prettier.config.js`
- If `npm run lint` fails to execute, check that dependencies are installed (`npm install`)
- If ESLint config is missing, inform the user to run `npx nuxt prepare` first
- For TypeScript errors that cannot be auto-fixed:
  - Missing type definitions may require installing `@types/*` packages
  - Complex generic type issues may require refactoring
  - Module augmentation issues may require updating `*.d.ts` files
- For errors that cannot be auto-fixed or manually resolved, provide clear explanations of what the issue is and why it requires human intervention

## Common ESLint Rules

Reference for common rules in Nuxt/Vue projects:

| Rule                                 | Description                            |
| ------------------------------------ | -------------------------------------- |
| `vue/multi-word-component-names`     | Component names should be multi-word   |
| `@typescript-eslint/no-unused-vars`  | Remove unused variables                |
| `vue/no-unused-components`           | Remove unused component imports        |
| `@typescript-eslint/no-explicit-any` | Avoid using `any` type                 |
| `vue/require-default-prop`           | Props should have default values       |
| `prettier/prettier`                  | Formatting issues (usually auto-fixed) |
| `@typescript-eslint/ban-ts-comment`  | Avoid `@ts-ignore` without explanation |

## Common Type Errors

Reference for common TypeScript errors in Nuxt/Vue projects:

| Error Code | Description                    | Fix                                                |
| ---------- | ------------------------------ | -------------------------------------------------- |
| `TS2304`   | Cannot find name               | Add missing import or declare the type             |
| `TS2322`   | Type not assignable            | Fix type mismatch or add proper cast               |
| `TS2339`   | Property does not exist        | Add property to interface or use optional chaining |
| `TS2345`   | Argument type mismatch         | Correct the argument type or function signature    |
| `TS2531`   | Object is possibly null        | Add null check or use optional chaining (`?.`)     |
| `TS2551`   | Property does not exist (typo) | Fix the property name typo                         |
| `TS7006`   | Parameter has implicit any     | Add explicit type annotation                       |
| `TS18046`  | Unknown is of type unknown     | Add type guard or assertion                        |

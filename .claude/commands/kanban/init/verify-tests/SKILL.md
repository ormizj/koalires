---
name: kanban:init:verify-tests
description: Verify and setup testing infrastructure for kanban TDD workflow. Use after kanban:init to ensure test framework is configured. Detects existing frameworks or guides setup.
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Verify Tests Skill

Ensures testing infrastructure is properly configured for the kanban TDD workflow. This skill detects existing test frameworks, validates their configuration, and offers to set up missing infrastructure.

## Workflow

Execute these phases in order. Do not skip any phase.

---

## Phase 1: Detect Test Framework

Scan the project to identify what test framework is in use.

### Step 1.1: Check for Configuration Files

Use Glob to search for test configuration files:

```
vitest.config.*
jest.config.*
.mocharc.*
pytest.ini
pyproject.toml
conftest.py
*_test.go
phpunit.xml*
.rspec
playwright.config.*
cypress.config.*
```

### Step 1.2: Check package.json (for JS/TS projects)

If `package.json` exists, read it and check:

1. `scripts.test` - What command runs tests
2. `devDependencies` - Look for: vitest, jest, mocha, @testing-library/\*, @vue/test-utils
3. `dependencies` - Some projects put test deps here

### Step 1.3: Identify Framework

Based on detection, identify the framework:

| Detection                             | Framework  | Language              |
| ------------------------------------- | ---------- | --------------------- |
| `vitest.config.*` exists              | Vitest     | TypeScript/JavaScript |
| `nuxt.config.*` + vitest in deps      | Vitest     | Nuxt/Vue              |
| `vite.config.*` + vitest in deps      | Vitest     | Vite                  |
| `jest.config.*` exists                | Jest       | TypeScript/JavaScript |
| `react-scripts` in deps               | Jest (CRA) | React                 |
| `.mocharc.*` exists                   | Mocha      | JavaScript            |
| `pytest.ini` or `conftest.py`         | pytest     | Python                |
| `pyproject.toml` with `[tool.pytest]` | pytest     | Python                |
| `go.mod` + `*_test.go` files          | go test    | Go                    |
| `phpunit.xml*` exists                 | PHPUnit    | PHP                   |
| `.rspec` exists                       | RSpec      | Ruby                  |
| `playwright.config.*` exists          | Playwright | E2E                   |
| `cypress.config.*` exists             | Cypress    | E2E                   |

### Step 1.4: Report Detection Results

Output the detection results:

```
DETECTION RESULTS:
- Project Type: [nuxt/vite/react/node/python/go/unknown]
- Test Framework: [vitest/jest/pytest/go test/none detected]
- Config File: [path to config or "not found"]
- Test Command: [npm test/npx vitest/pytest/etc.]
```

---

## Phase 2: Validate Infrastructure

If a framework was detected, validate it is properly configured.

### Step 2.1: Verify Config File Exists and Is Valid

Read the detected config file and check:

- File is not empty
- File has valid syntax (no obvious errors)
- For Vitest/Jest: has `test` configuration section
- For pytest: has valid INI format

### Step 2.2: Verify Dependencies Installed

For JS/TS projects, check that test framework is in dependencies:

```bash
# Check if vitest is installed
npm list vitest 2>/dev/null || echo "vitest not installed"

# Check if jest is installed
npm list jest 2>/dev/null || echo "jest not installed"
```

For Python:

```bash
pip show pytest 2>/dev/null || echo "pytest not installed"
```

### Step 2.3: Verify Test Command Works

Run a basic test command to verify the framework is functional:

```bash
# For Vitest
npx vitest --version

# For Jest
npx jest --version

# For pytest
pytest --version
```

### Step 2.4: Check for Existing Tests

Use Glob to find existing test files:

```
**/*.test.ts
**/*.test.js
**/*.spec.ts
**/*.spec.js
**/test_*.py
**/*_test.py
**/*_test.go
**/*Test.php
**/*_spec.rb
```

Exclude `node_modules` from results.

### Step 2.5: Report Validation Results

Output validation status:

```
VALIDATION RESULTS:
- Config Valid: [yes/no]
- Dependencies Installed: [yes/no]
- Test Command Works: [yes/no]
- Existing Test Files: [count]
- Test Infrastructure: [READY/NEEDS SETUP]
```

---

## Phase 3: Update Kanban Config

After detecting and validating the framework, update `.kanban/config.json` with framework-specific test settings.

### Step 3.1: Read Existing Config

Read `.kanban/config.json` to get current settings (should have `testTimeout` from init).

### Step 3.2: Determine Test Command

Based on detected framework, determine the appropriate test command:

| Framework | Check for                          | testCommand                    |
| --------- | ---------------------------------- | ------------------------------ |
| Vitest    | `scripts.test:run` in package.json | `npm run test:run` (preferred) |
| Vitest    | No test:run script                 | `npx vitest run`               |
| Jest      | `scripts.test` in package.json     | `npm test -- --ci`             |
| Jest      | No test script                     | `npx jest --ci`                |
| pytest    | -                                  | `pytest`                       |
| go test   | -                                  | `go test ./...`                |
| PHPUnit   | -                                  | `./vendor/bin/phpunit`         |
| RSpec     | -                                  | `bundle exec rspec`            |

**Priority for JS/TS projects:**

1. Check if `package.json` has a `test:run` script - use `npm run test:run`
2. Check if `package.json` has a `test` script - use `npm test -- --run` (for vitest) or `npm test -- --ci` (for jest)
3. Fall back to `npx [framework] run`

### Step 3.3: Determine Test Patterns

Set regex patterns to parse test output:

| Framework | testPatterns.passed  | testPatterns.failed |
| --------- | -------------------- | ------------------- |
| Vitest    | `(\d+)\s+passed`     | `(\d+)\s+failed`    |
| Jest      | `(\d+)\s+passed`     | `(\d+)\s+failed`    |
| pytest    | `(\d+)\s+passed`     | `(\d+)\s+failed`    |
| go test   | `^ok`                | `^FAIL`             |
| PHPUnit   | `OK \((\d+) tests`   | `FAILURES!`         |
| RSpec     | `(\d+) examples?, 0` | `(\d+) failures?`   |

### Step 3.4: Update Config File

Merge the detected settings into the existing config:

```typescript
// Read existing config
const config = JSON.parse(fs.readFileSync('.kanban/config.json'));

// Add test settings
config.testCommand = detectedTestCommand;
config.testPatterns = {
  passed: passedPattern,
  failed: failedPattern,
};

// Write back
fs.writeFileSync('.kanban/config.json', JSON.stringify(config, null, 2));
```

### Step 3.5: Report Config Update

```
KANBAN CONFIG UPDATED:
- testCommand: [detected command]
- testPatterns.passed: [pattern]
- testPatterns.failed: [pattern]
```

---

## Phase 4: Setup Missing Infrastructure

If validation failed or no framework detected, guide the user through setup.

### Step 4.1: Determine Recommended Framework

Based on project type, recommend a test framework:

| Project Type   | Recommended Framework | Reason                            |
| -------------- | --------------------- | --------------------------------- |
| Nuxt/Vue+Vite  | Vitest                | Native Vite integration, fast HMR |
| React (CRA)    | Jest                  | Built-in with CRA                 |
| Node/Express   | Vitest or Jest        | Modern defaults                   |
| Python/Django  | pytest                | Industry standard                 |
| Python/FastAPI | pytest                | Async support                     |
| Go             | go test               | Built into language               |
| PHP/Laravel    | PHPUnit               | Laravel default                   |
| Ruby/Rails     | RSpec                 | Rails convention                  |

### Step 4.2: Offer Setup Options

Present the user with options:

```
TEST INFRASTRUCTURE SETUP REQUIRED

Recommended framework: [framework] for [project type]

Options:
1. Install [framework] with default configuration
2. Choose a different framework
3. Skip test setup (not recommended for TDD workflow)

What would you like to do?
```

### Step 4.3: Install Framework (if user accepts)

For Vitest (JS/TS projects):

```bash
npm install -D vitest @vue/test-utils happy-dom
```

Create config file using template from:
`.claude/commands/kanban/init/templates/test-configs/vitest.config.template.ts`

Add test script to package.json if missing:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

For Jest:

```bash
npm install -D jest @types/jest ts-jest
```

Create config file using template from:
`.claude/commands/kanban/init/templates/test-configs/jest.config.template.js`

For pytest:

```bash
pip install pytest pytest-asyncio
```

Create config file using template from:
`.claude/commands/kanban/init/templates/test-configs/pytest.ini.template`

### Step 4.4: Create Sample Test Directory

Create a sample test to verify setup:

For Vitest/Jest (in appropriate location based on project structure):

```typescript
// __tests__/setup-verification.test.ts
import { describe, it, expect } from 'vitest'; // or 'jest' or '@jest/globals'

describe('Test Infrastructure', () => {
  it('should be properly configured', () => {
    expect(true).toBe(true);
  });
});
```

### Step 4.5: Verify Installation

After setup, run the test command to verify:

```bash
npm run test -- --run
```

---

## Phase 5: Final Report

Output a summary of the verification/setup process:

```
========================================
TEST INFRASTRUCTURE VERIFICATION COMPLETE
========================================

Status: [READY/CONFIGURED/FAILED]

Framework: [framework name]
Config: [path to config file]
Command: [test command]
Test Files: [count] existing tests found

The kanban TDD workflow is now ready.
Workers can use the kanban-unit-tester agent to create tests.

Next steps:
1. Run '/kanban:create <feature>' to create a kanban board
2. Run '/kanban:process' to start TDD workflow
========================================
```

---

## Error Handling

### No package.json Found

If no package.json exists and this appears to be a JS/TS project:

```
WARNING: No package.json found.

This appears to be a JavaScript/TypeScript project without npm initialized.
Run 'npm init -y' first, then re-run this verification.
```

### Multiple Frameworks Detected

If multiple test frameworks are detected:

```
NOTICE: Multiple test frameworks detected:
- vitest.config.ts
- jest.config.js

The kanban TDD workflow will use the first detected framework (Vitest).
Consider consolidating to a single test framework for consistency.
```

### Installation Fails

If npm install or pip install fails:

```
ERROR: Failed to install test framework.

Command: [failed command]
Error: [error message]

Please resolve the dependency issue and re-run verification.
```

---

## Quick Reference

### Detection Commands Summary

```bash
# JS/TS Framework Detection
ls vitest.config.* jest.config.* 2>/dev/null

# Python Framework Detection
ls pytest.ini conftest.py 2>/dev/null

# Go Test Detection
ls *_test.go 2>/dev/null

# Check npm test script
npm pkg get scripts.test
```

### Recommended Test Commands

| Framework | Run All         | Run Once            | Watch                 |
| --------- | --------------- | ------------------- | --------------------- |
| Vitest    | `npm test`      | `npm test -- --run` | `npm test`            |
| Jest      | `npm test`      | `npm test -- --ci`  | `npm test -- --watch` |
| pytest    | `pytest`        | `pytest`            | `pytest-watch`        |
| go test   | `go test ./...` | `go test ./...`     | N/A                   |

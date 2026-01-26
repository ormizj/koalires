# Verify Test Infrastructure Script
# Detects and validates test framework configuration for kanban TDD workflow

param(
    [switch]$Verbose  # Enable verbose output
)

$ErrorActionPreference = "Continue"

# Detection results object
$DetectionResults = @{
    ProjectType = "unknown"
    TestFramework = "none"
    ConfigFile = $null
    TestCommand = $null
    DependenciesInstalled = $false
    TestCommandWorks = $false
    ExistingTestCount = 0
    Status = "UNKNOWN"
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "----------------------------------------" -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "----------------------------------------" -ForegroundColor Cyan
}

function Write-Detail {
    param([string]$Label, [string]$Value, [string]$Color = "Gray")
    Write-Host "  $Label`: " -NoNewline -ForegroundColor White
    Write-Host $Value -ForegroundColor $Color
}

function Detect-TestFramework {
    Write-Section "PHASE 1: Detecting Test Framework"

    # Check for Vitest
    $vitestConfigs = @(
        "vitest.config.ts",
        "vitest.config.js",
        "vitest.config.mts",
        "vitest.config.mjs"
    )
    foreach ($config in $vitestConfigs) {
        if (Test-Path $config) {
            $DetectionResults.TestFramework = "vitest"
            $DetectionResults.ConfigFile = $config
            $DetectionResults.TestCommand = "npx vitest"
            Write-Detail "Found" "Vitest config: $config" "Green"
            break
        }
    }

    # Check for Jest (if vitest not found)
    if ($DetectionResults.TestFramework -eq "none") {
        $jestConfigs = @(
            "jest.config.ts",
            "jest.config.js",
            "jest.config.cjs",
            "jest.config.mjs"
        )
        foreach ($config in $jestConfigs) {
            if (Test-Path $config) {
                $DetectionResults.TestFramework = "jest"
                $DetectionResults.ConfigFile = $config
                $DetectionResults.TestCommand = "npx jest"
                Write-Detail "Found" "Jest config: $config" "Green"
                break
            }
        }
    }

    # Check for Mocha
    if ($DetectionResults.TestFramework -eq "none") {
        $mochaConfigs = @(
            ".mocharc.js",
            ".mocharc.json",
            ".mocharc.yaml",
            ".mocharc.yml"
        )
        foreach ($config in $mochaConfigs) {
            if (Test-Path $config) {
                $DetectionResults.TestFramework = "mocha"
                $DetectionResults.ConfigFile = $config
                $DetectionResults.TestCommand = "npx mocha"
                Write-Detail "Found" "Mocha config: $config" "Green"
                break
            }
        }
    }

    # Check for pytest (Python)
    if ($DetectionResults.TestFramework -eq "none") {
        if (Test-Path "pytest.ini") {
            $DetectionResults.TestFramework = "pytest"
            $DetectionResults.ConfigFile = "pytest.ini"
            $DetectionResults.TestCommand = "pytest"
            $DetectionResults.ProjectType = "python"
            Write-Detail "Found" "pytest config: pytest.ini" "Green"
        }
        elseif (Test-Path "conftest.py") {
            $DetectionResults.TestFramework = "pytest"
            $DetectionResults.ConfigFile = "conftest.py"
            $DetectionResults.TestCommand = "pytest"
            $DetectionResults.ProjectType = "python"
            Write-Detail "Found" "pytest config: conftest.py" "Green"
        }
        elseif (Test-Path "pyproject.toml") {
            $content = Get-Content "pyproject.toml" -Raw -ErrorAction SilentlyContinue
            if ($content -match "\[tool\.pytest") {
                $DetectionResults.TestFramework = "pytest"
                $DetectionResults.ConfigFile = "pyproject.toml"
                $DetectionResults.TestCommand = "pytest"
                $DetectionResults.ProjectType = "python"
                Write-Detail "Found" "pytest config in pyproject.toml" "Green"
            }
        }
    }

    # Check for Go tests
    if ($DetectionResults.TestFramework -eq "none") {
        if (Test-Path "go.mod") {
            $goTests = Get-ChildItem -Path "." -Filter "*_test.go" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "vendor" }
            if ($goTests.Count -gt 0) {
                $DetectionResults.TestFramework = "go test"
                $DetectionResults.ConfigFile = "go.mod"
                $DetectionResults.TestCommand = "go test ./..."
                $DetectionResults.ProjectType = "go"
                Write-Detail "Found" "Go test files: $($goTests.Count) files" "Green"
            }
        }
    }

    # Check for PHPUnit
    if ($DetectionResults.TestFramework -eq "none") {
        $phpunitConfigs = @("phpunit.xml", "phpunit.xml.dist")
        foreach ($config in $phpunitConfigs) {
            if (Test-Path $config) {
                $DetectionResults.TestFramework = "phpunit"
                $DetectionResults.ConfigFile = $config
                $DetectionResults.TestCommand = "./vendor/bin/phpunit"
                $DetectionResults.ProjectType = "php"
                Write-Detail "Found" "PHPUnit config: $config" "Green"
                break
            }
        }
    }

    # Check for RSpec (Ruby)
    if ($DetectionResults.TestFramework -eq "none") {
        if (Test-Path ".rspec") {
            $DetectionResults.TestFramework = "rspec"
            $DetectionResults.ConfigFile = ".rspec"
            $DetectionResults.TestCommand = "bundle exec rspec"
            $DetectionResults.ProjectType = "ruby"
            Write-Detail "Found" "RSpec config: .rspec" "Green"
        }
    }

    # Check for Playwright
    if (Test-Path "playwright.config.ts" -or Test-Path "playwright.config.js") {
        $config = if (Test-Path "playwright.config.ts") { "playwright.config.ts" } else { "playwright.config.js" }
        Write-Detail "Found" "Playwright (E2E): $config" "Yellow"
    }

    # Check for Cypress
    if (Test-Path "cypress.config.ts" -or Test-Path "cypress.config.js") {
        $config = if (Test-Path "cypress.config.ts") { "cypress.config.ts" } else { "cypress.config.js" }
        Write-Detail "Found" "Cypress (E2E): $config" "Yellow"
    }

    # Detect project type from config files
    if ($DetectionResults.ProjectType -eq "unknown") {
        if (Test-Path "nuxt.config.ts" -or Test-Path "nuxt.config.js") {
            $DetectionResults.ProjectType = "nuxt"
        }
        elseif (Test-Path "vite.config.ts" -or Test-Path "vite.config.js") {
            $DetectionResults.ProjectType = "vite"
        }
        elseif (Test-Path "package.json") {
            $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($packageJson.dependencies.'react-scripts' -or $packageJson.devDependencies.'react-scripts') {
                $DetectionResults.ProjectType = "react-cra"
            }
            elseif ($packageJson.dependencies.express -or $packageJson.devDependencies.express) {
                $DetectionResults.ProjectType = "node-express"
            }
            elseif ($packageJson.dependencies.react -or $packageJson.devDependencies.react) {
                $DetectionResults.ProjectType = "react"
            }
            else {
                $DetectionResults.ProjectType = "node"
            }
        }
    }

    # Check package.json for test framework in dependencies
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($packageJson) {
            $deps = @()
            if ($packageJson.devDependencies) {
                $deps += $packageJson.devDependencies.PSObject.Properties.Name
            }
            if ($packageJson.dependencies) {
                $deps += $packageJson.dependencies.PSObject.Properties.Name
            }

            if ($DetectionResults.TestFramework -eq "none") {
                if ($deps -contains "vitest") {
                    $DetectionResults.TestFramework = "vitest"
                    $DetectionResults.TestCommand = "npx vitest"
                    Write-Detail "Found" "Vitest in dependencies (no config file)" "Yellow"
                }
                elseif ($deps -contains "jest") {
                    $DetectionResults.TestFramework = "jest"
                    $DetectionResults.TestCommand = "npx jest"
                    Write-Detail "Found" "Jest in dependencies (no config file)" "Yellow"
                }
            }

            # Check for test script
            if ($packageJson.scripts.test) {
                $DetectionResults.TestCommand = "npm test"
                Write-Detail "Test script" $packageJson.scripts.test "Gray"
            }
        }
    }

    if ($DetectionResults.TestFramework -eq "none") {
        Write-Detail "Status" "No test framework detected" "Yellow"
    }

    Write-Host ""
    Write-Detail "Project Type" $DetectionResults.ProjectType
    Write-Detail "Test Framework" $DetectionResults.TestFramework
    Write-Detail "Config File" $(if ($DetectionResults.ConfigFile) { $DetectionResults.ConfigFile } else { "not found" })
    Write-Detail "Test Command" $(if ($DetectionResults.TestCommand) { $DetectionResults.TestCommand } else { "not set" })
}

function Validate-Infrastructure {
    Write-Section "PHASE 2: Validating Infrastructure"

    if ($DetectionResults.TestFramework -eq "none") {
        Write-Detail "Validation" "Skipped - no framework detected" "Yellow"
        return
    }

    # Check config file validity
    if ($DetectionResults.ConfigFile -and (Test-Path $DetectionResults.ConfigFile)) {
        $content = Get-Content $DetectionResults.ConfigFile -Raw -ErrorAction SilentlyContinue
        if ($content -and $content.Length -gt 0) {
            Write-Detail "Config File" "Valid (non-empty)" "Green"
            $DetectionResults.ConfigValid = $true
        }
        else {
            Write-Detail "Config File" "Empty or unreadable" "Red"
            $DetectionResults.ConfigValid = $false
        }
    }

    # Check dependencies installed
    switch ($DetectionResults.TestFramework) {
        "vitest" {
            $result = npm list vitest 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Detail "Dependencies" "Vitest installed" "Green"
                $DetectionResults.DependenciesInstalled = $true
            }
            else {
                Write-Detail "Dependencies" "Vitest NOT installed" "Red"
            }
        }
        "jest" {
            $result = npm list jest 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Detail "Dependencies" "Jest installed" "Green"
                $DetectionResults.DependenciesInstalled = $true
            }
            else {
                Write-Detail "Dependencies" "Jest NOT installed" "Red"
            }
        }
        "pytest" {
            $result = pip show pytest 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Detail "Dependencies" "pytest installed" "Green"
                $DetectionResults.DependenciesInstalled = $true
            }
            else {
                Write-Detail "Dependencies" "pytest NOT installed" "Red"
            }
        }
        "go test" {
            # Go test is built-in, always available
            Write-Detail "Dependencies" "go test (built-in)" "Green"
            $DetectionResults.DependenciesInstalled = $true
        }
        default {
            Write-Detail "Dependencies" "Could not verify" "Yellow"
        }
    }

    # Verify test command works
    Write-Host "  Checking test command..." -ForegroundColor Gray
    switch ($DetectionResults.TestFramework) {
        "vitest" {
            $result = npx vitest --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Detail "Test Command" "Works (vitest $result)" "Green"
                $DetectionResults.TestCommandWorks = $true
            }
            else {
                Write-Detail "Test Command" "Failed" "Red"
            }
        }
        "jest" {
            $result = npx jest --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Detail "Test Command" "Works (jest $result)" "Green"
                $DetectionResults.TestCommandWorks = $true
            }
            else {
                Write-Detail "Test Command" "Failed" "Red"
            }
        }
        "pytest" {
            $result = pytest --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Detail "Test Command" "Works" "Green"
                $DetectionResults.TestCommandWorks = $true
            }
            else {
                Write-Detail "Test Command" "Failed" "Red"
            }
        }
        "go test" {
            $result = go version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Detail "Test Command" "Works ($result)" "Green"
                $DetectionResults.TestCommandWorks = $true
            }
            else {
                Write-Detail "Test Command" "Failed" "Red"
            }
        }
    }

    # Count existing test files
    $testPatterns = @(
        "*.test.ts", "*.test.js", "*.test.tsx", "*.test.jsx",
        "*.spec.ts", "*.spec.js", "*.spec.tsx", "*.spec.jsx",
        "test_*.py", "*_test.py",
        "*_test.go",
        "*Test.php",
        "*_spec.rb"
    )

    $testCount = 0
    foreach ($pattern in $testPatterns) {
        $files = Get-ChildItem -Path "." -Filter $pattern -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules|vendor|\.nuxt|\.output" }
        $testCount += $files.Count
    }

    $DetectionResults.ExistingTestCount = $testCount
    Write-Detail "Existing Tests" "$testCount test file(s) found" $(if ($testCount -gt 0) { "Green" } else { "Yellow" })

    # Determine overall status
    if ($DetectionResults.DependenciesInstalled -and $DetectionResults.TestCommandWorks) {
        $DetectionResults.Status = "READY"
    }
    elseif ($DetectionResults.TestFramework -ne "none") {
        $DetectionResults.Status = "NEEDS_SETUP"
    }
    else {
        $DetectionResults.Status = "NOT_CONFIGURED"
    }
}

function Show-Summary {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "TEST INFRASTRUCTURE DETECTION RESULTS" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    $statusColor = switch ($DetectionResults.Status) {
        "READY" { "Green" }
        "NEEDS_SETUP" { "Yellow" }
        default { "Red" }
    }

    Write-Host "  Status: " -NoNewline -ForegroundColor White
    Write-Host $DetectionResults.Status -ForegroundColor $statusColor
    Write-Host ""
    Write-Host "  Project Type:       $($DetectionResults.ProjectType)" -ForegroundColor Gray
    Write-Host "  Test Framework:     $($DetectionResults.TestFramework)" -ForegroundColor Gray
    Write-Host "  Config File:        $(if ($DetectionResults.ConfigFile) { $DetectionResults.ConfigFile } else { 'none' })" -ForegroundColor Gray
    Write-Host "  Test Command:       $(if ($DetectionResults.TestCommand) { $DetectionResults.TestCommand } else { 'none' })" -ForegroundColor Gray
    Write-Host "  Dependencies OK:    $($DetectionResults.DependenciesInstalled)" -ForegroundColor Gray
    Write-Host "  Command Works:      $($DetectionResults.TestCommandWorks)" -ForegroundColor Gray
    Write-Host "  Existing Tests:     $($DetectionResults.ExistingTestCount)" -ForegroundColor Gray
    Write-Host ""

    if ($DetectionResults.Status -eq "READY") {
        Write-Host "  Test infrastructure is ready for kanban TDD workflow." -ForegroundColor Green
    }
    elseif ($DetectionResults.Status -eq "NEEDS_SETUP") {
        Write-Host "  Test framework detected but needs configuration." -ForegroundColor Yellow
        Write-Host "  The SKILL.md will guide you through setup." -ForegroundColor Yellow
    }
    else {
        Write-Host "  No test framework detected." -ForegroundColor Yellow
        Write-Host "  The SKILL.md will recommend a framework based on project type." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan

    # Output structured data for parsing
    Write-Host ""
    Write-Host "--- STRUCTURED OUTPUT ---" -ForegroundColor DarkGray
    $DetectionResults | ConvertTo-Json -Compress
}

# Main execution
Detect-TestFramework
Validate-Infrastructure
Show-Summary

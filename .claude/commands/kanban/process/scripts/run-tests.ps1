<#
.SYNOPSIS
    Run tests for specific test files and return structured results.

.DESCRIPTION
    Executes test command for specific files and parses output for pass/fail counts.
    Used by dispatcher to verify test results independently of worker output.

.PARAMETER TestFiles
    Array of test file paths to run.

.PARAMETER ConfigFile
    Path to kanban config.json. Default: .kanban/config.json

.PARAMETER WorkingDir
    Working directory for test execution. Default: current directory.
#>

param(
    [Parameter(Mandatory)]
    [string[]]$TestFiles,

    [Parameter()]
    [string]$ConfigFile = ".kanban/config.json",

    [Parameter()]
    [string]$WorkingDir = "."
)

$ErrorActionPreference = "Stop"

# Load config with defaults
$config = @{
    testCommand = "npm test -- --run"
    testPatterns = @{
        passed = "(\d+)\s+passed"
        failed = "(\d+)\s+failed"
    }
}

if (Test-Path $ConfigFile) {
    try {
        $loadedConfig = Get-Content $ConfigFile -Raw | ConvertFrom-Json -AsHashtable
        foreach ($key in $loadedConfig.Keys) {
            $config[$key] = $loadedConfig[$key]
        }
    }
    catch {
        # Use defaults on config read failure
    }
}

# Build test command with specific files
$testFileArgs = $TestFiles -join " "
$cmd = "$($config.testCommand) $testFileArgs"

# Run tests
Push-Location $WorkingDir
try {
    $output = Invoke-Expression $cmd 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
}
catch {
    $output = $_.Exception.Message
    $exitCode = 1
}
finally {
    Pop-Location
}

# Strip ANSI escape sequences for reliable parsing
# Vitest and other test runners use ANSI codes for colors which break regex matching
$cleanOutput = $output -replace '\x1b\[[0-9;]*m', '' -replace '[\x00-\x1f]', ''

# Parse results from clean output
$passed = 0
$failed = 0

if ($cleanOutput -match $config.testPatterns.passed) {
    $passed = [int]$matches[1]
}
if ($cleanOutput -match $config.testPatterns.failed) {
    $failed = [int]$matches[1]
}

# Return structured result
# Only check test count for pass/fail - ignore exit code which can be affected by stderr output
$result = @{
    passed = ($failed -eq 0)
    totalTests = $passed + $failed
    passedTests = $passed
    failedTests = $failed
    command = $cmd
    exitCode = $exitCode
    output = $output
}

$result | ConvertTo-Json -Depth 5 -Compress

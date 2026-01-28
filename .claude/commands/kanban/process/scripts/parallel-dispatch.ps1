<#
.SYNOPSIS
    Parallel kanban task dispatcher using claude -p workers.

.DESCRIPTION
    Orchestrates parallel execution of kanban tasks by spawning claude -p workers.
    Tasks are processed in waves based on category dependencies.
    Dynamically detects project stack and available agents for task dispatch.

.PARAMETER Parallel
    Maximum number of concurrent workers. Default is 3.

.PARAMETER DryRun
    Show what would be done without executing.

.PARAMETER NonInteractive
    Run in non-interactive mode without prompting for user input.
    Auto-detected when running in CI, piped contexts, or CLAUDE_CODE environment.

.PARAMETER DefaultFailAction
    Action to take when tasks fail in non-interactive mode.
    Valid values: Skip (default), Retry, Quit.

.PARAMETER FailFast
    Stop execution immediately if any task in a wave fails.
    Prevents cascade failures when dependencies break.

.PARAMETER RunVerification
    Run independent verification (typecheck, lint, tests) after each wave.
    Catches issues that workers may have self-reported incorrectly.
    ENABLED BY DEFAULT. Use -RunVerification:$false or -SkipVerification to disable.

.PARAMETER SkipVerification
    Disable independent verification after each wave. Shorthand for -RunVerification:$false.

.EXAMPLE
    .\parallel-dispatch.ps1
    .\parallel-dispatch.ps1 -Parallel 5
    .\parallel-dispatch.ps1 -DryRun
    .\parallel-dispatch.ps1 -NonInteractive -DefaultFailAction Skip
    .\parallel-dispatch.ps1 -FailFast
#>

param(
    [Parameter()]
    [int]$Parallel = 3,

    [Parameter()]
    [switch]$DryRun,

    [Parameter()]
    [switch]$NonInteractive,

    [Parameter()]
    [ValidateSet("Skip", "Retry", "Quit")]
    [string]$DefaultFailAction = "Skip",

    [Parameter()]
    [switch]$FailFast,

    [Parameter()]
    [bool]$RunVerification = $true,

    [Parameter()]
    [switch]$SkipVerification
)

# Handle SkipVerification flag (overrides RunVerification default)
if ($SkipVerification) {
    $RunVerification = $false
}

# Detect non-interactive environment if not explicitly set
if (-not $NonInteractive) {
    $NonInteractive = -not [Environment]::UserInteractive -or
                      [Console]::IsInputRedirected -or
                      $env:CI -eq "true" -or
                      $env:CLAUDE_CODE -eq "true"
}

# Script configuration
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "../../../../..")
$KanbanDir = Join-Path $ProjectRoot ".kanban"
$LogsDir = Join-Path $KanbanDir "worker-logs"
$BoardFile = Join-Path $KanbanDir "kanban-board.json"
$ProgressFile = Join-Path $KanbanDir "kanban-progress.json"
$PromptTemplate = Join-Path $ScriptDir "../prompts/worker-task.md"
$ProcessWorkerOutputScript = Join-Path $ScriptDir "process-worker-output.ps1"
$ParseWorkerLogScript = Join-Path $ScriptDir "parse-worker-log.ps1"
$ShowNextStepsScript = Join-Path $ScriptDir "show-next-steps.ps1"

# Dot-source the Show-NextSteps function
. $ShowNextStepsScript

# Wave definitions - tasks are processed in dependency order
$WaveDefinitions = @{
    1 = @("data", "config")      # No dependencies
    2 = @("api")                  # After data
    3 = @("integration")          # After api
    4 = @("ui")                   # After integration
    5 = @("testing")              # After all (no pre-tests needed)
}

# Categories that require pre-implementation tests (TDD)
$TddCategories = @("data", "api", "integration", "ui", "config")

# Agent mapping will be dynamically detected at runtime
$script:AgentMapping = $null

#region Helper Functions

function Get-ProjectAgentMapping {
    <#
    .SYNOPSIS
        Dynamically detect project stack and available agents for task dispatch.
    .DESCRIPTION
        Scans project for framework indicators and checks .claude/agents/ for
        available agent definitions. Returns a mapping of categories to agents.
    #>
    param([string]$ProjectRoot)

    $detected = @{
        frontendFramework = $null  # vue, react, angular, svelte
        backendFramework = $null   # express, fastapi, django, rails, go
        language = $null           # typescript, python, go, ruby, php
    }

    # Detect frontend framework from package.json
    $packageJsonPath = Join-Path $ProjectRoot "package.json"
    if (Test-Path $packageJsonPath) {
        try {
            $pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
            $deps = @()
            if ($pkg.dependencies) { $deps += $pkg.dependencies.PSObject.Properties.Name }
            if ($pkg.devDependencies) { $deps += $pkg.devDependencies.PSObject.Properties.Name }

            if ($deps -contains "vue" -or $deps -contains "nuxt") { $detected.frontendFramework = "vue" }
            elseif ($deps -contains "react" -or $deps -contains "next") { $detected.frontendFramework = "react" }
            elseif ($deps -contains "@angular/core") { $detected.frontendFramework = "angular" }
            elseif ($deps -contains "svelte" -or $deps -contains "@sveltejs/kit") { $detected.frontendFramework = "svelte" }

            # Detect TypeScript
            if ($deps -contains "typescript") { $detected.language = "typescript" }
        }
        catch {
            # Silently continue if package.json can't be read
        }
    }

    # Detect backend language from project files
    if (Test-Path (Join-Path $ProjectRoot "requirements.txt")) { $detected.language = "python" }
    elseif (Test-Path (Join-Path $ProjectRoot "pyproject.toml")) { $detected.language = "python" }
    elseif (Test-Path (Join-Path $ProjectRoot "go.mod")) { $detected.language = "go" }
    elseif (Test-Path (Join-Path $ProjectRoot "Gemfile")) { $detected.language = "ruby" }
    elseif (Test-Path (Join-Path $ProjectRoot "composer.json")) { $detected.language = "php" }
    elseif (Test-Path (Join-Path $ProjectRoot "Cargo.toml")) { $detected.language = "rust" }

    # Build default agent mapping (all general-purpose initially)
    $mapping = @{
        "data"        = "general-purpose"
        "api"         = "general-purpose"
        "ui"          = "general-purpose"
        "integration" = "general-purpose"
        "config"      = "general-purpose"
        "testing"     = "kanban-unit-tester"
    }

    # Check if project has specific agents defined in .claude/agents/
    $agentsDir = Join-Path $ProjectRoot ".claude/agents"
    if (Test-Path $agentsDir) {
        $availableAgents = Get-ChildItem $agentsDir -Filter "*.md" -ErrorAction SilentlyContinue |
                           ForEach-Object { $_.BaseName }

        # Map detected stack to available agents
        if ($detected.frontendFramework -eq "vue" -and $availableAgents -contains "vue-expert") {
            $mapping["ui"] = "vue-expert"
        }
        elseif ($detected.frontendFramework -eq "react" -and $availableAgents -contains "react-expert") {
            $mapping["ui"] = "react-expert"
        }
        elseif ($detected.frontendFramework -eq "angular" -and $availableAgents -contains "angular-expert") {
            $mapping["ui"] = "angular-expert"
        }
        elseif ($detected.frontendFramework -eq "svelte" -and $availableAgents -contains "svelte-expert") {
            $mapping["ui"] = "svelte-expert"
        }

        # Map backend agents
        if ($availableAgents -contains "backend-developer") {
            $mapping["data"] = "backend-developer"
            $mapping["api"] = "backend-developer"
            $mapping["integration"] = "backend-developer"
            $mapping["config"] = "backend-developer"
        }

        # Language-specific backend agents
        if ($detected.language -eq "python" -and $availableAgents -contains "python-developer") {
            $mapping["data"] = "python-developer"
            $mapping["api"] = "python-developer"
            $mapping["integration"] = "python-developer"
            $mapping["config"] = "python-developer"
        }
        elseif ($detected.language -eq "go" -and $availableAgents -contains "go-developer") {
            $mapping["data"] = "go-developer"
            $mapping["api"] = "go-developer"
            $mapping["integration"] = "go-developer"
            $mapping["config"] = "go-developer"
        }
    }

    return @{
        mapping = $mapping
        detected = $detected
    }
}

function Invoke-IndependentVerification {
    <#
    .SYNOPSIS
        Run independent verification (typecheck, lint, tests) to validate worker output.
    .DESCRIPTION
        After workers complete, run project verification commands independently
        to catch issues that workers may have self-reported incorrectly.
        Uses config.json for verification commands if available, otherwise falls back to package.json detection.
    #>
    param(
        [string]$ProjectRoot,
        [array]$AffectedFiles = @()
    )

    $results = @{
        typecheck = $null
        lintFix = $null
        lint = $null
        tests = $null
        allPassed = $true
    }

    # Load kanban config for verification commands
    $configPath = Join-Path $ProjectRoot ".kanban/config.json"
    $config = $null
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json
        }
        catch {
            Write-Host "[Warning] Could not read config.json: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    # Check if package.json exists to determine available commands
    $packageJsonPath = Join-Path $ProjectRoot "package.json"
    if (-not (Test-Path $packageJsonPath)) {
        Write-Host "[Skip] No package.json found - skipping verification" -ForegroundColor Yellow
        return $results
    }

    Write-Host ""
    Write-Host ("-" * 40) -ForegroundColor Cyan
    Write-Host "INDEPENDENT VERIFICATION" -ForegroundColor Cyan
    Write-Host ("-" * 40) -ForegroundColor Cyan

    try {
        $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        $scripts = if ($packageJson.scripts) { $packageJson.scripts } else { @{} }
    }
    catch {
        Write-Host "[Error] Failed to read package.json: $($_.Exception.Message)" -ForegroundColor Red
        return $results
    }

    # Get verification commands from config or fallback to package.json detection
    $verifyCommands = @{
        typecheck = if ($config -and $config.verification -and $config.verification.typecheck) { $config.verification.typecheck } elseif ($scripts.typecheck) { "npm run typecheck" } else { $null }
        lint = if ($config -and $config.verification -and $config.verification.lint) { $config.verification.lint } elseif ($scripts.lint) { "npm run lint" } else { $null }
        lintFix = if ($config -and $config.verification -and $config.verification.lintFix) { $config.verification.lintFix } elseif ($scripts.'lint:fix') { "npm run lint:fix" } else { $null }
    }

    # Save current location
    Push-Location $ProjectRoot

    try {
        # Run TypeScript type checking if available
        if ($verifyCommands.typecheck) {
            Write-Host "[Check] Running typecheck..." -ForegroundColor Gray
            $typecheckOutput = Invoke-Expression $verifyCommands.typecheck 2>&1
            $results.typecheck = $LASTEXITCODE -eq 0

            if ($results.typecheck) {
                Write-Host "[PASS] Typecheck passed" -ForegroundColor Green
            } else {
                Write-Host "[FAIL] Typecheck failed" -ForegroundColor Red
                $results.allPassed = $false
                # Show first few lines of error
                $errorLines = ($typecheckOutput | Out-String).Split("`n") | Select-Object -Last 10
                foreach ($line in $errorLines) {
                    if ($line.Trim()) {
                        Write-Host "       $($line.Trim())" -ForegroundColor DarkRed
                    }
                }
            }
        } else {
            Write-Host "[Skip] No typecheck command found" -ForegroundColor DarkGray
        }

        # Run lint:fix first if available to auto-fix formatting issues
        if ($verifyCommands.lintFix) {
            Write-Host "[Check] Running lint:fix to auto-fix issues..." -ForegroundColor Gray
            $lintFixOutput = Invoke-Expression $verifyCommands.lintFix 2>&1
            $results.lintFix = $LASTEXITCODE -eq 0

            if ($results.lintFix) {
                Write-Host "[PASS] Lint:fix completed" -ForegroundColor Green
            } else {
                Write-Host "[INFO] Lint:fix ran (some issues may remain)" -ForegroundColor Yellow
            }
        }

        # Run lint after lint:fix
        if ($verifyCommands.lint) {
            Write-Host "[Check] Running lint..." -ForegroundColor Gray
            $lintOutput = Invoke-Expression $verifyCommands.lint 2>&1
            $results.lint = $LASTEXITCODE -eq 0

            if ($results.lint) {
                Write-Host "[PASS] Lint passed" -ForegroundColor Green
            } else {
                Write-Host "[FAIL] Lint failed" -ForegroundColor Red
                $results.allPassed = $false
                # Show first few lines of error
                $errorLines = ($lintOutput | Out-String).Split("`n") | Select-Object -Last 10
                foreach ($line in $errorLines) {
                    if ($line.Trim()) {
                        Write-Host "       $($line.Trim())" -ForegroundColor DarkRed
                    }
                }
            }
        } else {
            Write-Host "[Skip] No lint command found" -ForegroundColor DarkGray
        }

        # Run tests if available
        if ($scripts.test) {
            Write-Host "[Check] Running tests..." -ForegroundColor Gray
            $testOutput = & npm run test 2>&1
            $results.tests = $LASTEXITCODE -eq 0

            if ($results.tests) {
                Write-Host "[PASS] Tests passed" -ForegroundColor Green
            } else {
                Write-Host "[FAIL] Tests failed" -ForegroundColor Red
                $results.allPassed = $false
                # Show test summary
                $errorLines = ($testOutput | Out-String).Split("`n") | Select-Object -Last 15
                foreach ($line in $errorLines) {
                    if ($line.Trim()) {
                        Write-Host "       $($line.Trim())" -ForegroundColor DarkRed
                    }
                }
            }
        } else {
            Write-Host "[Skip] No test script found" -ForegroundColor DarkGray
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ("-" * 40) -ForegroundColor Cyan
    if ($results.allPassed) {
        Write-Host "VERIFICATION: ALL PASSED" -ForegroundColor Green
    } else {
        Write-Host "VERIFICATION: SOME CHECKS FAILED" -ForegroundColor Red
    }
    Write-Host ""

    return $results
}

function Get-ProjectContext {
    <#
    .SYNOPSIS
        Extracts project context from CLAUDE.md for worker prompts.
    #>
    param([string]$ProjectRoot)

    $contextParts = @()

    # Try to read CLAUDE.md for project-specific conventions
    $claudeMdPath = Join-Path $ProjectRoot "CLAUDE.md"
    if (Test-Path $claudeMdPath) {
        try {
            $claudeMd = Get-Content $claudeMdPath -Raw -ErrorAction Stop

            # Extract key conventions section if present
            if ($claudeMd -match '## Key Conventions([\s\S]*?)(?=\n## |$)') {
                $conventions = $matches[1].Trim()
                # Take first 10 lines to keep it concise
                $conventionLines = ($conventions -split "`n" | Select-Object -First 10) -join "`n"
                $contextParts += "### Key Conventions (from CLAUDE.md)`n$conventionLines"
            }
        }
        catch {
            # Silently continue if CLAUDE.md can't be read
        }
    }

    if ($contextParts.Count -eq 0) {
        return "Follow project conventions from CLAUDE.md if available. Use general best practices."
    }

    return ($contextParts -join "`n`n")
}

function Get-TransitiveDependencies {
    <#
    .SYNOPSIS
        Recursively collects all transitive dependencies for a task.
    .DESCRIPTION
        Given a task name, returns all task names in the dependency chain,
        not just direct blockedBy dependencies. This ensures UI tasks receive
        context from API tasks even if they're not directly connected.
    #>
    param(
        [string]$TaskName,
        [array]$AllTasks,
        [hashtable]$Visited = @{}
    )

    # Avoid infinite loops from circular dependencies
    if ($Visited.ContainsKey($TaskName)) {
        return @()
    }
    $Visited[$TaskName] = $true

    $task = $AllTasks | Where-Object { $_.name -eq $TaskName }
    if (-not $task) {
        return @()
    }

    $deps = @()

    # Get direct dependencies
    if ($task.blockedBy -and $task.blockedBy.Count -gt 0) {
        foreach ($depName in $task.blockedBy) {
            # Add the direct dependency
            if ($deps -notcontains $depName) {
                $deps += $depName
            }
            # Recursively get its dependencies
            $transitive = Get-TransitiveDependencies -TaskName $depName -AllTasks $AllTasks -Visited $Visited
            foreach ($transDep in $transitive) {
                if ($deps -notcontains $transDep) {
                    $deps += $transDep
                }
            }
        }
    }

    return $deps
}

function Get-DependencyContext {
    <#
    .SYNOPSIS
        Gathers context from ALL transitive dependencies for worker prompt injection.
    .DESCRIPTION
        Unlike the previous implementation that only looked at direct blockedBy tasks,
        this now collects context from the ENTIRE dependency chain. This ensures that
        UI tasks receive context from API tasks even if there are intermediate tasks.
    #>
    param(
        [object]$Task,
        [hashtable]$Progress,
        [array]$AllTasks
    )

    $context = @()

    # Get ALL transitive dependencies, not just direct blockedBy
    $allDeps = Get-TransitiveDependencies -TaskName $Task.name -AllTasks $AllTasks -Visited @{}

    if (-not $allDeps -or $allDeps.Count -eq 0) {
        return "No dependencies for this task."
    }

    # Separate direct and transitive dependencies for clarity
    $directDeps = @()
    if ($Task.blockedBy) {
        $directDeps = $Task.blockedBy
    }

    foreach ($depName in $allDeps) {
        $depProgress = $Progress[$depName]
        $depTask = $AllTasks | Where-Object { $_.name -eq $depName }

        # Mark whether this is a direct or transitive dependency
        $depType = if ($directDeps -contains $depName) { "direct" } else { "transitive" }

        if ($depProgress -and $depTask.passes) {
            $context += "**$depName** (completed, $depType dependency):"
            if ($depProgress.affectedFiles -and $depProgress.affectedFiles.Count -gt 0) {
                foreach ($file in $depProgress.affectedFiles) {
                    $context += "- $file"
                }
            } else {
                $context += "- (no files recorded)"
            }
            $context += ""
        } elseif ($depProgress) {
            $context += "**$depName** (status: $($depProgress.status), $depType dependency):"
            $context += "- WARNING: Dependency not yet completed"
            $context += ""
        } else {
            $context += "**$depName** (not started, $depType dependency):"
            $context += "- WARNING: Dependency has not been processed"
            $context += ""
        }
    }

    if ($context.Count -eq 0) {
        return "No dependency context available."
    }

    return ($context -join "`n")
}

function Test-TaskReady {
    <#
    .SYNOPSIS
        Checks if a task's blockedBy dependencies are all completed.
    #>
    param(
        [object]$Task,
        [hashtable]$Progress,
        [array]$AllTasks
    )

    $blockedBy = $Task.blockedBy

    # No dependencies = ready
    if (-not $blockedBy -or $blockedBy.Count -eq 0) {
        return $true
    }

    foreach ($depName in $blockedBy) {
        $depTask = $AllTasks | Where-Object { $_.name -eq $depName }
        if (-not $depTask) {
            Write-Host "       [Warning] blockedBy '$depName' not found in board" -ForegroundColor Yellow
            continue
        }

        # Dependency must have passes: true
        if (-not $depTask.passes) {
            return $false
        }
    }

    return $true
}

function Test-CircularDependencies {
    <#
    .SYNOPSIS
        Validates no circular dependencies exist in the task graph.
    #>
    param([array]$Tasks)

    $visited = @{}
    $stack = @{}

    function Visit-Task($taskName) {
        if ($stack[$taskName]) {
            return $false  # Circular dependency detected
        }
        if ($visited[$taskName]) {
            return $true  # Already validated
        }

        $visited[$taskName] = $true
        $stack[$taskName] = $true

        $task = $Tasks | Where-Object { $_.name -eq $taskName }
        if ($task -and $task.blockedBy) {
            foreach ($dep in $task.blockedBy) {
                if (-not (Visit-Task $dep)) {
                    Write-Host "[Error] Circular dependency detected: $taskName -> $dep" -ForegroundColor Red
                    return $false
                }
            }
        }

        $stack[$taskName] = $false
        return $true
    }

    foreach ($task in $Tasks) {
        if (-not (Visit-Task $task.name)) {
            return $false
        }
    }

    return $true
}

function Test-ProgressEntry {
    param(
        [object]$Entry,
        [string]$TaskName
    )

    $warnings = @()

    # Check required fields for all entries
    if (-not $Entry.status) {
        $warnings += "Missing 'status' field"
    }
    if (-not $Entry.startedAt) {
        $warnings += "Missing 'startedAt' field"
    }
    if (-not $Entry.agent) {
        $warnings += "Missing 'agent' field"
    }

    # For completed entries, check additional fields
    if ($Entry.status -eq "completed") {
        if (-not $Entry.completedAt) {
            $warnings += "Missing 'completedAt' field"
        }
        if (-not $Entry.workLog) {
            $warnings += "Missing 'workLog' field"
        }
        elseif ($Entry.workLog -isnot [array]) {
            $warnings += "'workLog' should be an array, got: $($Entry.workLog.GetType().Name)"
        }
        elseif ($Entry.workLog.Count -eq 0) {
            $warnings += "Empty 'workLog' array - worker likely didn't log work"
        }
        if (-not $Entry.affectedFiles) {
            $warnings += "Missing 'affectedFiles' field"
        }
        elseif ($Entry.affectedFiles.Count -eq 0) {
            $warnings += "Empty 'affectedFiles' array - worker likely didn't track files"
        }
    }

    # For error entries, check workLog field
    if ($Entry.status -eq "error") {
        if (-not $Entry.completedAt) {
            $warnings += "Missing 'completedAt' field"
        }
        if (-not $Entry.workLog) {
            $warnings += "Missing 'workLog' field (should contain error details)"
        }
        elseif ($Entry.workLog -isnot [array]) {
            $warnings += "'workLog' should be an array, got: $($Entry.workLog.GetType().Name)"
        }
    }

    # For blocked entries, check workLog field
    if ($Entry.status -eq "blocked") {
        if (-not $Entry.completedAt) {
            $warnings += "Missing 'completedAt' field"
        }
        if (-not $Entry.workLog) {
            $warnings += "Missing 'workLog' field (should contain blocking reason)"
        }
        elseif ($Entry.workLog -isnot [array]) {
            $warnings += "'workLog' should be an array, got: $($Entry.workLog.GetType().Name)"
        }
    }

    return $warnings
}

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

function Write-SubHeader {
    param([string]$Title)
    Write-Host ""
    Write-Host ("-" * 40) -ForegroundColor DarkCyan
    Write-Host $Title -ForegroundColor DarkCyan
    Write-Host ("-" * 40) -ForegroundColor DarkCyan
}

function Get-AgentForCategory {
    param([string]$Category)

    if ($script:AgentMapping -and $script:AgentMapping.ContainsKey($Category)) {
        return $script:AgentMapping[$Category]
    }
    return "general-purpose"  # Default fallback
}

function Get-TokenUsageFromLog {
    param([string]$JsonLogPath)

    $tokensArray = @()

    if (-not (Test-Path $JsonLogPath)) {
        Write-Host "       [Token] Log file not found: $JsonLogPath" -ForegroundColor Yellow
        return $tokensArray
    }

    try {
        $content = Get-Content $JsonLogPath -Raw -ErrorAction Stop

        if ([string]::IsNullOrWhiteSpace($content)) {
            Write-Host "       [Token] Log file is empty" -ForegroundColor Yellow
            return $tokensArray
        }

        # Remove BOM if present (U+FEFF = 65279)
        # Note: Only check the actual character code, not StartsWith which can be unreliable
        if ([int][char]$content[0] -eq 65279) {
            $content = $content.Substring(1)
        }

        # Try to parse as JSON array first
        $objects = @()
        try {
            $parsed = $content | ConvertFrom-Json -ErrorAction Stop
            $objects = if ($parsed -is [array]) { $parsed } else { @($parsed) }
        }
        catch {
            # Not a JSON array - try splitting by newlines (JSONL format)
            $lines = $content -split "`n"
            foreach ($line in $lines) {
                $line = $line.Trim()
                if ([string]::IsNullOrWhiteSpace($line)) { continue }
                try {
                    $obj = $line | ConvertFrom-Json -ErrorAction Stop
                    $objects += $obj
                }
                catch {
                    # Skip unparseable lines
                }
            }
        }

        # Extract context window per turn from assistant entries
        # Each assistant entry has usage data for that single turn
        foreach ($obj in $objects) {
            try {
                if ($obj.type -eq "assistant" -and $obj.message -and $obj.message.usage) {
                    $usage = $obj.message.usage
                    $inputTokens = [int]($usage.input_tokens)
                    $outputTokens = [int]($usage.output_tokens)
                    $cacheRead = if ($usage.cache_read_input_tokens) { [int]($usage.cache_read_input_tokens) } else { 0 }
                    $cacheCreate = if ($usage.cache_creation_input_tokens) { [int]($usage.cache_creation_input_tokens) } else { 0 }
                    $turnContext = $inputTokens + $outputTokens + $cacheRead + $cacheCreate

                    $tokensArray += $turnContext
                }
            }
            catch {
                # Skip malformed entries
            }
        }
    }
    catch {
        Write-Host "       [Token] Error reading log file: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    return $tokensArray
}

function Update-ProgressWithTokens {
    param(
        [string]$TaskName,
        [array]$TokensUsed,
        [string]$ProgressFilePath
    )

    Write-Host "       [DEBUG] Update-ProgressWithTokens called: Task=$TaskName, Tokens=$($TokensUsed.Count)" -ForegroundColor Magenta
    if ($TokensUsed.Count -eq 0) { return $false }

    try {
        $progressContent = Get-Content $ProgressFilePath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
        if ($progressContent.$TaskName) {
            $progressContent.$TaskName | Add-Member -NotePropertyName "tokensUsed" -NotePropertyValue $TokensUsed -Force
            $progressContent | ConvertTo-Json -Depth 10 | Set-Content $ProgressFilePath -Encoding UTF8 -ErrorAction Stop

            # Verify write succeeded by re-reading
            $verifyContent = Get-Content $ProgressFilePath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
            if ($verifyContent.$TaskName.tokensUsed -and $verifyContent.$TaskName.tokensUsed.Count -gt 0) {
                return $true
            } else {
                Write-Host "       [Token] Write verification failed for '$TaskName'" -ForegroundColor Yellow
                return $false
            }
        } else {
            Write-Host "       [Token] Task '$TaskName' not found in progress file" -ForegroundColor Yellow
            return $false
        }
    }
    catch {
        Write-Host "       [Token] Progress update failed for '$TaskName': $($_.Exception.Message)" -ForegroundColor Yellow
        return $false
    }
}

function Invoke-ProcessWorkerOutput {
    param(
        [string]$TaskName,
        [string]$OutputFile,
        [array]$TokensUsed
    )

    # Check if output file exists
    if (-not (Test-Path $OutputFile)) {
        return @{
            success = $false
            error = "Worker output file not found: $OutputFile"
            progressUpdated = $false
            boardUpdated = $false
            status = "error"
        }
    }

    # Build tokens JSON if provided
    $tokensArg = ""
    if ($TokensUsed -and $TokensUsed.Count -gt 0) {
        $tokensJson = $TokensUsed | ConvertTo-Json -Compress
        $tokensArg = "-TokensJson '$tokensJson'"
    }

    try {
        # Call the process-worker-output.ps1 script
        $scriptArgs = @(
            "-TaskName", "`"$TaskName`"",
            "-OutputFile", "`"$OutputFile`"",
            "-ProgressFile", "`"$ProgressFile`"",
            "-BoardFile", "`"$BoardFile`""
        )

        if ($TokensUsed -and $TokensUsed.Count -gt 0) {
            $tokensJson = ($TokensUsed | ConvertTo-Json -Compress) -replace '"', '\"'
            $scriptArgs += @("-TokensJson", "`"$tokensJson`"")
        }

        $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ProcessWorkerOutputScript @scriptArgs 2>&1

        # Parse JSON result
        $outputStr = $output | Out-String
        $result = $outputStr.Trim() | ConvertFrom-Json -ErrorAction Stop

        return @{
            success = $result.success
            error = $result.error
            progressUpdated = $result.progressUpdated
            boardUpdated = $result.boardUpdated
            status = $result.status
        }
    }
    catch {
        return @{
            success = $false
            error = "Failed to process worker output: $($_.Exception.Message)"
            progressUpdated = $false
            boardUpdated = $false
            status = "error"
        }
    }
}

function Set-TaskTddRunning {
    param(
        [string]$TaskName,
        [string]$TddAgentName
    )

    $startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

    try {
        $progressContent = Get-Content $ProgressFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop

        $runningEntry = @{
            status = "running"
            startedAt = $startedAt
            tddAgent = $TddAgentName
        }

        $progressContent | Add-Member -NotePropertyName $TaskName -NotePropertyValue ([PSCustomObject]$runningEntry) -Force
        $progressContent | ConvertTo-Json -Depth 10 | Set-Content $ProgressFile -Encoding UTF8 -ErrorAction Stop

        return $startedAt
    }
    catch {
        Write-Host "       [Error] Failed to mark task '$TaskName' as running (TDD): $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Set-TaskRunning {
    param(
        [string]$TaskName,
        [string]$AgentName
    )

    try {
        $progressContent = Get-Content $ProgressFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop

        # Check if task already has a progress entry (from TDD phase)
        $existingEntry = $progressContent.PSObject.Properties[$TaskName]

        if ($existingEntry) {
            # Preserve existing fields (startedAt, tddAgent, status) and add implementation agent
            $existingEntry.Value | Add-Member -NotePropertyName "agent" -NotePropertyValue $AgentName -Force
            $progressContent | ConvertTo-Json -Depth 10 | Set-Content $ProgressFile -Encoding UTF8 -ErrorAction Stop
            return $existingEntry.Value.startedAt
        }
        else {
            # No TDD phase - create new entry (for testing category tasks that skip Phase 1)
            $startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            $runningEntry = @{
                status = "running"
                startedAt = $startedAt
                agent = $AgentName
            }
            $progressContent | Add-Member -NotePropertyName $TaskName -NotePropertyValue ([PSCustomObject]$runningEntry) -Force
            $progressContent | ConvertTo-Json -Depth 10 | Set-Content $ProgressFile -Encoding UTF8 -ErrorAction Stop
            return $startedAt
        }
    }
    catch {
        Write-Host "       [Error] Failed to mark task '$TaskName' as running: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Invoke-ParseWorkerLog {
    param(
        [string]$TaskName,
        [string]$JsonLogPath,
        [string]$OutputFilePath,
        [string]$AgentName,
        [string]$StartedAt,
        [switch]$IsTdd
    )

    if (-not (Test-Path $JsonLogPath)) {
        return @{
            success = $false
            error = "JSON log file not found: $JsonLogPath"
        }
    }

    try {
        $scriptArgs = @(
            "-TaskName", "`"$TaskName`"",
            "-JsonLogPath", "`"$JsonLogPath`"",
            "-OutputFilePath", "`"$OutputFilePath`"",
            "-AgentName", "`"$AgentName`""
        )

        if ($StartedAt) {
            $scriptArgs += @("-StartedAt", "`"$StartedAt`"")
        }

        if ($IsTdd) {
            $scriptArgs += @("-IsTdd")
        }

        $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ParseWorkerLogScript @scriptArgs 2>&1

        # Parse JSON result
        $outputStr = $output | Out-String
        $result = $outputStr.Trim() | ConvertFrom-Json -ErrorAction Stop

        return @{
            success = $result.success
            error = $result.error
            status = $result.status
            affectedFilesCount = $result.affectedFilesCount
            tokensCount = $result.tokensCount
            verificationPassed = $result.verificationPassed
            outputFile = $result.outputFile
        }
    }
    catch {
        return @{
            success = $false
            error = "Failed to parse worker log: $($_.Exception.Message)"
        }
    }
}

function Build-WorkerPrompt {
    param(
        [object]$Task,
        [object]$Board,
        [string]$TemplatePath,
        [array]$TddAffectedFiles = @(),
        [hashtable]$Progress = @()
    )

    # Read template
    if (Test-Path $TemplatePath) {
        $template = Get-Content $TemplatePath -Raw
    } else {
        # Fallback inline template if file doesn't exist
        $template = @"
# Kanban Worker Task Prompt

You are a worker process executing a single kanban task. Complete the assigned task following project patterns and update all required kanban files when finished.

---

## Project Context

{project.context}

---

## Task Assignment

**Name**: {task.name}
**Category**: {task.category}
**Agent**: {agent-name}
**Project Type**: {projectType}

### Description

{task.description}

### Pre-Created Test Files

{test.files}

### Verification Steps

Complete these steps in order to verify your implementation:

{task.steps}

---

## Worker Responsibilities

1. **Review Pre-Created Tests** (if test files exist above)
   - Read the test files to understand expected behavior
   - Tests define the acceptance criteria for your implementation
   - Your goal is to make ALL tests pass

2. **Implement the Task**
   - Follow the description and any implementation details provided
   - Use existing project patterns and conventions
   - Ensure code is properly typed (TypeScript)

3. **Run Tests** (MANDATORY if test files exist)
   - Run the test suite: npm run test or the project's test command
   - All pre-created tests MUST pass
   - Fix your implementation if any tests fail

4. **Verify All Steps**
   - Execute each verification step in order
   - Document the result of each step
   - All steps must pass before marking complete

5. **Report Results**
   - Print test results summary (pass/fail count)
   - Print verification step results: Step N: PASS or Step N: FAIL - reason
"@
    }

    # Build numbered steps list
    $stepsText = ""
    $stepNum = 1
    foreach ($step in $Task.steps) {
        $stepsText += "$stepNum. $step`n"
        $stepNum++
    }

    # Build test files section
    $testFilesText = "No pre-created test files for this task."
    if ($TddAffectedFiles -and $TddAffectedFiles.Count -gt 0) {
        $testFilesText = "The following test files have been created for this task. Your implementation MUST pass all tests:`n`n"
        foreach ($testFile in $TddAffectedFiles) {
            $testFilesText += "- ``$testFile```n"
        }
        $testFilesText += "`nRun tests with: ``npm run test`` or the project's test command."
    }

    $agentName = Get-AgentForCategory -Category $Task.category

    # Get project-specific context (import aliases, FSD rules, conventions)
    $projectContext = Get-ProjectContext -ProjectRoot $ProjectRoot

    # Get dependency context from blockedBy tasks
    $dependencyContext = Get-DependencyContext -Task $Task -Progress $Progress -AllTasks $Board.tasks

    # Replace placeholders using the existing template format
    # The template uses {placeholder} style, need to escape braces for regex
    $prompt = $template
    $prompt = $prompt -replace '\{task\.name\}', $Task.name
    $prompt = $prompt -replace '\{task\.category\}', $Task.category
    $prompt = $prompt -replace '\{task\.description\}', $Task.description
    $prompt = $prompt -replace '\{task\.steps\}', $stepsText.TrimEnd()
    $prompt = $prompt -replace '\{agent-name\}', $agentName
    $prompt = $prompt -replace '\{projectType\}', $Board.projectType
    $prompt = $prompt -replace '\{test\.files\}', $testFilesText
    $prompt = $prompt -replace '\{project\.context\}', $projectContext
    $prompt = $prompt -replace '\{dependency\.context\}', $dependencyContext

    return $prompt
}

function Build-TestCreationPrompt {
    param(
        [object]$Task,
        [object]$Board
    )

    # Build numbered steps list
    $stepsText = ""
    $stepNum = 1
    foreach ($step in $Task.steps) {
        $stepsText += "$stepNum. $step`n"
        $stepNum++
    }

    # Build simple prompt - agent has all kanban knowledge built-in
    $prompt = @"
Create tests for this kanban task:

**Name**: $($Task.name)
**Category**: $($Task.category)
**Project Type**: $($Board.projectType)

### Description (What Will Be Implemented)

$($Task.description)

### Verification Steps (Map to Test Cases)

$($stepsText.TrimEnd())

---

Create comprehensive tests that:
1. Initially FAIL (implementation doesn't exist yet)
2. PASS once implementation is correct
3. Cover ALL verification steps above

Report created test files when done.
"@

    return $prompt
}

function Start-TestCreationJob {
    param(
        [object]$Task,
        [string]$Prompt,
        [string]$JsonLogPath
    )

    $taskName = $Task.name
    $agentName = "kanban-unit-tester"

    # Mark task as "running" when TDD test creation starts (Phase 1)
    $startedAt = Set-TaskTddRunning -TaskName $taskName -TddAgentName $agentName
    if (-not $startedAt) {
        Write-Host "       [Warning] Could not mark task '$taskName' as running" -ForegroundColor Yellow
        $startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }

    # Write prompt to a temp file
    $promptFile = Join-Path $LogsDir "$taskName-test-creation-prompt.txt"
    $Prompt | Set-Content -Path $promptFile -Encoding UTF8 -NoNewline

    # Initialize log file
    "" | Set-Content -Path $JsonLogPath -Encoding UTF8 -NoNewline

    # Spawn kanban-unit-tester agent
    $cmdScript = "cd /d `"$ProjectRoot`" && type `"$promptFile`" | claude -p --dangerously-skip-permissions --output-format stream-json 2>`"$JsonLogPath.stderr`" >> `"$JsonLogPath`""

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "cmd.exe"
    $processInfo.Arguments = "/c $cmdScript"
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true
    $processInfo.WorkingDirectory = $ProjectRoot

    $process = [System.Diagnostics.Process]::Start($processInfo)

    return @{
        Process = $process
        Task = $Task
        JsonLogPath = $JsonLogPath
        AgentName = $agentName
        StartedAt = $startedAt
    }
}

function Wait-TestCreationBatch {
    param([array]$Workers)

    $results = @()

    # Wait for all processes to complete
    foreach ($worker in $Workers) {
        $worker.Process.WaitForExit()
    }

    foreach ($worker in $Workers) {
        $task = $worker.Task
        $taskName = $task.name
        $jsonLogPath = $worker.JsonLogPath
        $startedAt = $worker.StartedAt
        $agentName = $worker.AgentName

        # Wait for log file to be ready
        $maxWaitMs = 5000
        $waitIntervalMs = 100
        $waitedMs = 0
        $fileReady = $false

        while ($waitedMs -lt $maxWaitMs -and -not $fileReady) {
            if (Test-Path $jsonLogPath) {
                $fileInfo = Get-Item $jsonLogPath -ErrorAction SilentlyContinue
                if ($fileInfo -and $fileInfo.Length -gt 100) {
                    try {
                        $testContent = Get-Content $jsonLogPath -Raw -ErrorAction Stop
                        $lines = $testContent -split "`n" | Where-Object { $_.Trim() -ne "" }
                        if ($lines.Count -gt 0) {
                            foreach ($line in $lines) {
                                if ($line -match '"type"\s*:\s*"result"') {
                                    $fileReady = $true
                                    break
                                }
                            }
                        }
                    } catch {
                        # File not ready yet
                    }
                }
            }
            if (-not $fileReady) {
                Start-Sleep -Milliseconds $waitIntervalMs
                $waitedMs += $waitIntervalMs
            }
        }

        # Create output file path for TDD phase
        $outputFilePath = Join-Path $LogsDir "$taskName-test-creation-output.json"

        # Parse the raw log to create structured output (consistent with implementation workers)
        Write-Host "       [TDD] Parsing raw log for $taskName..." -ForegroundColor Gray
        $parseResult = Invoke-ParseWorkerLog -TaskName $taskName -JsonLogPath $jsonLogPath -OutputFilePath $outputFilePath -AgentName $agentName -StartedAt $startedAt -IsTdd

        # Extract affected files from the output file (TDD workers only create test files, so 100% are test files)
        $tddAffectedFiles = @()
        if ($parseResult -and $parseResult.success -and (Test-Path $outputFilePath)) {
            try {
                $outputContent = Get-Content $outputFilePath -Raw | ConvertFrom-Json
                if ($outputContent.affectedFiles) {
                    $tddAffectedFiles = @($outputContent.affectedFiles)
                }
            }
            catch {
                Write-Host "       [TDD] Could not read output file, falling back to raw log parsing" -ForegroundColor Yellow
                $tddAffectedFiles = Get-TestFilesFromLog -JsonLogPath $jsonLogPath
            }
        }
        else {
            # Fallback to raw log parsing if output file creation failed
            $tddAffectedFiles = Get-TestFilesFromLog -JsonLogPath $jsonLogPath
        }

        $results += @{
            Task = $task
            JsonLogPath = $jsonLogPath
            OutputFilePath = $outputFilePath
            TddAffectedFiles = $tddAffectedFiles
            Success = ($tddAffectedFiles.Count -gt 0)
        }
    }

    return $results
}

function Get-TestFilesFromLog {
    param([string]$JsonLogPath)

    $testFiles = @()

    if (-not (Test-Path $JsonLogPath)) {
        return $testFiles
    }

    try {
        $content = Get-Content $JsonLogPath -Raw -ErrorAction Stop

        if ([string]::IsNullOrWhiteSpace($content)) {
            return $testFiles
        }

        # Remove BOM if present
        if ([int][char]$content[0] -eq 65279) {
            $content = $content.Substring(1)
        }

        # Parse JSONL format
        $lines = $content -split "`n"
        foreach ($line in $lines) {
            $line = $line.Trim()
            if ([string]::IsNullOrWhiteSpace($line)) { continue }

            try {
                $obj = $line | ConvertFrom-Json -ErrorAction Stop

                # Look for Write/Edit tool calls to extract created test files
                if ($obj.type -eq "assistant" -and $obj.message -and $obj.message.content) {
                    foreach ($contentItem in $obj.message.content) {
                        if ($contentItem.type -eq "tool_use") {
                            $toolName = $contentItem.name
                            if ($toolName -eq "Write" -or $toolName -eq "Edit") {
                                $input = $contentItem.input
                                if ($input -and $input.file_path) {
                                    $filePath = $input.file_path
                                    # Check if it's a test file
                                    if ($filePath -match '\.(test|spec)\.(ts|js|tsx|jsx)$' -or
                                        $filePath -match 'test_.*\.py$' -or
                                        $filePath -match '.*_test\.py$' -or
                                        $filePath -match '.*_test\.go$') {
                                        # Convert to relative path if absolute
                                        if ($filePath.StartsWith($ProjectRoot)) {
                                            $filePath = $filePath.Substring($ProjectRoot.Length).TrimStart('\', '/')
                                        }
                                        if ($testFiles -notcontains $filePath) {
                                            $testFiles += $filePath
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch {
                # Skip unparseable lines
            }
        }
    }
    catch {
        Write-Host "       [TestFiles] Error reading log: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    return $testFiles
}

function Get-TaskStatus {
    param(
        [object]$Task,
        [hashtable]$Progress
    )

    $entry = $Progress[$Task.name]

    if ($Task.passes -eq $true) {
        # Task verification passed
        if ($entry -and $entry.status -eq "completed") {
            return "completed"
        }
        return "code-review"
    } else {
        # Task verification not yet passed
        if ($entry) {
            # Check the status field in progress entry
            $status = $entry.status
            if ($status -eq "blocked") {
                return "blocked"
            } elseif ($status -eq "running") {
                return "in-progress"
            } elseif ($status -eq "completed" -or $status -eq "error") {
                # Worker finished but passes is false - likely verification failed
                return "in-progress"
            }
            # Entry without status field
            return "in-progress"
        }
        return "pending"
    }
}

function Get-TasksForWave {
    param(
        [array]$Tasks,
        [hashtable]$Progress,
        [int]$WaveNumber
    )

    $categories = $WaveDefinitions[$WaveNumber]
    if (-not $categories) {
        return @()
    }

    $waveTasks = @()
    foreach ($task in $Tasks) {
        if ($categories -contains $task.category) {
            $status = Get-TaskStatus -Task $task -Progress $Progress

            if ($status -eq "pending") {
                # Check if blockedBy dependencies are met
                $isReady = Test-TaskReady -Task $task -Progress $Progress -AllTasks $Tasks

                if ($isReady) {
                    $waveTasks += $task
                } else {
                    Write-Host "       [Blocked] $($task.name) waiting for dependencies: $($task.blockedBy -join ', ')" -ForegroundColor Yellow
                }
            }
        }
    }

    return $waveTasks
}

function Initialize-Directories {
    if (-not (Test-Path $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
        Write-Host "Created worker-logs directory: $LogsDir" -ForegroundColor Gray
    }
}

function Start-WorkerJob {
    param(
        [object]$Task,
        [string]$Prompt,
        [string]$LogPath,
        [string]$JsonLogPath,
        [string]$OutputFilePath
    )

    $taskName = $Task.name
    $agentName = Get-AgentForCategory -Category $Task.category

    # DISPATCHER RESPONSIBILITY: Mark task as "running" BEFORE spawning worker
    # Set-TaskRunning now returns the startedAt timestamp
    $startedAt = Set-TaskRunning -TaskName $taskName -AgentName $agentName
    if (-not $startedAt) {
        Write-Host "       [Warning] Could not mark task '$taskName' as running" -ForegroundColor Yellow
        $startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }

    # Write prompt to a temp file for the worker to use
    $promptFile = Join-Path $LogsDir "$taskName-prompt.txt"
    $Prompt | Set-Content -Path $promptFile -Encoding UTF8 -NoNewline

    # Initialize log file (clear any previous content)
    "" | Set-Content -Path $JsonLogPath -Encoding UTF8 -NoNewline

    # Use cmd.exe to properly pipe the file content to claude via type command
    # This avoids PowerShell pipe issues with the claude.ps1 wrapper
    $cmdScript = "cd /d `"$ProjectRoot`" && type `"$promptFile`" | claude -p --dangerously-skip-permissions --output-format stream-json 2>`"$JsonLogPath.stderr`" >> `"$JsonLogPath`""

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "cmd.exe"
    $processInfo.Arguments = "/c $cmdScript"
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true
    $processInfo.WorkingDirectory = $ProjectRoot

    $process = [System.Diagnostics.Process]::Start($processInfo)

    return @{
        Process = $process
        Task = $Task
        LogPath = $LogPath
        JsonLogPath = $JsonLogPath
        OutputFilePath = $OutputFilePath
        StartedAt = $startedAt
        AgentName = $agentName
    }
}

function Wait-WorkerBatch {
    param([array]$Workers)

    $results = @()

    # Wait for all processes to complete
    foreach ($worker in $Workers) {
        $worker.Process.WaitForExit()
    }

    foreach ($worker in $Workers) {
        $task = $worker.Task
        $logPath = $worker.LogPath
        $taskName = $task.name
        $jsonLogPath = $worker.JsonLogPath
        $outputFilePath = $worker.OutputFilePath

        # Process has already exited at this point

        # Wait for JSON log file to be ready (with timeout) for token extraction
        $maxWaitMs = 5000  # 5 second timeout
        $waitIntervalMs = 100
        $waitedMs = 0
        $fileReady = $false

        while ($waitedMs -lt $maxWaitMs -and -not $fileReady) {
            if (Test-Path $jsonLogPath) {
                $fileInfo = Get-Item $jsonLogPath -ErrorAction SilentlyContinue
                # File exists and has content - check for JSONL completion marker
                if ($fileInfo -and $fileInfo.Length -gt 100) {
                    try {
                        $testContent = Get-Content $jsonLogPath -Raw -ErrorAction Stop
                        # For JSONL: Check if any line contains "type":"result" (completion marker)
                        $lines = $testContent -split "`n" | Where-Object { $_.Trim() -ne "" }
                        if ($lines.Count -gt 0) {
                            foreach ($line in $lines) {
                                if ($line -match '"type"\s*:\s*"result"') {
                                    $fileReady = $true
                                    break
                                }
                            }
                        }
                    } catch {
                        # File not ready yet
                    }
                }
            }
            if (-not $fileReady) {
                Start-Sleep -Milliseconds $waitIntervalMs
                $waitedMs += $waitIntervalMs
            }
        }

        if (-not $fileReady) {
            Write-Host "       [Warning] JSON log not ready after ${maxWaitMs}ms for $taskName" -ForegroundColor Yellow
        }

        # NEW APPROACH: Parse raw log to create output file (dispatcher owns output file creation)
        # This ensures consistent data extraction regardless of worker behavior
        $agentName = $worker.AgentName
        $startedAt = $worker.StartedAt

        Write-Host "       [Dispatcher] Parsing raw log for $taskName..." -ForegroundColor Gray
        $parseResult = Invoke-ParseWorkerLog -TaskName $taskName -JsonLogPath $jsonLogPath -OutputFilePath $outputFilePath -AgentName $agentName -StartedAt $startedAt

        # ============================================================
        # DISPATCHER-SIDE TEST VERIFICATION
        # Run tests directly instead of parsing worker output
        # Read affectedFiles from TDD output file (TDD workers only create test files)
        # ============================================================
        $tddOutputPath = Join-Path $LogsDir "$taskName-test-creation-output.json"
        $taskTddAffectedFiles = @()
        if (Test-Path $tddOutputPath) {
            try {
                $tddOutput = Get-Content $tddOutputPath -Raw | ConvertFrom-Json
                if ($tddOutput.affectedFiles) {
                    $taskTddAffectedFiles = @($tddOutput.affectedFiles)
                }
            } catch {
                Write-Host "       [Warning] Could not read TDD output file for ${taskName}: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }

        if ($taskTddAffectedFiles.Count -gt 0) {
            Write-Host "       [Dispatcher] Verifying $($taskTddAffectedFiles.Count) test file(s)..." -ForegroundColor Cyan

            $runTestsScript = Join-Path $ScriptDir "run-tests.ps1"
            $configFile = Join-Path $ProjectRoot ".kanban/config.json"

            try {
                $testResultJson = & powershell -NoProfile -ExecutionPolicy Bypass -File $runTestsScript -TestFiles $taskTddAffectedFiles -ConfigFile $configFile -WorkingDir $ProjectRoot 2>&1 | Out-String
                $testResult = $testResultJson.Trim() | ConvertFrom-Json -ErrorAction Stop

                # Update output file with dispatcher's actual test results
                if (Test-Path $outputFilePath) {
                    $outputContent = Get-Content $outputFilePath -Raw | ConvertFrom-Json

                    $outputContent.verification = @{
                        passed = $testResult.passed
                        testResults = @{
                            totalTests = $testResult.totalTests
                            passedTests = $testResult.passedTests
                            failedTests = $testResult.failedTests
                        }
                        source = "dispatcher"
                    }

                    $outputContent.status = if ($testResult.passed) { "success" } else { "error" }
                    $outputContent | ConvertTo-Json -Depth 10 | Set-Content $outputFilePath -Encoding UTF8
                }

                if ($testResult.passed) {
                    Write-Host "       [PASS] All $($testResult.passedTests) test(s) passed" -ForegroundColor Green
                } else {
                    Write-Host "       [FAIL] $($testResult.failedTests) of $($testResult.totalTests) test(s) failed" -ForegroundColor Red
                    # Store failure context for retry prompt
                    $parseResult.testFailureOutput = $testResult.output
                }
            }
            catch {
                Write-Host "       [Warning] Dispatcher test run failed: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }

        # Initialize variables
        $tokensUsed = @()
        $finalTokens = 0
        $status = $null
        $validationWarnings = @()

        if ($parseResult -and $parseResult.success) {
            $filesCount = if ($parseResult.affectedFilesCount) { $parseResult.affectedFilesCount } else { 0 }
            $tokensCount = if ($parseResult.tokensCount) { $parseResult.tokensCount } else { 0 }
            Write-Host "       [Dispatcher] Parsed: $filesCount files, $tokensCount token entries" -ForegroundColor Gray

            # Extract token usage from JSON log for display (parse script also extracts this)
            $tokensUsed = Get-TokenUsageFromLog -JsonLogPath $jsonLogPath
            $finalTokens = if ($tokensUsed -and $tokensUsed.Count -gt 0) { $tokensUsed[-1] } else { 0 }

            # Process the parsed output file via dedicated script
            $processResult = Invoke-ProcessWorkerOutput -TaskName $taskName -OutputFile $outputFilePath -TokensUsed $tokensUsed

            if ($processResult -and $processResult.success) {
                $resultStatus = if ($processResult.status) { $processResult.status } else { "unknown" }
                $status = @{
                    status = $resultStatus
                    validationWarnings = @()
                }

                # Add info about what was updated
                if ($processResult.progressUpdated) {
                    Write-Host "       [Dispatcher] Updated progress.json for $taskName" -ForegroundColor Gray
                }
                if ($processResult.boardUpdated) {
                    Write-Host "       [Dispatcher] Updated board.json passes=true for $taskName" -ForegroundColor Gray
                }
                elseif ($processResult.status -eq "completed" -and -not $parseResult.verificationPassed) {
                    $validationWarnings += "Worker completed but verification did not pass - board.json not updated"
                }
            }
            else {
                $status = @{
                    status = "error"
                    error = $processResult.error
                    validationWarnings = @("Failed to process worker output")
                }
            }
        }
        else {
            # Parse failed - try to extract tokens anyway for diagnostics
            $tokensUsed = Get-TokenUsageFromLog -JsonLogPath $jsonLogPath
            $finalTokens = if ($tokensUsed.Count -gt 0) { $tokensUsed[-1] } else { 0 }

            $status = @{
                status = "error"
                error = $parseResult.error
                validationWarnings = @("Failed to parse worker log: $($parseResult.error)")
            }
            Write-Host "       [Error] Failed to parse log for $taskName`: $($parseResult.error)" -ForegroundColor Red
        }

        $status.validationWarnings = $validationWarnings

        $results += @{
            Task = $task
            Status = $status
            LogPath = $logPath
            JsonLogPath = $jsonLogPath
            OutputFilePath = $outputFilePath
            TokensUsed = $tokensUsed
            FinalTokens = $finalTokens
        }
    }

    return $results
}

function Show-BatchResults {
    param([array]$Results)

    Write-SubHeader "Batch Results"

    $successCount = 0
    $failureCount = 0
    $warningCount = 0

    foreach ($result in $Results) {
        $taskName = $result.Task.name
        $status = $result.Status

        # Accept "success", "completed", and "code-review" as valid success states
        if ($status.status -eq "success" -or $status.status -eq "completed" -or $status.status -eq "code-review") {
            # Check if there's a critical passes warning
            $hasCriticalPassesWarning = $status.validationWarnings | Where-Object { $_ -like "*passes*" }

            if ($hasCriticalPassesWarning) {
                # Worker completed but didn't update board - show prominent warning
                Write-Host "[WARN] " -ForegroundColor Yellow -NoNewline
                Write-Host "$taskName" -ForegroundColor White -NoNewline
                Write-Host " - worker finished but task stuck in 'in-progress'" -ForegroundColor Yellow
            } else {
                Write-Host "[PASS] " -ForegroundColor Green -NoNewline
                Write-Host "$taskName" -ForegroundColor White
            }

            if ($status.summary) {
                Write-Host "       $($status.summary)" -ForegroundColor Gray
            }
            $successCount++

            # Display token usage for successful tasks
            if ($result.FinalTokens -gt 0) {
                $tokenLimit = 200000
                $percentage = [math]::Round(($result.FinalTokens / $tokenLimit) * 100, 1)
                $tokenDisplay = "{0:N0}" -f $result.FinalTokens
                Write-Host "       Tokens: $tokenDisplay / 200,000 ($percentage%)" -ForegroundColor DarkGray
            }

            # Display validation warnings for successful tasks
            if ($status.validationWarnings -and $status.validationWarnings.Count -gt 0) {
                $warningCount += $status.validationWarnings.Count
                Write-Host "       Warnings:" -ForegroundColor Yellow
                foreach ($warning in $status.validationWarnings) {
                    Write-Host "         - $warning" -ForegroundColor Yellow
                }
            }
        } elseif ($status.status -eq "blocked") {
            Write-Host "[BLOCKED] " -ForegroundColor Magenta -NoNewline
            Write-Host "$taskName" -ForegroundColor White
            if ($status.error) {
                Write-Host "       Reason: $($status.error)" -ForegroundColor Magenta
            }
            Write-Host "       Log: $($result.JsonLogPath)" -ForegroundColor DarkGray

            # Display token usage for blocked tasks
            if ($result.FinalTokens -gt 0) {
                $tokenLimit = 200000
                $percentage = [math]::Round(($result.FinalTokens / $tokenLimit) * 100, 1)
                $tokenDisplay = "{0:N0}" -f $result.FinalTokens
                Write-Host "       Tokens: $tokenDisplay / 200,000 ($percentage%)" -ForegroundColor DarkGray
            }

            # Display validation warnings for blocked tasks
            if ($status.validationWarnings -and $status.validationWarnings.Count -gt 0) {
                $warningCount += $status.validationWarnings.Count
                Write-Host "       Warnings:" -ForegroundColor Yellow
                foreach ($warning in $status.validationWarnings) {
                    Write-Host "         - $warning" -ForegroundColor Yellow
                }
            }
            $failureCount++
        } else {
            Write-Host "[FAIL] " -ForegroundColor Red -NoNewline
            Write-Host "$taskName" -ForegroundColor White
            if ($status.error) {
                Write-Host "       Error: $($status.error)" -ForegroundColor Red
            }
            Write-Host "       Log: $($result.JsonLogPath)" -ForegroundColor DarkGray

            # Display token usage for failed tasks
            if ($result.FinalTokens -gt 0) {
                $tokenLimit = 200000
                $percentage = [math]::Round(($result.FinalTokens / $tokenLimit) * 100, 1)
                $tokenDisplay = "{0:N0}" -f $result.FinalTokens
                Write-Host "       Tokens: $tokenDisplay / 200,000 ($percentage%)" -ForegroundColor DarkGray
            }

            # Display validation warnings for failed tasks
            if ($status.validationWarnings -and $status.validationWarnings.Count -gt 0) {
                $warningCount += $status.validationWarnings.Count
                Write-Host "       Warnings:" -ForegroundColor Yellow
                foreach ($warning in $status.validationWarnings) {
                    Write-Host "         - $warning" -ForegroundColor Yellow
                }
            }
            $failureCount++
        }
    }

    # Calculate batch token total - handle missing FinalTokens property
    $batchTokens = 0
    foreach ($r in $Results) {
        if ($r.FinalTokens) {
            $batchTokens += $r.FinalTokens
        }
    }

    Write-Host ""
    Write-Host "Batch Summary: " -NoNewline
    Write-Host "$successCount passed" -ForegroundColor Green -NoNewline
    Write-Host ", " -NoNewline
    Write-Host "$failureCount failed" -ForegroundColor Red -NoNewline
    if ($warningCount -gt 0) {
        Write-Host ", " -NoNewline
        Write-Host "$warningCount validation warnings" -ForegroundColor Yellow -NoNewline
    }

    if ($batchTokens -gt 0) {
        $batchTokenDisplay = "{0:N0}" -f $batchTokens
        Write-Host ""
        Write-Host "Batch Total: $batchTokenDisplay tokens across $($Results.Count) tasks" -ForegroundColor Cyan
    } else {
        Write-Host ""
    }

    return @{
        SuccessCount = $successCount
        FailureCount = $failureCount
        WarningCount = $warningCount
        TotalTokens = $batchTokens
        FailedTasks = $Results | Where-Object { $_.Status.status -ne "success" -and $_.Status.status -ne "completed" -and $_.Status.status -ne "code-review" }
    }
}

function Handle-FailedTasks {
    param([array]$FailedResults)

    if (-not $FailedResults -or $FailedResults.Count -eq 0) {
        return @()
    }

    Write-Host ""
    Write-Host "Some tasks failed. What would you like to do?" -ForegroundColor Yellow

    # In non-interactive mode, use the default action
    if ($NonInteractive) {
        Write-Host "[Non-interactive mode] Using default action: $DefaultFailAction" -ForegroundColor Cyan

        switch ($DefaultFailAction) {
            "Retry" {
                Write-Host "Retrying failed tasks..." -ForegroundColor Yellow
                return $FailedResults | ForEach-Object { $_.Task }
            }
            "Skip" {
                Write-Host "Skipping failed tasks..." -ForegroundColor Yellow
                return @()
            }
            "Quit" {
                Write-Host "Stopping execution." -ForegroundColor Yellow
                exit 0
            }
        }
        return @()
    }

    # Interactive mode - prompt user
    Write-Host "  [R]etry  - Retry all failed tasks"
    Write-Host "  [S]kip   - Skip failed tasks and continue"
    Write-Host "  [Q]uit   - Stop processing"
    Write-Host ""

    $response = Read-Host "Enter choice (R/S/Q)"

    switch ($response.ToUpper()) {
        "R" {
            return $FailedResults | ForEach-Object { $_.Task }
        }
        "S" {
            Write-Host "Skipping failed tasks..." -ForegroundColor Yellow
            return @()
        }
        "Q" {
            Write-Host "Stopping execution." -ForegroundColor Yellow
            exit 0
        }
        default {
            Write-Host "Invalid choice. Skipping failed tasks." -ForegroundColor Yellow
            return @()
        }
    }
}

#endregion

#region Main Execution

function Main {
    Write-Header "KANBAN PARALLEL DISPATCHER"

    # Validate kanban files exist
    if (-not (Test-Path $BoardFile)) {
        Write-Host "Error: Kanban board not found at $BoardFile" -ForegroundColor Red
        Write-Host "Run 'kanban:create' first to create the board." -ForegroundColor Yellow
        exit 1
    }

    if (-not (Test-Path $ProgressFile)) {
        Write-Host "Error: Progress file not found at $ProgressFile" -ForegroundColor Red
        Write-Host "Run 'kanban:create' first to initialize the progress file." -ForegroundColor Yellow
        exit 1
    }

    # Read kanban files
    Write-Host "Reading kanban files..." -ForegroundColor Gray
    $board = Get-Content $BoardFile -Raw | ConvertFrom-Json
    $progressRaw = Get-Content $ProgressFile -Raw | ConvertFrom-Json

    # Convert progress to hashtable for easier lookup
    $progress = @{}
    if ($progressRaw -and $progressRaw.PSObject.Properties) {
        foreach ($prop in $progressRaw.PSObject.Properties) {
            $progress[$prop.Name] = $prop.Value
        }
    }

    # Validate no circular dependencies
    Write-Host "Validating dependencies..." -ForegroundColor Gray
    if (-not (Test-CircularDependencies -Tasks $board.tasks)) {
        Write-Host "Error: Circular dependencies detected in kanban board. Fix blockedBy fields." -ForegroundColor Red
        exit 1
    }

    # Detect project stack and available agents
    Write-Host "Detecting project agents..." -ForegroundColor Gray
    $agentResult = Get-ProjectAgentMapping -ProjectRoot $ProjectRoot
    $script:AgentMapping = $agentResult.mapping
    $detected = $agentResult.detected

    # Display detected configuration
    $detectedParts = @()
    if ($detected.frontendFramework) { $detectedParts += "frontend=$($detected.frontendFramework)" }
    if ($detected.language) { $detectedParts += "language=$($detected.language)" }
    if ($detectedParts.Count -gt 0) {
        Write-Host "Detected: $($detectedParts -join ', ')" -ForegroundColor Gray
    }

    Write-Host "Project: $($board.project)" -ForegroundColor White
    Write-Host "Total Tasks: $($board.tasks.Count)" -ForegroundColor White
    Write-Host "Max Parallel Workers: $Parallel" -ForegroundColor White

    if ($DryRun) {
        Write-Host "[DRY RUN MODE - No tasks will be executed]" -ForegroundColor Magenta
    }

    # Initialize directories
    Initialize-Directories

    # Calculate task statistics
    $pending = 0
    $inProgress = 0
    $codeReview = 0
    $completed = 0

    foreach ($task in $board.tasks) {
        $status = Get-TaskStatus -Task $task -Progress $progress
        switch ($status) {
            "pending" { $pending++ }
            "in-progress" { $inProgress++ }
            "code-review" { $codeReview++ }
            "completed" { $completed++ }
        }
    }

    Write-SubHeader "Current Progress"
    Write-Host "Pending:     $pending" -ForegroundColor Yellow
    Write-Host "In Progress: $inProgress" -ForegroundColor Cyan
    Write-Host "Code Review: $codeReview" -ForegroundColor Magenta
    Write-Host "Completed:   $completed" -ForegroundColor Green

    if ($pending -eq 0 -and $inProgress -eq 0) {
        Write-Host ""
        Write-Host "No pending tasks to process." -ForegroundColor Green
        if ($codeReview -gt 0) {
            Write-Host "There are $codeReview tasks awaiting code review." -ForegroundColor Yellow
        }
        exit 0
    }

    # Process waves
    $totalSuccess = 0
    $totalFailure = 0
    $totalTokens = 0
    $taskTokens = @{}

    foreach ($waveNum in 1..5) {
        $waveTasks = Get-TasksForWave -Tasks $board.tasks -Progress $progress -WaveNumber $waveNum

        if ($waveTasks.Count -eq 0) {
            continue
        }

        $categories = $WaveDefinitions[$waveNum] -join ", "
        Write-Header "WAVE $waveNum [$categories]"
        Write-Host "Tasks in this wave: $($waveTasks.Count)" -ForegroundColor White

        # List tasks in wave
        foreach ($task in $waveTasks) {
            $agent = Get-AgentForCategory -Category $task.category
            Write-Host "  - $($task.name) " -NoNewline -ForegroundColor White
            Write-Host "[$($task.category)]" -NoNewline -ForegroundColor DarkGray
            Write-Host " -> $agent" -ForegroundColor Cyan
        }

        if ($DryRun) {
            Write-Host ""
            Write-Host "[DRY RUN] Would process $($waveTasks.Count) tasks with $Parallel workers" -ForegroundColor Magenta
            continue
        }

        # Process tasks in batches - use standard array instead of ArrayList
        $taskQueue = @($waveTasks)
        $queueIndex = 0

        # Track TDD affected files (test files) created for each task
        $taskTddAffectedFiles = @{}

        while ($queueIndex -lt $taskQueue.Count) {
            # Get batch of tasks
            $remainingCount = $taskQueue.Count - $queueIndex
            $batchSize = [Math]::Min($Parallel, $remainingCount)
            $batch = $taskQueue[$queueIndex..($queueIndex + $batchSize - 1)]
            $queueIndex += $batchSize

            Write-SubHeader "Processing Batch ($batchSize tasks)"

            # ============================================================
            # PHASE 1: TDD TEST CREATION (for non-testing categories)
            # ============================================================
            $tddBatch = @($batch | Where-Object { $TddCategories -contains $_.category })

            if ($tddBatch.Count -gt 0) {
                Write-Host ""
                Write-Host "[TDD] Creating tests for $($tddBatch.Count) tasks before implementation..." -ForegroundColor Magenta

                # Start test creation workers
                $testCreators = @()
                foreach ($task in $tddBatch) {
                    $testPrompt = Build-TestCreationPrompt -Task $task -Board $board
                    $testLogPath = Join-Path $LogsDir "$($task.name)-test-creation.txt"

                    Write-Host "  [TDD] Starting test creation for: $($task.name)" -ForegroundColor Magenta

                    $testCreator = Start-TestCreationJob -Task $task -Prompt $testPrompt -JsonLogPath $testLogPath
                    $testCreators += $testCreator
                }

                Write-Host ""
                Write-Host "[TDD] Waiting for $($testCreators.Count) test creators to complete..." -ForegroundColor Magenta

                # Wait for test creation to complete
                $testResults = Wait-TestCreationBatch -Workers $testCreators

                # Display test creation results and store TDD affected files
                Write-Host ""
                Write-Host "[TDD] Test Creation Results:" -ForegroundColor Magenta
                foreach ($result in $testResults) {
                    $taskName = $result.Task.name
                    $tddFiles = $result.TddAffectedFiles
                    $taskTddAffectedFiles[$taskName] = $tddFiles

                    # Persist TDD affected files to progress.json for dispatcher verification
                    if ($tddFiles -and $tddFiles.Count -gt 0) {
                        try {
                            $progressContent = Get-Content $ProgressFile -Raw | ConvertFrom-Json
                            if ($progressContent.$taskName) {
                                $progressContent.$taskName | Add-Member -NotePropertyName "tddAffectedFiles" -NotePropertyValue $tddFiles -Force
                                $progressContent | ConvertTo-Json -Depth 10 | Set-Content $ProgressFile -Encoding UTF8
                            }
                        }
                        catch {
                            Write-Host "       [Warning] Could not persist tddAffectedFiles for ${taskName}: $($_.Exception.Message)" -ForegroundColor Yellow
                        }
                    }

                    if ($tddFiles.Count -gt 0) {
                        Write-Host "  [PASS] " -ForegroundColor Green -NoNewline
                        Write-Host "$taskName" -ForegroundColor White -NoNewline
                        Write-Host " - $($tddFiles.Count) test file(s) created" -ForegroundColor Gray
                        foreach ($tddFile in $tddFiles) {
                            Write-Host "         - $tddFile" -ForegroundColor DarkGray
                        }
                    } else {
                        Write-Host "  [SKIP] " -ForegroundColor Yellow -NoNewline
                        Write-Host "$taskName" -ForegroundColor White -NoNewline
                        Write-Host " - No test files created (proceeding without tests)" -ForegroundColor Yellow
                    }
                }

                Write-Host ""
            }

            # ============================================================
            # PHASE 2: IMPLEMENTATION WORKERS (with test files if available)
            # ============================================================
            Write-Host "[IMPL] Starting implementation workers..." -ForegroundColor Cyan

            # Start workers
            $workers = @()
            foreach ($task in $batch) {
                # Get TDD affected files for this task (if any were created)
                $tddFiles = @()
                if ($taskTddAffectedFiles.ContainsKey($task.name)) {
                    $tddFiles = $taskTddAffectedFiles[$task.name]
                }

                $prompt = Build-WorkerPrompt -Task $task -Board $board -TemplatePath $PromptTemplate -TddAffectedFiles $tddFiles -Progress $progress
                $logPath = Join-Path $LogsDir "$($task.name).log"
                $jsonLogPath = Join-Path $LogsDir "$($task.name).txt"
                $outputFilePath = Join-Path $LogsDir "$($task.name)-output.json"

                Write-Host "Starting worker for: $($task.name)" -ForegroundColor Cyan

                $worker = Start-WorkerJob -Task $task -Prompt $prompt -LogPath $logPath -JsonLogPath $jsonLogPath -OutputFilePath $outputFilePath
                $workers += $worker
            }

            Write-Host ""
            Write-Host "Waiting for $($workers.Count) workers to complete..." -ForegroundColor Gray

            # Wait for batch completion
            $results = Wait-WorkerBatch -Workers $workers

            # Show results
            $summary = Show-BatchResults -Results $results
            $totalSuccess += $summary.SuccessCount
            $totalFailure += $summary.FailureCount
            $totalTokens += $summary.TotalTokens

            # Track individual task tokens for summary display
            # Note: Token data is now persisted by process-worker-output.ps1 via Invoke-ProcessWorkerOutput
            foreach ($result in $results) {
                $taskName = $result.Task.name
                if ($result.FinalTokens -gt 0) {
                    $taskTokens[$taskName] = $result.FinalTokens
                }
            }

            # Handle failures
            if ($summary.FailureCount -gt 0) {
                # FailFast: Stop if any failures in current wave
                if ($FailFast) {
                    Write-Host ""
                    Write-Host "[FailFast] Wave $waveNum has $($summary.FailureCount) failure(s). Stopping execution." -ForegroundColor Red
                    Write-Host "Check worker-logs in $LogsDir for failure details." -ForegroundColor Yellow
                    exit 1
                }

                $retryTasks = Handle-FailedTasks -FailedResults $summary.FailedTasks

                if ($retryTasks.Count -gt 0) {
                    # Add retry tasks to queue by rebuilding array with retries at current position
                    $newQueue = @()
                    $newQueue += $retryTasks
                    if ($queueIndex -lt $taskQueue.Count) {
                        $newQueue += $taskQueue[$queueIndex..($taskQueue.Count - 1)]
                    }
                    $taskQueue = $newQueue
                    $queueIndex = 0
                }
            }
        }

        # Run independent verification after each wave if enabled
        if ($RunVerification -and -not $DryRun -and $waveTasks.Count -gt 0) {
            $verificationResults = Invoke-IndependentVerification -ProjectRoot $ProjectRoot
            if (-not $verificationResults.allPassed -and $FailFast) {
                Write-Host ""
                Write-Host "[FailFast] Independent verification failed after Wave $waveNum. Stopping execution." -ForegroundColor Red
                exit 1
            }
        }
    }

    # Final summary
    Write-Header "EXECUTION COMPLETE"

    # Token usage summary
    if ($totalTokens -gt 0) {
        Write-Host ""
        Write-Host ("=" * 47) -ForegroundColor Cyan
        Write-Host "              TOKEN USAGE SUMMARY" -ForegroundColor Cyan
        Write-Host ("=" * 47) -ForegroundColor Cyan
        $totalTokenDisplay = "{0:N0}" -f $totalTokens
        $completedTasks = $totalSuccess + $totalFailure
        $avgTokens = if ($completedTasks -gt 0) { [math]::Round($totalTokens / $completedTasks) } else { 0 }
        $avgTokenDisplay = "{0:N0}" -f $avgTokens

        Write-Host "Total Tokens Used:  $totalTokenDisplay" -ForegroundColor White
        Write-Host "Tasks Completed:    $completedTasks" -ForegroundColor White
        Write-Host "Average per Task:   $avgTokenDisplay" -ForegroundColor White

        # Find highest token usage task
        if ($taskTokens.Count -gt 0) {
            $highestTask = $taskTokens.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1
            $highestTokenDisplay = "{0:N0}" -f $highestTask.Value
            Write-Host "Highest Usage:      $($highestTask.Key) ($highestTokenDisplay)" -ForegroundColor White
        }
        Write-Host ("=" * 47) -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "Total Passed:  $totalSuccess" -ForegroundColor Green
    Write-Host "Total Failed:  $totalFailure" -ForegroundColor Red
    Write-Host ""

    if ($totalFailure -gt 0) {
        Write-Host "Check worker-logs in $LogsDir for failure details." -ForegroundColor Yellow
    }

    # Show recommended next steps based on what changed
    Show-NextSteps -ProjectRoot $ProjectRoot
}

# Run main function
Main

#endregion
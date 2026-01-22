<#
.SYNOPSIS
    Parallel kanban task dispatcher using claude -p workers.

.DESCRIPTION
    Orchestrates parallel execution of kanban tasks by spawning claude -p workers.
    Tasks are processed in waves based on category dependencies.

.PARAMETER Parallel
    Maximum number of concurrent workers. Default is 3.

.PARAMETER DryRun
    Show what would be done without executing.

.EXAMPLE
    .\parallel-dispatch.ps1
    .\parallel-dispatch.ps1 -Parallel 5
    .\parallel-dispatch.ps1 -DryRun
#>

param(
    [Parameter()]
    [int]$Parallel = 3,

    [Parameter()]
    [switch]$DryRun
)

# Script configuration
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "../../../../..")
$KanbanDir = Join-Path $ProjectRoot ".kanban"
$LogsDir = Join-Path $KanbanDir "logs"
$BoardFile = Join-Path $KanbanDir "kanban-board.json"
$ProgressFile = Join-Path $KanbanDir "kanban-progress.json"
$PromptTemplate = Join-Path $ScriptDir "../prompts/worker-task.md"

# Wave definitions - tasks are processed in dependency order
$WaveDefinitions = @{
    1 = @("data", "config")      # No dependencies
    2 = @("api")                  # After data
    3 = @("integration")          # After api
    4 = @("ui")                   # After integration
    5 = @("testing")              # After all
}

# Agent mapping by category
$AgentMapping = @{
    "data"        = "backend-developer"
    "api"         = "backend-developer"
    "ui"          = "vue-expert"
    "integration" = "backend-developer"
    "config"      = "backend-developer"
    "testing"     = "backend-developer"
}

#region Helper Functions

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
    if (-not $Entry.agents -or $Entry.agents.Count -eq 0) {
        $warnings += "Missing or empty 'agents' field"
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

    if ($AgentMapping.ContainsKey($Category)) {
        return $AgentMapping[$Category]
    }
    return "backend-developer"  # Default fallback
}

function Get-TokenUsageFromLog {
    param([string]$JsonLogPath)

    $tokensArray = @()

    if (-not (Test-Path $JsonLogPath)) {
        Write-Host "       [Token Debug] Log file not found: $JsonLogPath" -ForegroundColor DarkYellow
        return $tokensArray
    }

    try {
        $content = Get-Content $JsonLogPath -Raw

        if ([string]::IsNullOrWhiteSpace($content)) {
            Write-Host "       [Token Debug] Log file is empty" -ForegroundColor DarkYellow
            return $tokensArray
        }

        # Remove BOM if present (UTF-8 BOM can cause parsing issues)
        if ($content[0] -eq 0xFEFF -or $content[0] -eq 0xFFFE -or $content.StartsWith([char]0xFEFF)) {
            $content = $content.Substring(1)
        }

        $parsed = $content | ConvertFrom-Json

        $objects = if ($parsed -is [array]) { $parsed } else { @($parsed) }

        foreach ($obj in $objects) {
            try {
                if ($obj.type -eq "assistant" -and $obj.message -and $obj.message.usage) {
                    $usage = $obj.message.usage
                    $inputTokens = [int]($usage.input_tokens)
                    $outputTokens = [int]($usage.output_tokens)
                    $cacheRead = if ($usage.cache_read_input_tokens) { [int]($usage.cache_read_input_tokens) } else { 0 }
                    $cacheCreate = if ($usage.cache_creation_input_tokens) { [int]($usage.cache_creation_input_tokens) } else { 0 }
                    $total = $inputTokens + $outputTokens + $cacheRead + $cacheCreate
                    $tokensArray += $total
                }
                if ($obj.type -eq "result" -and $obj.usage) {
                    $usage = $obj.usage
                    $inputTokens = [int]($usage.input_tokens)
                    $outputTokens = [int]($usage.output_tokens)
                    $cacheRead = if ($usage.cache_read_input_tokens) { [int]($usage.cache_read_input_tokens) } else { 0 }
                    $cacheCreate = if ($usage.cache_creation_input_tokens) { [int]($usage.cache_creation_input_tokens) } else { 0 }
                    $total = $inputTokens + $outputTokens + $cacheRead + $cacheCreate
                    $tokensArray += $total
                }
            }
            catch {
                # Skip malformed entries silently
            }
        }

        if ($tokensArray.Count -eq 0) {
            Write-Host "       [Token Debug] No usage data found in $($objects.Count) objects" -ForegroundColor DarkYellow
        }
    }
    catch {
        Write-Host "       [Token Debug] Parse error: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }

    return $tokensArray
}

function Update-ProgressWithTokens {
    param(
        [string]$TaskName,
        [array]$TokensUsed,
        [string]$ProgressFilePath
    )

    if ($TokensUsed.Count -eq 0) { return }

    try {
        $progressContent = Get-Content $ProgressFilePath -Raw | ConvertFrom-Json
        if ($progressContent.$TaskName) {
            $progressContent.$TaskName | Add-Member -NotePropertyName "tokensUsed" -NotePropertyValue $TokensUsed -Force
            $progressContent | ConvertTo-Json -Depth 10 | Set-Content $ProgressFilePath -Encoding UTF8
        } else {
            Write-Host "       [Token Debug] Task '$TaskName' not found in progress file" -ForegroundColor DarkYellow
        }
    }
    catch {
        Write-Host "       [Token Debug] Progress update failed: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
}

function Build-WorkerPrompt {
    param(
        [object]$Task,
        [object]$Board,
        [string]$TemplatePath
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

## Task Assignment

**Name**: {task.name}
**Category**: {task.category}
**Agent**: {agent-name}

### Description

{task.description}

### Verification Steps

Complete these steps in order to verify your implementation:

{task.steps}

---

## Worker Responsibilities

1. **Implement the Task**
   - Follow the description and any implementation details provided
   - Use existing project patterns and conventions
   - Ensure code is properly typed (TypeScript)

2. **Verify All Steps**
   - Execute each verification step in order
   - Document the result of each step
   - All steps must pass before marking complete

3. **Update Kanban Files**
   - Update `.kanban/kanban-progress.json` with work log
   - Update `.kanban/kanban-board.json` to set `passes: true` if verification succeeds
   - Write status file to `.kanban/workers/{task.name}.status.json`

---

## Status File Format

Create `.kanban/workers/{task.name}.status.json`:

On Success:
``json
{
  "status": "success",
  "log": "Brief description of what was done",
  "affectedFiles": ["path/to/file1.ts", "path/to/file2.ts"],
  "agents": ["{agent-name}"]
}
``

On Failure:
``json
{
  "status": "failure",
  "error": "Description of what went wrong",
  "affectedFiles": [],
  "agents": ["{agent-name}"]
}
``
"@
    }

    # Build numbered steps list
    $stepsText = ""
    $stepNum = 1
    foreach ($step in $Task.steps) {
        $stepsText += "$stepNum. $step`n"
        $stepNum++
    }

    $agentName = Get-AgentForCategory -Category $Task.category

    # Replace placeholders using the existing template format
    # The template uses {placeholder} style, need to escape braces for regex
    $prompt = $template
    $prompt = $prompt -replace '\{task\.name\}', $Task.name
    $prompt = $prompt -replace '\{task\.category\}', $Task.category
    $prompt = $prompt -replace '\{task\.description\}', $Task.description
    $prompt = $prompt -replace '\{task\.steps\}', $stepsText.TrimEnd()
    $prompt = $prompt -replace '\{agent-name\}', $agentName
    $prompt = $prompt -replace '\{projectType\}', $Board.projectType

    return $prompt
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
                $waveTasks += $task
            }
        }
    }

    return $waveTasks
}

function Initialize-Directories {
    if (-not (Test-Path $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
        Write-Host "Created logs directory: $LogsDir" -ForegroundColor Gray
    }
}

function Start-WorkerJob {
    param(
        [object]$Task,
        [string]$Prompt,
        [string]$LogPath,
        [string]$JsonLogPath
    )

    $taskName = $Task.name

    # Create the job script block
    $jobScript = {
        param($ProjectRoot, $Prompt, $LogPath, $JsonLogPath, $TaskName)

        try {
            Set-Location $ProjectRoot

            # Run claude -p with permissions skipped for autonomous worker execution
            # Worker is responsible for updating kanban-progress.json with status
            # Use --output-format json to capture token usage data
            $output = & claude -p --dangerously-skip-permissions --output-format json $Prompt 2>&1

            # Write JSON output for token tracking
            $output | Out-File -FilePath $JsonLogPath -Encoding UTF8
        }
        catch {
            # Log the error
            "ERROR: $($_.Exception.Message)" | Out-File -FilePath $LogPath -Encoding UTF8 -Append
            "ERROR: $($_.Exception.Message)" | Out-File -FilePath $JsonLogPath -Encoding UTF8 -Append
        }
    }

    # Start the background job
    $job = Start-Job -ScriptBlock $jobScript -ArgumentList $ProjectRoot, $Prompt, $LogPath, $JsonLogPath, $taskName

    return @{
        Job = $job
        Task = $Task
        LogPath = $LogPath
        JsonLogPath = $JsonLogPath
    }
}

function Wait-WorkerBatch {
    param([array]$Workers)

    $results = @()

    # Wait for all jobs to complete
    $jobs = $Workers | ForEach-Object { $_.Job }
    $jobs | Wait-Job | Out-Null

    # Re-read progress.json to get worker updates
    $progressRaw = $null
    $progress = @{}
    if (Test-Path $ProgressFile) {
        try {
            $progressRaw = Get-Content $ProgressFile -Raw | ConvertFrom-Json
            if ($progressRaw -and $progressRaw.PSObject.Properties) {
                foreach ($prop in $progressRaw.PSObject.Properties) {
                    $progress[$prop.Name] = $prop.Value
                }
            }
        }
        catch {
            Write-Host "Warning: Failed to parse progress file" -ForegroundColor Yellow
        }
    }

    # Re-read board.json to check if workers updated passes field
    $boardContent = $null
    $boardTasks = @{}
    if (Test-Path $BoardFile) {
        try {
            $boardContent = Get-Content $BoardFile -Raw | ConvertFrom-Json
            if ($boardContent -and $boardContent.tasks) {
                foreach ($task in $boardContent.tasks) {
                    $boardTasks[$task.name] = $task
                }
            }
        }
        catch {
            Write-Host "Warning: Failed to parse board file" -ForegroundColor Yellow
        }
    }

    foreach ($worker in $Workers) {
        $task = $worker.Task
        $logPath = $worker.LogPath
        $taskName = $task.name

        # Clean up the job
        Remove-Job -Job $worker.Job -Force

        # Check progress.json for task status
        $status = $null
        $entry = $progress[$taskName]

        # Validate progress entry and collect warnings
        $validationWarnings = @()

        if ($entry) {
            # Run validation on the entry
            $validationWarnings = Test-ProgressEntry -Entry $entry -TaskName $taskName

            # Check if worker updated passes field in board.json
            $boardTask = $boardTasks[$taskName]
            if ($boardTask) {
                if ($entry.status -eq "completed" -and $boardTask.passes -ne $true) {
                    $validationWarnings += "CRITICAL: Worker completed but did NOT set passes=true in board.json - task will remain stuck in 'in-progress'"
                }
            }

            $entryStatus = $entry.status
            if ($entryStatus -eq "completed") {
                $status = @{
                    status = "completed"
                    workLog = $entry.workLog
                    affectedFiles = $entry.affectedFiles
                    agents = $entry.agents
                    validationWarnings = $validationWarnings
                }
            } elseif ($entryStatus -eq "error") {
                $status = @{
                    status = "error"
                    error = if ($entry.workLog) { ($entry.workLog -join "; ") } else { "Task failed with error status" }
                    affectedFiles = $entry.affectedFiles
                    agents = $entry.agents
                    validationWarnings = $validationWarnings
                }
            } elseif ($entryStatus -eq "blocked") {
                $status = @{
                    status = "blocked"
                    error = if ($entry.workLog) { ($entry.workLog -join "; ") } else { "Task blocked due to unmet dependencies" }
                    affectedFiles = $entry.affectedFiles
                    agents = $entry.agents
                    validationWarnings = $validationWarnings
                }
            } elseif ($entryStatus -eq "running") {
                # Worker still shows running - job completed but may not have finished updating
                $status = @{
                    status = "unknown"
                    error = "Worker job finished but progress status still shows 'running'"
                    validationWarnings = $validationWarnings
                }
            } else {
                # Legacy entry without status field - check if it has required fields
                if ($entry.workLog -and $entry.affectedFiles) {
                    $status = @{
                        status = "completed"
                        workLog = $entry.workLog
                        affectedFiles = $entry.affectedFiles
                        agents = $entry.agents
                        validationWarnings = $validationWarnings
                    }
                } else {
                    $status = @{
                        status = "unknown"
                        error = "Progress entry exists but status unclear"
                        validationWarnings = $validationWarnings
                    }
                }
            }
        } else {
            $status = @{
                status = "failure"
                error = "No progress entry created by worker"
                validationWarnings = @("Worker did not create a progress entry at all")
            }
        }

        # Extract token usage from JSON log
        $jsonLogPath = $worker.JsonLogPath

        # Small delay to ensure file is flushed
        Start-Sleep -Milliseconds 100

        $tokensUsed = Get-TokenUsageFromLog -JsonLogPath $jsonLogPath
        $finalTokens = if ($tokensUsed.Count -gt 0) { $tokensUsed[-1] } else { 0 }

        $results += @{
            Task = $task
            Status = $status
            LogPath = $logPath
            JsonLogPath = $jsonLogPath
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

        # Accept both "success" and "completed" as valid success states
        if ($status.status -eq "success" -or $status.status -eq "completed") {
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

    # Calculate batch token total
    $batchTokens = ($Results | Measure-Object -Property FinalTokens -Sum).Sum
    if (-not $batchTokens) { $batchTokens = 0 }

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
        FailedTasks = $Results | Where-Object { $_.Status.status -ne "success" -and $_.Status.status -ne "completed" }
    }
}

function Handle-FailedTasks {
    param([array]$FailedResults)

    if ($FailedResults.Count -eq 0) {
        return @()
    }

    Write-Host ""
    Write-Host "Some tasks failed. What would you like to do?" -ForegroundColor Yellow
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
            Write-Host "Run 'kanban:code-review' to review and commit changes." -ForegroundColor Yellow
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

        while ($queueIndex -lt $taskQueue.Count) {
            # Get batch of tasks
            $remainingCount = $taskQueue.Count - $queueIndex
            $batchSize = [Math]::Min($Parallel, $remainingCount)
            $batch = $taskQueue[$queueIndex..($queueIndex + $batchSize - 1)]
            $queueIndex += $batchSize

            Write-SubHeader "Processing Batch ($batchSize tasks)"

            # Start workers
            $workers = @()
            foreach ($task in $batch) {
                $prompt = Build-WorkerPrompt -Task $task -Board $board -TemplatePath $PromptTemplate
                $logPath = Join-Path $LogsDir "$($task.name).log"
                $jsonLogPath = Join-Path $LogsDir "$($task.name).json"

                Write-Host "Starting worker for: $($task.name)" -ForegroundColor Cyan

                $worker = Start-WorkerJob -Task $task -Prompt $prompt -LogPath $logPath -JsonLogPath $jsonLogPath
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

            # Track individual task tokens and update progress file with token data
            foreach ($result in $results) {
                $taskName = $result.Task.name
                if ($result.FinalTokens -gt 0) {
                    $taskTokens[$taskName] = $result.FinalTokens
                }
                # Update progress file with token data
                if ($result.TokensUsed.Count -gt 0) {
                    Update-ProgressWithTokens -TaskName $taskName -TokensUsed $result.TokensUsed -ProgressFilePath $ProgressFile
                }
            }

            # Handle failures
            if ($summary.FailureCount -gt 0) {
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

    if ($totalSuccess -gt 0) {
        Write-Host "Run 'kanban:code-review' to review and commit completed tasks." -ForegroundColor Yellow
    }

    if ($totalFailure -gt 0) {
        Write-Host "Check logs in $LogsDir for failure details." -ForegroundColor Yellow
    }
}

# Run main function
Main

#endregion
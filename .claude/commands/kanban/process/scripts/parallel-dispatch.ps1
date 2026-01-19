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
$WorkersDir = Join-Path $KanbanDir "workers"
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
```json
{
  "status": "success",
  "log": "Brief description of what was done",
  "affectedFiles": ["path/to/file1.ts", "path/to/file2.ts"],
  "agents": ["{agent-name}"]
}
```

On Failure:
```json
{
  "status": "failure",
  "error": "Description of what went wrong",
  "affectedFiles": [],
  "agents": ["{agent-name}"]
}
```
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
        if ($entry -and $entry.committed -eq $false) {
            return "code-review"
        }
        return "completed"
    } else {
        if ($entry) {
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
    if (-not (Test-Path $WorkersDir)) {
        New-Item -ItemType Directory -Path $WorkersDir -Force | Out-Null
        Write-Host "Created workers directory: $WorkersDir" -ForegroundColor Gray
    }

    if (-not (Test-Path $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
        Write-Host "Created logs directory: $LogsDir" -ForegroundColor Gray
    }
}

function Start-WorkerJob {
    param(
        [object]$Task,
        [string]$Prompt,
        [string]$LogPath
    )

    $taskName = $Task.name
    $statusFile = Join-Path $WorkersDir "$taskName.status.json"

    # Remove any existing status file
    if (Test-Path $statusFile) {
        Remove-Item $statusFile -Force
    }

    # Create the job script block
    $jobScript = {
        param($ProjectRoot, $Prompt, $LogPath, $StatusFile, $TaskName)

        try {
            Set-Location $ProjectRoot

            # Run claude -p and capture output
            $output = & claude -p $Prompt 2>&1

            # Write output to log file
            $output | Out-File -FilePath $LogPath -Encoding UTF8

            # Check if status file was created by the worker
            if (-not (Test-Path $StatusFile)) {
                # Create a default status file if worker didn't create one
                @{
                    status = "unknown"
                    summary = "Worker completed but did not create status file"
                    taskName = $TaskName
                } | ConvertTo-Json | Out-File -FilePath $StatusFile -Encoding UTF8
            }
        }
        catch {
            # Create error status file
            @{
                status = "failure"
                error = $_.Exception.Message
                taskName = $TaskName
            } | ConvertTo-Json | Out-File -FilePath $StatusFile -Encoding UTF8
        }
    }

    # Start the background job
    $job = Start-Job -ScriptBlock $jobScript -ArgumentList $ProjectRoot, $Prompt, $LogPath, $statusFile, $taskName

    return @{
        Job = $job
        Task = $Task
        LogPath = $LogPath
        StatusFile = $statusFile
    }
}

function Wait-WorkerBatch {
    param([array]$Workers)

    $results = @()

    # Wait for all jobs to complete
    $jobs = $Workers | ForEach-Object { $_.Job }
    $jobs | Wait-Job | Out-Null

    foreach ($worker in $Workers) {
        $task = $worker.Task
        $statusFile = $worker.StatusFile
        $logPath = $worker.LogPath

        # Clean up the job
        Remove-Job -Job $worker.Job -Force

        # Read status file
        $status = $null
        if (Test-Path $statusFile) {
            try {
                $status = Get-Content $statusFile -Raw | ConvertFrom-Json
            }
            catch {
                $status = @{
                    status = "failure"
                    error = "Failed to parse status file"
                }
            }
        } else {
            $status = @{
                status = "failure"
                error = "No status file created"
            }
        }

        $results += @{
            Task = $task
            Status = $status
            LogPath = $logPath
            StatusFile = $statusFile
        }
    }

    return $results
}

function Show-BatchResults {
    param([array]$Results)

    Write-SubHeader "Batch Results"

    $successCount = 0
    $failureCount = 0

    foreach ($result in $Results) {
        $taskName = $result.Task.name
        $status = $result.Status

        if ($status.status -eq "success") {
            Write-Host "[PASS] " -ForegroundColor Green -NoNewline
            Write-Host "$taskName" -ForegroundColor White
            if ($status.summary) {
                Write-Host "       $($status.summary)" -ForegroundColor Gray
            }
            $successCount++
        } else {
            Write-Host "[FAIL] " -ForegroundColor Red -NoNewline
            Write-Host "$taskName" -ForegroundColor White
            if ($status.error) {
                Write-Host "       Error: $($status.error)" -ForegroundColor Red
            }
            Write-Host "       Log: $($result.LogPath)" -ForegroundColor DarkGray
            $failureCount++
        }
    }

    Write-Host ""
    Write-Host "Batch Summary: " -NoNewline
    Write-Host "$successCount passed" -ForegroundColor Green -NoNewline
    Write-Host ", " -NoNewline
    Write-Host "$failureCount failed" -ForegroundColor Red

    return @{
        SuccessCount = $successCount
        FailureCount = $failureCount
        FailedTasks = $Results | Where-Object { $_.Status.status -ne "success" }
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

        # Process tasks in batches
        $taskQueue = [System.Collections.ArrayList]::new($waveTasks)

        while ($taskQueue.Count -gt 0) {
            # Get batch of tasks
            $batchSize = [Math]::Min($Parallel, $taskQueue.Count)
            $batch = $taskQueue.GetRange(0, $batchSize)
            $taskQueue.RemoveRange(0, $batchSize)

            Write-SubHeader "Processing Batch ($batchSize tasks)"

            # Start workers
            $workers = @()
            foreach ($task in $batch) {
                $prompt = Build-WorkerPrompt -Task $task -Board $board -TemplatePath $PromptTemplate
                $logPath = Join-Path $LogsDir "$($task.name).log"

                Write-Host "Starting worker for: $($task.name)" -ForegroundColor Cyan

                $worker = Start-WorkerJob -Task $task -Prompt $prompt -LogPath $logPath
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

            # Handle failures
            if ($summary.FailureCount -gt 0) {
                $retryTasks = Handle-FailedTasks -FailedResults $summary.FailedTasks

                if ($retryTasks.Count -gt 0) {
                    # Add retry tasks back to queue
                    foreach ($task in $retryTasks) {
                        $taskQueue.Insert(0, $task)
                    }
                }
            }
        }
    }

    # Final summary
    Write-Header "EXECUTION COMPLETE"
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
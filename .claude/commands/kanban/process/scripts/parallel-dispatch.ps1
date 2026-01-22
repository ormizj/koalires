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
$ProcessWorkerOutputScript = Join-Path $ScriptDir "process-worker-output.ps1"

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
        Write-Host "       [Token] Log file not found: $JsonLogPath" -ForegroundColor Yellow
        return $tokensArray
    }

    try {
        $content = Get-Content $JsonLogPath -Raw -ErrorAction Stop

        if ([string]::IsNullOrWhiteSpace($content)) {
            Write-Host "       [Token] Log file is empty" -ForegroundColor Yellow
            return $tokensArray
        }

        # Remove BOM if present
        if ($content[0] -eq 0xFEFF -or $content[0] -eq 0xFFFE -or $content.StartsWith([char]0xFEFF)) {
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

        # Extract token usage from parsed objects
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

function Set-TaskRunning {
    param(
        [string]$TaskName,
        [string]$AgentName
    )

    try {
        $progressContent = Get-Content $ProgressFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop

        $runningEntry = @{
            status = "running"
            startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            agents = @($AgentName)
        }

        $progressContent | Add-Member -NotePropertyName $TaskName -NotePropertyValue ([PSCustomObject]$runningEntry) -Force
        $progressContent | ConvertTo-Json -Depth 10 | Set-Content $ProgressFile -Encoding UTF8 -ErrorAction Stop

        return $true
    }
    catch {
        Write-Host "       [Error] Failed to mark task '$TaskName' as running: $($_.Exception.Message)" -ForegroundColor Red
        return $false
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
        [string]$JsonLogPath,
        [string]$OutputFilePath
    )

    $taskName = $Task.name
    $agentName = Get-AgentForCategory -Category $Task.category

    # DISPATCHER RESPONSIBILITY: Mark task as "running" BEFORE spawning worker
    $marked = Set-TaskRunning -TaskName $taskName -AgentName $agentName
    if (-not $marked) {
        Write-Host "       [Warning] Could not mark task '$taskName' as running" -ForegroundColor Yellow
    }

    # Create the job script block
    $jobScript = {
        param($ProjectRoot, $Prompt, $LogPath, $JsonLogPath, $TaskName)

        try {
            Set-Location $ProjectRoot

            # Run claude -p with permissions skipped for autonomous worker execution
            # Worker creates output file, dispatcher handles progress/board updates
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
        OutputFilePath = $OutputFilePath
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
        $logPath = $worker.LogPath
        $taskName = $task.name
        $jsonLogPath = $worker.JsonLogPath
        $outputFilePath = $worker.OutputFilePath

        # Clean up the job
        Remove-Job -Job $worker.Job -Force

        # Wait for JSON log file to be ready (with timeout) for token extraction
        $maxWaitMs = 5000  # 5 second timeout
        $waitIntervalMs = 100
        $waitedMs = 0
        $fileReady = $false

        while ($waitedMs -lt $maxWaitMs -and -not $fileReady) {
            if (Test-Path $jsonLogPath) {
                $fileInfo = Get-Item $jsonLogPath -ErrorAction SilentlyContinue
                # File exists and has content - check if it ends with valid JSON
                if ($fileInfo -and $fileInfo.Length -gt 100) {
                    try {
                        $testContent = Get-Content $jsonLogPath -Raw -ErrorAction Stop
                        $null = $testContent | ConvertFrom-Json -ErrorAction Stop
                        $fileReady = $true
                    } catch {
                        # File not ready yet (incomplete JSON)
                    }
                }
            }
            if (-not $fileReady) {
                Start-Sleep -Milliseconds $waitIntervalMs
                $waitedMs += $waitIntervalMs
            }
        }

        if (-not $fileReady) {
            Write-Host "       [Token] Warning: JSON log not ready after ${maxWaitMs}ms for $taskName" -ForegroundColor Yellow
        }

        # Extract token usage from JSON log
        $tokensUsed = Get-TokenUsageFromLog -JsonLogPath $jsonLogPath
        Write-Host "       [DEBUG] Extracted $($tokensUsed.Count) token entries from $jsonLogPath" -ForegroundColor Magenta
        $finalTokens = if ($tokensUsed.Count -gt 0) { $tokensUsed[-1] } else { 0 }

        # Process worker output file via dedicated script
        $status = $null
        $validationWarnings = @()

        if (Test-Path $outputFilePath) {
            # Worker created output file - use process-worker-output.ps1 to update kanban files
            $processResult = Invoke-ProcessWorkerOutput -TaskName $taskName -OutputFile $outputFilePath -TokensUsed $tokensUsed

            if ($processResult.success) {
                $status = @{
                    status = $processResult.status
                    validationWarnings = @()
                }

                # Add info about what was updated
                if ($processResult.progressUpdated) {
                    Write-Host "       [Dispatcher] Updated progress.json for $taskName" -ForegroundColor Gray
                }
                if ($processResult.boardUpdated) {
                    Write-Host "       [Dispatcher] Updated board.json passes=true for $taskName" -ForegroundColor Gray
                }
                elseif ($processResult.status -eq "completed") {
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
            # No output file - worker may have crashed or failed to create it
            # Fall back to reading progress.json directly to check if worker updated it the old way
            Write-Host "       [Warning] No worker output file found: $outputFilePath" -ForegroundColor Yellow

            $entry = $null
            if (Test-Path $ProgressFile) {
                try {
                    $progressRaw = Get-Content $ProgressFile -Raw | ConvertFrom-Json
                    if ($progressRaw.PSObject.Properties[$taskName]) {
                        $entry = $progressRaw.$taskName
                    }
                }
                catch {
                    Write-Host "       [Warning] Failed to read progress file" -ForegroundColor Yellow
                }
            }

            if ($entry -and $entry.status -and $entry.status -ne "running") {
                # Worker updated progress.json directly (legacy behavior)
                $validationWarnings += "Worker used legacy direct file update instead of output file"
                $validationWarnings += Test-ProgressEntry -Entry $entry -TaskName $taskName

                $status = @{
                    status = $entry.status
                    workLog = $entry.workLog
                    affectedFiles = $entry.affectedFiles
                    agents = $entry.agents
                    validationWarnings = $validationWarnings
                }

                # Update tokens in progress if we have them
                if ($tokensUsed.Count -gt 0) {
                    $null = Update-ProgressWithTokens -TaskName $taskName -TokensUsed $tokensUsed -ProgressFilePath $ProgressFile
                }
            }
            else {
                # Worker failed without creating output or updating progress
                $status = @{
                    status = "failure"
                    error = "Worker completed without creating output file or progress entry"
                    validationWarnings = @("Worker did not create output file: $outputFilePath")
                }
            }
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
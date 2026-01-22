<#
.SYNOPSIS
    Process worker output file and update kanban tracking files.

.DESCRIPTION
    Standalone script that reads a worker output JSON file and updates
    kanban-progress.json and kanban-board.json accordingly.

.PARAMETER TaskName
    The name of the task being processed.

.PARAMETER OutputFile
    Path to the worker output JSON file (.kanban/logs/{task}-output.json).

.PARAMETER ProgressFile
    Path to the progress tracking file (.kanban/kanban-progress.json).

.PARAMETER BoardFile
    Path to the kanban board file (.kanban/kanban-board.json).

.PARAMETER TokensJson
    Optional JSON array string of token counts to add to progress entry.

.EXAMPLE
    .\process-worker-output.ps1 -TaskName "my-task" -OutputFile ".kanban/logs/my-task-output.json" -ProgressFile ".kanban/kanban-progress.json" -BoardFile ".kanban/kanban-board.json"
#>

param(
    [Parameter(Mandatory)]
    [string]$TaskName,

    [Parameter(Mandatory)]
    [string]$OutputFile,

    [Parameter(Mandatory)]
    [string]$ProgressFile,

    [Parameter(Mandatory)]
    [string]$BoardFile,

    [Parameter()]
    [string]$TokensJson
)

$ErrorActionPreference = "Stop"

function Write-JsonResult {
    param(
        [bool]$Success,
        [string]$Error = "",
        [bool]$ProgressUpdated = $false,
        [bool]$BoardUpdated = $false,
        [string]$Status = ""
    )

    $result = @{
        success = $Success
        progressUpdated = $ProgressUpdated
        boardUpdated = $BoardUpdated
        status = $Status
    }

    if ($Error) {
        $result.error = $Error
    }

    $result | ConvertTo-Json -Compress
}

# Validate output file exists
if (-not (Test-Path $OutputFile)) {
    Write-JsonResult -Success $false -Error "Output file not found: $OutputFile"
    exit 1
}

# Read and parse worker output
try {
    $outputContent = Get-Content $OutputFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
}
catch {
    Write-JsonResult -Success $false -Error "Failed to parse worker output: $($_.Exception.Message)"
    exit 1
}

# Validate required fields in output
if (-not $outputContent.taskName) {
    Write-JsonResult -Success $false -Error "Missing 'taskName' in worker output"
    exit 1
}

if ($outputContent.taskName -ne $TaskName) {
    Write-JsonResult -Success $false -Error "Task name mismatch: expected '$TaskName', got '$($outputContent.taskName)'"
    exit 1
}

if (-not $outputContent.status) {
    Write-JsonResult -Success $false -Error "Missing 'status' in worker output"
    exit 1
}

# Validate progress file exists
if (-not (Test-Path $ProgressFile)) {
    Write-JsonResult -Success $false -Error "Progress file not found: $ProgressFile"
    exit 1
}

# Validate board file exists
if (-not (Test-Path $BoardFile)) {
    Write-JsonResult -Success $false -Error "Board file not found: $BoardFile"
    exit 1
}

# Read progress file
try {
    $progressContent = Get-Content $ProgressFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
}
catch {
    Write-JsonResult -Success $false -Error "Failed to parse progress file: $($_.Exception.Message)"
    exit 1
}

# Read board file
try {
    $boardContent = Get-Content $BoardFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
}
catch {
    Write-JsonResult -Success $false -Error "Failed to parse board file: $($_.Exception.Message)"
    exit 1
}

# Map worker output status to progress status
$progressStatus = switch ($outputContent.status) {
    "success" { "completed" }
    "error" { "error" }
    "blocked" { "blocked" }
    default { "error" }
}

# Build progress entry from worker output
$progressEntry = @{
    status = $progressStatus
    startedAt = if ($outputContent.startedAt) { $outputContent.startedAt } else { (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
    completedAt = if ($outputContent.completedAt) { $outputContent.completedAt } else { (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
    agents = if ($outputContent.agent) { @($outputContent.agent) } else { @("unknown") }
}

# Add workLog from output
if ($outputContent.workLog -and $outputContent.workLog.Count -gt 0) {
    $progressEntry.workLog = @($outputContent.workLog)
}
elseif ($outputContent.verification -and $outputContent.verification.steps) {
    # Build workLog from verification steps
    $workLog = @()
    foreach ($step in $outputContent.verification.steps) {
        $passedText = if ($step.passed) { "PASS" } else { "FAIL" }
        $workLog += "$($step.description): $passedText"
    }
    $progressEntry.workLog = $workLog
}
else {
    $progressEntry.workLog = @("Task $progressStatus")
}

# Add affectedFiles
if ($outputContent.affectedFiles) {
    $progressEntry.affectedFiles = @($outputContent.affectedFiles)
}
else {
    $progressEntry.affectedFiles = @()
}

# Add error info if present
if ($outputContent.error) {
    $errorLog = @()
    if ($outputContent.error.message) {
        $errorLog += "Error: $($outputContent.error.message)"
    }
    if ($outputContent.error.type) {
        $errorLog += "Type: $($outputContent.error.type)"
    }
    if ($outputContent.error.suggestedFix) {
        $errorLog += "Suggested fix: $($outputContent.error.suggestedFix)"
    }
    if ($errorLog.Count -gt 0) {
        $progressEntry.workLog = $errorLog + $progressEntry.workLog
    }
}

# Add tokens if provided
if ($TokensJson) {
    try {
        $tokens = $TokensJson | ConvertFrom-Json -ErrorAction Stop
        if ($tokens -and $tokens.Count -gt 0) {
            $progressEntry.tokensUsed = @($tokens)
        }
    }
    catch {
        # Silently ignore token parsing errors - not critical
    }
}

# Update progress file
$progressUpdated = $false
try {
    # Add or update the task entry
    $progressContent | Add-Member -NotePropertyName $TaskName -NotePropertyValue ([PSCustomObject]$progressEntry) -Force
    $progressContent | ConvertTo-Json -Depth 10 | Set-Content $ProgressFile -Encoding UTF8 -ErrorAction Stop
    $progressUpdated = $true
}
catch {
    Write-JsonResult -Success $false -Error "Failed to update progress file: $($_.Exception.Message)"
    exit 1
}

# Update board file if verification passed
$boardUpdated = $false
$shouldUpdateBoard = $outputContent.status -eq "success"

if ($outputContent.verification -and $outputContent.verification.PSObject.Properties["passed"]) {
    $shouldUpdateBoard = $outputContent.verification.passed -eq $true
}

if ($shouldUpdateBoard) {
    try {
        # Find and update the task in board
        $taskFound = $false
        for ($i = 0; $i -lt $boardContent.tasks.Count; $i++) {
            if ($boardContent.tasks[$i].name -eq $TaskName) {
                $boardContent.tasks[$i] | Add-Member -NotePropertyName "passes" -NotePropertyValue $true -Force
                $taskFound = $true
                break
            }
        }

        if ($taskFound) {
            $boardContent | ConvertTo-Json -Depth 10 | Set-Content $BoardFile -Encoding UTF8 -ErrorAction Stop
            $boardUpdated = $true
        }
        else {
            # Task not found in board - not a critical error, just log it
            Write-Host "Warning: Task '$TaskName' not found in board file" -ForegroundColor Yellow
        }
    }
    catch {
        Write-JsonResult -Success $false -Error "Failed to update board file: $($_.Exception.Message)" -ProgressUpdated $progressUpdated
        exit 1
    }
}

# Return success result
Write-JsonResult -Success $true -ProgressUpdated $progressUpdated -BoardUpdated $boardUpdated -Status $progressStatus

<#
.SYNOPSIS
    Process worker output file and update kanban tracking files.

.DESCRIPTION
    Standalone script that reads a worker output JSON file and updates
    kanban-progress.json and kanban-board.json accordingly.
    Uses file locking with retry logic for safe concurrent updates.

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

# File locking constants
$MaxRetries = 10
$RetryDelayMs = 200

function Update-JsonFileWithLock {
    param(
        [string]$FilePath,
        [scriptblock]$UpdateLogic
    )

    $attempt = 0
    $success = $false
    $lastError = $null

    while (-not $success -and $attempt -lt $MaxRetries) {
        $attempt++
        try {
            # Read current content
            $content = Get-Content $FilePath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop

            # Apply the update logic
            $updatedContent = & $UpdateLogic $content

            # Write back atomically via temp file
            $tempFile = "$FilePath.tmp.$([System.Guid]::NewGuid().ToString('N'))"
            $updatedContent | ConvertTo-Json -Depth 10 | Set-Content $tempFile -Encoding UTF8 -ErrorAction Stop

            # Move temp file to target (atomic on Windows NTFS)
            Move-Item -Path $tempFile -Destination $FilePath -Force -ErrorAction Stop
            $success = $true
        }
        catch {
            $lastError = $_.Exception.Message
            # Clean up temp file if it exists
            if ($tempFile -and (Test-Path $tempFile)) {
                Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            }
            # Wait before retry with random jitter
            $jitter = Get-Random -Minimum 0 -Maximum 100
            Start-Sleep -Milliseconds ($RetryDelayMs + $jitter)
        }
    }

    return @{
        Success = $success
        Error = if (-not $success) { $lastError } else { $null }
        Attempts = $attempt
    }
}

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

# Note: Files are read inside Update-JsonFileWithLock for atomic updates

# Map worker output status to progress status
$progressStatus = switch ($outputContent.status) {
    "success" { "code-review" }
    "error" { "error" }
    "blocked" { "blocked" }
    default { "error" }
}

# Build progress entry from worker output
$progressEntry = @{
    status = $progressStatus
    startedAt = if ($outputContent.startedAt) { $outputContent.startedAt } else { (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
    completedAt = if ($outputContent.completedAt) { $outputContent.completedAt } else { (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
    agent = if ($outputContent.agent) { $outputContent.agent } else { "unknown" }
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

# Add tokens - prefer command-line argument, fall back to output file
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
elseif ($outputContent.tokensUsed -and $outputContent.tokensUsed.Count -gt 0) {
    # Fall back to tokens from output file (populated by parse-worker-log.ps1)
    $progressEntry.tokensUsed = @($outputContent.tokensUsed)
}

# Update progress file with locking
$progressUpdated = $false
$progressUpdateLogic = {
    param($content)
    $content | Add-Member -NotePropertyName $TaskName -NotePropertyValue ([PSCustomObject]$progressEntry) -Force
    return $content
}.GetNewClosure()

$progressResult = Update-JsonFileWithLock -FilePath $ProgressFile -UpdateLogic $progressUpdateLogic
if ($progressResult.Success) {
    $progressUpdated = $true
}
else {
    Write-JsonResult -Success $false -Error "Failed to update progress file: $($progressResult.Error)"
    exit 1
}

# Update board file if verification passed
$boardUpdated = $false
$shouldUpdateBoard = $outputContent.status -eq "success"

if ($outputContent.verification -and $outputContent.verification.PSObject.Properties["passed"]) {
    $shouldUpdateBoard = $outputContent.verification.passed -eq $true
}

if ($shouldUpdateBoard) {
    $boardUpdateLogic = {
        param($content)
        for ($i = 0; $i -lt $content.tasks.Count; $i++) {
            if ($content.tasks[$i].name -eq $TaskName) {
                $content.tasks[$i] | Add-Member -NotePropertyName "passes" -NotePropertyValue $true -Force
                break
            }
        }
        return $content
    }.GetNewClosure()

    $boardResult = Update-JsonFileWithLock -FilePath $BoardFile -UpdateLogic $boardUpdateLogic
    if ($boardResult.Success) {
        $boardUpdated = $true
    }
    else {
        Write-JsonResult -Success $false -Error "Failed to update board file: $($boardResult.Error)" -ProgressUpdated $progressUpdated
        exit 1
    }
}

# Return success result
Write-JsonResult -Success $true -ProgressUpdated $progressUpdated -BoardUpdated $boardUpdated -Status $progressStatus

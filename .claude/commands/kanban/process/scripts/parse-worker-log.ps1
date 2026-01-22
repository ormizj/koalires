<#
.SYNOPSIS
    Parse raw worker JSON log and create normalized output file.

.DESCRIPTION
    Extracts data from the raw claude -p worker log (JSON format) and creates
    a normalized output file for the dispatcher to process.

    This script is the single source of truth for worker output parsing,
    ensuring consistent data extraction regardless of worker behavior.

.PARAMETER TaskName
    The name of the task being processed.

.PARAMETER JsonLogPath
    Path to the raw JSON log file (.kanban/logs/{task}.json).

.PARAMETER OutputFilePath
    Path where the normalized output file will be written.

.PARAMETER AgentName
    The agent type assigned to this task.

.PARAMETER StartedAt
    ISO timestamp when the task was marked as running (from dispatcher).

.EXAMPLE
    .\parse-worker-log.ps1 -TaskName "my-task" -JsonLogPath ".kanban/logs/my-task.json" -OutputFilePath ".kanban/logs/my-task-output.json" -AgentName "backend-developer" -StartedAt "2026-01-22T10:00:00.000Z"
#>

param(
    [Parameter(Mandatory)]
    [string]$TaskName,

    [Parameter(Mandatory)]
    [string]$JsonLogPath,

    [Parameter(Mandatory)]
    [string]$OutputFilePath,

    [Parameter(Mandatory)]
    [string]$AgentName,

    [Parameter()]
    [string]$StartedAt
)

$ErrorActionPreference = "Stop"

function Write-JsonResult {
    param(
        [bool]$Success,
        [string]$Error = "",
        [hashtable]$Data = @{}
    )

    $result = @{
        success = $Success
    }

    if ($Error) {
        $result.error = $Error
    }

    foreach ($key in $Data.Keys) {
        $result[$key] = $Data[$key]
    }

    $result | ConvertTo-Json -Depth 10 -Compress
}

# Validate log file exists
if (-not (Test-Path $JsonLogPath)) {
    Write-JsonResult -Success $false -Error "Log file not found: $JsonLogPath"
    exit 1
}

# Read and parse log file
try {
    $content = Get-Content $JsonLogPath -Raw -ErrorAction Stop

    if ([string]::IsNullOrWhiteSpace($content)) {
        Write-JsonResult -Success $false -Error "Log file is empty"
        exit 1
    }

    # Remove BOM if present (U+FEFF = 65279)
    # Note: Only check the actual character code, not StartsWith which can be unreliable
    if ([int][char]$content[0] -eq 65279) {
        $content = $content.Substring(1)
    }

    # Try to parse as JSON array
    $logEntries = @()
    try {
        $parsed = $content | ConvertFrom-Json -ErrorAction Stop
        $logEntries = if ($parsed -is [array]) { $parsed } else { @($parsed) }
    }
    catch {
        # Not a JSON array - try splitting by newlines (JSONL format)
        $lines = $content -split "`n"
        foreach ($line in $lines) {
            $line = $line.Trim()
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            try {
                $obj = $line | ConvertFrom-Json -ErrorAction Stop
                $logEntries += $obj
            }
            catch {
                # Skip unparseable lines
            }
        }
    }

    if ($logEntries.Count -eq 0) {
        Write-JsonResult -Success $false -Error "No valid JSON entries found in log file"
        exit 1
    }
}
catch {
    Write-JsonResult -Success $false -Error "Failed to read log file: $($_.Exception.Message)"
    exit 1
}

# Initialize extraction variables
$affectedFiles = @()
$tokensUsed = @()
$workSummary = ""
$isError = $false
$subtype = ""
$durationMs = 0
$totalCost = 0
$verificationSteps = @()

# Extract data from log entries
foreach ($entry in $logEntries) {
    try {
        # Extract affected files from Write/Edit tool uses in assistant messages
        if ($entry.type -eq "assistant" -and $entry.message -and $entry.message.content) {
            foreach ($contentItem in $entry.message.content) {
                if ($contentItem.type -eq "tool_use") {
                    $toolName = $contentItem.name
                    if ($toolName -eq "Write" -or $toolName -eq "Edit") {
                        $filePath = $contentItem.input.file_path
                        if ($filePath -and $filePath -notin $affectedFiles) {
                            $affectedFiles += $filePath
                        }
                    }
                }
            }

            # Extract per-turn token usage (context window at each turn)
            if ($entry.message.usage) {
                $usage = $entry.message.usage
                $inputTokens = [int]($usage.input_tokens)
                $outputTokens = [int]($usage.output_tokens)
                $cacheRead = if ($usage.cache_read_input_tokens) { [int]($usage.cache_read_input_tokens) } else { 0 }
                $cacheCreate = if ($usage.cache_creation_input_tokens) { [int]($usage.cache_creation_input_tokens) } else { 0 }
                $turnContext = $inputTokens + $outputTokens + $cacheRead + $cacheCreate

                $tokensUsed += $turnContext
            }

            # Look for verification step indicators in text content
            foreach ($contentItem in $entry.message.content) {
                if ($contentItem.type -eq "text" -and $contentItem.text) {
                    $text = $contentItem.text

                    # Match patterns like "Step 1: PASS", "Step 1: FAIL", "Verification passed", etc.
                    $stepMatches = [regex]::Matches($text, '(?i)step\s*(\d+)[:\s]*(?:.*?)?(pass|fail)', [System.Text.RegularExpressions.RegexOptions]::Singleline)
                    foreach ($match in $stepMatches) {
                        $stepNum = $match.Groups[1].Value
                        $result = $match.Groups[2].Value.ToLower()
                        $passed = $result -eq "pass"

                        # Check if we already have this step
                        $existingStep = $verificationSteps | Where-Object { $_.stepNum -eq $stepNum }
                        if (-not $existingStep) {
                            $verificationSteps += @{
                                stepNum = $stepNum
                                description = "Step $stepNum"
                                passed = $passed
                            }
                        }
                    }
                }
            }
        }

        # Extract final result data (but NOT tokens - those come from per-turn assistant entries)
        if ($entry.type -eq "result") {
            $isError = $entry.is_error -eq $true
            $subtype = if ($entry.subtype) { $entry.subtype } else { "unknown" }
            $durationMs = if ($entry.duration_ms) { [int]$entry.duration_ms } else { 0 }
            $workSummary = if ($entry.result) { $entry.result } else { "" }
            $totalCost = if ($entry.total_cost_usd) { $entry.total_cost_usd } else { 0 }
            # Note: Token extraction now happens in assistant entries above to track peak context per turn
        }
    }
    catch {
        # Skip malformed entries
        continue
    }
}


# Determine status based on result entry
$status = if ($isError -or $subtype -eq "error") {
    "error"
} elseif ($subtype -eq "success") {
    "success"
} else {
    # Check work summary for error indicators
    if ($workSummary -match "(?i)(error|failed|failure|blocked|cannot|unable)") {
        "error"
    } else {
        "success"
    }
}

# Build verification object
$allStepsPassed = $true
$verificationObj = @{
    passed = $true
    steps = @()
}

if ($verificationSteps.Count -gt 0) {
    # Sort steps by number and build verification object
    $sortedSteps = $verificationSteps | Sort-Object { [int]$_.stepNum }
    foreach ($step in $sortedSteps) {
        $verificationObj.steps += @{
            description = $step.description
            passed = $step.passed
        }
        if (-not $step.passed) {
            $allStepsPassed = $false
        }
    }
    $verificationObj.passed = $allStepsPassed
} else {
    # No explicit verification steps found - derive from overall status
    $verificationObj.passed = ($status -eq "success")
}

# If verification failed but status is success, mark as error
if (-not $verificationObj.passed -and $status -eq "success") {
    $status = "error"
}

# Build work log from summary
$workLog = @()
if ($workSummary) {
    # Split summary into bullet points or sentences
    $lines = $workSummary -split "`n"
    foreach ($line in $lines) {
        $line = $line.Trim()
        # Skip empty lines and markdown headers
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line -match "^#+\s") { continue }
        # Clean up bullet points
        $line = $line -replace "^[-*]\s*", ""
        if ($line.Length -gt 0 -and $line.Length -lt 500) {
            $workLog += $line
        }
    }
}

# Ensure we have at least one work log entry
if ($workLog.Count -eq 0) {
    $workLog = @("Task processed by $AgentName")
}

# Limit work log to reasonable size
if ($workLog.Count -gt 20) {
    $workLog = $workLog[0..19]
}

# Build timestamps
$completedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
if (-not $StartedAt) {
    # Estimate startedAt from duration if available
    if ($durationMs -gt 0) {
        $startTime = (Get-Date).AddMilliseconds(-$durationMs).ToUniversalTime()
        $StartedAt = $startTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    } else {
        $StartedAt = $completedAt
    }
}

# Convert affected files to relative paths (remove project root if present)
$normalizedFiles = @()
foreach ($file in $affectedFiles) {
    # Remove common Windows absolute path prefixes
    $normalized = $file -replace "^[A-Za-z]:\\.*?\\koalires\\", ""
    $normalized = $normalized -replace "\\", "/"
    $normalizedFiles += $normalized
}

# Build output object
$output = @{
    taskName = $TaskName
    status = $status
    startedAt = $StartedAt
    completedAt = $completedAt
    agent = $AgentName
    verification = $verificationObj
    workLog = $workLog
    affectedFiles = $normalizedFiles
    tokensUsed = $tokensUsed
    durationMs = $durationMs
}

# Add error details if status is error
if ($status -eq "error") {
    $errorMessage = if ($workSummary -and $workSummary.Length -gt 0) {
        # Extract error message from summary
        $errorLine = ($workSummary -split "`n" | Where-Object { $_ -match "(?i)(error|failed|failure)" } | Select-Object -First 1)
        if ($errorLine) { $errorLine.Trim() } else { "Task execution failed" }
    } else {
        "Task execution failed"
    }

    $output.error = @{
        message = $errorMessage
        type = "execution"
        suggestedFix = "Review logs at $JsonLogPath"
    }
}

# Write output file
try {
    $output | ConvertTo-Json -Depth 10 | Set-Content $OutputFilePath -Encoding UTF8 -ErrorAction Stop
}
catch {
    Write-JsonResult -Success $false -Error "Failed to write output file: $($_.Exception.Message)"
    exit 1
}

# Return success with summary
Write-JsonResult -Success $true -Data @{
    status = $status
    affectedFilesCount = $normalizedFiles.Count
    tokensCount = $tokensUsed.Count
    verificationPassed = $verificationObj.passed
    outputFile = $OutputFilePath
}

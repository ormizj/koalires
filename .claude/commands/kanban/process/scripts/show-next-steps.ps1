<#
.SYNOPSIS
    Shows recommended next steps based on affected files from completed kanban tasks.

.DESCRIPTION
    Reads kanban-progress.json to collect affected files from all completed tasks,
    then matches file patterns against rules to suggest post-processing commands.

.PARAMETER ProjectRoot
    The root directory of the project. Defaults to current directory.

.EXAMPLE
    Show-NextSteps -ProjectRoot "C:\MyProject"
#>

function Show-NextSteps {
    param(
        [Parameter(Mandatory = $false)]
        [string]$ProjectRoot = (Get-Location).Path
    )

    $KanbanDir = Join-Path $ProjectRoot ".kanban"
    $ProgressFile = Join-Path $KanbanDir "kanban-progress.json"
    $RulesFile = Join-Path $KanbanDir "next-steps.json"
    $DefaultRulesTemplate = Join-Path $PSScriptRoot "../templates/next-steps-default.json"

    # Check if progress file exists
    if (-not (Test-Path $ProgressFile)) {
        return
    }

    # Collect affected files from all tasks
    $affectedFiles = @()
    try {
        $progressContent = Get-Content $ProgressFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop

        foreach ($prop in $progressContent.PSObject.Properties) {
            $entry = $prop.Value
            if ($entry.affectedFiles -and $entry.affectedFiles.Count -gt 0) {
                foreach ($file in $entry.affectedFiles) {
                    if ($affectedFiles -notcontains $file) {
                        $affectedFiles += $file
                    }
                }
            }
        }
    }
    catch {
        return
    }

    if ($affectedFiles.Count -eq 0) {
        return
    }

    # Normalize file paths (remove absolute path prefixes)
    $normalizedFiles = @()
    foreach ($file in $affectedFiles) {
        $normalized = $file
        # Remove project root prefix if present
        if ($file.StartsWith($ProjectRoot)) {
            $normalized = $file.Substring($ProjectRoot.Length).TrimStart('\', '/')
        }
        # Convert backslashes to forward slashes for consistent matching
        $normalized = $normalized -replace '\\', '/'
        $normalizedFiles += $normalized
    }

    # Load rules
    $rules = @()

    # Try project-specific rules first
    if (Test-Path $RulesFile) {
        try {
            $rulesContent = Get-Content $RulesFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
            if ($rulesContent.rules) {
                $rules = @($rulesContent.rules)
            }
        }
        catch {
            # Fall through to default rules
        }
    }

    # Fall back to default template
    if ($rules.Count -eq 0 -and (Test-Path $DefaultRulesTemplate)) {
        try {
            $rulesContent = Get-Content $DefaultRulesTemplate -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
            if ($rulesContent.rules) {
                $rules = @($rulesContent.rules)
            }
        }
        catch {
            return
        }
    }

    if ($rules.Count -eq 0) {
        return
    }

    # Match files against rules
    $matchedRules = @{}  # Use hashtable for deduplication by name

    foreach ($file in $normalizedFiles) {
        foreach ($rule in $rules) {
            $pattern = $rule.pattern

            try {
                if ($file -match $pattern) {
                    $ruleName = $rule.name
                    if (-not $matchedRules.ContainsKey($ruleName)) {
                        $matchedRules[$ruleName] = $rule
                    }
                }
            }
            catch {
                # Skip invalid regex patterns
                continue
            }
        }
    }

    if ($matchedRules.Count -eq 0) {
        return
    }

    # Sort by priority (lower = higher priority)
    $sortedRules = $matchedRules.Values | Sort-Object {
        if ($null -eq $_.priority) { 999 } else { $_.priority }
    }

    # Output formatted section
    Write-Host ""
    Write-Host ("=" * 50) -ForegroundColor Cyan
    Write-Host "            RECOMMENDED NEXT STEPS" -ForegroundColor Cyan
    Write-Host ("=" * 50) -ForegroundColor Cyan
    Write-Host ""

    $stepNum = 1
    foreach ($rule in $sortedRules) {
        $isCritical = $rule.critical -eq $true
        $command = $rule.command
        $reason = $rule.reason

        # Format step number
        $stepPrefix = "  $stepNum. "

        if ($isCritical) {
            Write-Host $stepPrefix -NoNewline -ForegroundColor White
            Write-Host $command -NoNewline -ForegroundColor Red
            Write-Host " [CRITICAL]" -ForegroundColor Red
        }
        else {
            Write-Host $stepPrefix -NoNewline -ForegroundColor White
            Write-Host $command -ForegroundColor Yellow
        }

        # Show reason
        Write-Host "     -> $reason" -ForegroundColor DarkGray

        $stepNum++
    }

    Write-Host ""
    Write-Host ("=" * 50) -ForegroundColor Cyan
}

# Export function for dot-sourcing
Export-ModuleMember -Function Show-NextSteps -ErrorAction SilentlyContinue

# Kanban Init Script
# Initializes kanban board infrastructure in the project

param(
    [switch]$Force  # Force overwrite even if files exist
)

$ErrorActionPreference = "Stop"

# Get script location to find templates
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InitDir = Split-Path -Parent $ScriptDir
$TemplatesDir = Join-Path $InitDir "templates"
$ViewerSource = Join-Path $TemplatesDir "kanban-viewer"
$AgentSource = Join-Path $TemplatesDir "kanban-unit-tester.md"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "KANBAN INIT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verify templates exist
if (-not (Test-Path $ViewerSource)) {
    Write-Host "ERROR: Viewer template not found at: $ViewerSource" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $AgentSource)) {
    Write-Host "ERROR: Agent template not found at: $AgentSource" -ForegroundColor Red
    exit 1
}

# Step 1: Create .kanban directory
Write-Host "[1/7] Creating .kanban directory..." -ForegroundColor Yellow
if (-not (Test-Path ".kanban")) {
    New-Item -ItemType Directory -Path ".kanban" | Out-Null
    Write-Host "  Created .kanban/" -ForegroundColor Green
} else {
    Write-Host "  .kanban/ already exists" -ForegroundColor Gray
}

# Step 2: Create .kanban/worker-logs directory
Write-Host "[2/7] Creating .kanban/worker-logs directory..." -ForegroundColor Yellow
if (-not (Test-Path ".kanban/worker-logs")) {
    New-Item -ItemType Directory -Path ".kanban/worker-logs" | Out-Null
    Write-Host "  Created .kanban/worker-logs/" -ForegroundColor Green
} else {
    Write-Host "  .kanban/worker-logs/ already exists" -ForegroundColor Gray
}

# Step 3: Create .claude/agents directory (if not exists)
Write-Host "[3/7] Ensuring .claude/agents directory exists..." -ForegroundColor Yellow
if (-not (Test-Path ".claude/agents")) {
    New-Item -ItemType Directory -Path ".claude/agents" -Force | Out-Null
    Write-Host "  Created .claude/agents/" -ForegroundColor Green
} else {
    Write-Host "  .claude/agents/ already exists" -ForegroundColor Gray
}

# Step 4: Copy kanban-unit-tester.md agent (always overwrite for latest version)
Write-Host "[4/7] Copying kanban-unit-tester.md agent..." -ForegroundColor Yellow
$AgentDest = ".claude/agents/kanban-unit-tester.md"
Copy-Item -Path $AgentSource -Destination $AgentDest -Force
Write-Host "  Copied to $AgentDest" -ForegroundColor Green

# Step 5: Copy viewer template (always overwrite for latest version)
Write-Host "[5/7] Copying viewer template..." -ForegroundColor Yellow
$ViewerDest = ".kanban/kanban-viewer"
if (Test-Path $ViewerDest) {
    Remove-Item -Path $ViewerDest -Recurse -Force
}
Copy-Item -Path $ViewerSource -Destination $ViewerDest -Recurse
Write-Host "  Copied to $ViewerDest/" -ForegroundColor Green

# Step 6: Initialize kanban-board.json (only if not exists)
Write-Host "[6/7] Initializing kanban-board.json..." -ForegroundColor Yellow
$BoardFile = ".kanban/kanban-board.json"
if (-not (Test-Path $BoardFile) -or $Force) {
    $BoardContent = @{
        project = "Project Name"
        projectType = "unknown"
        tasks = @()
    } | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($BoardFile, $BoardContent)
    Write-Host "  Created $BoardFile" -ForegroundColor Green
} else {
    Write-Host "  $BoardFile already exists (preserving)" -ForegroundColor Gray
}

# Step 7: Initialize kanban-progress.json (only if not exists)
Write-Host "[7/7] Initializing kanban-progress.json..." -ForegroundColor Yellow
$ProgressFile = ".kanban/kanban-progress.json"
if (-not (Test-Path $ProgressFile) -or $Force) {
    [System.IO.File]::WriteAllText($ProgressFile, "{}")
    Write-Host "  Created $ProgressFile" -ForegroundColor Green
} else {
    Write-Host "  $ProgressFile already exists (preserving)" -ForegroundColor Gray
}

# Step 8: Add npm script to package.json (if not exists)
Write-Host ""
Write-Host "Checking package.json for kanban script..." -ForegroundColor Yellow
$PackageJsonPath = "package.json"
if (Test-Path $PackageJsonPath) {
    $PackageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json

    if (-not $PackageJson.scripts.kanban) {
        $PackageJson.scripts | Add-Member -NotePropertyName "kanban" -NotePropertyValue 'start http://localhost:4150/.kanban/kanban-viewer/ && npx serve . -p 4150 --cors' -Force
        $jsonContent = $PackageJson | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($PackageJsonPath, $jsonContent)
        Write-Host "  Added 'kanban' script to package.json" -ForegroundColor Green
    } else {
        Write-Host "  'kanban' script already exists in package.json" -ForegroundColor Gray
    }
} else {
    Write-Host "  WARNING: package.json not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "KANBAN INIT COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Created:" -ForegroundColor White
Write-Host "  - .kanban/" -ForegroundColor Gray
Write-Host "  - .kanban/worker-logs/" -ForegroundColor Gray
Write-Host "  - .kanban/kanban-viewer/" -ForegroundColor Gray
Write-Host "  - .kanban/kanban-board.json" -ForegroundColor Gray
Write-Host "  - .kanban/kanban-progress.json" -ForegroundColor Gray
Write-Host "  - .claude/agents/kanban-unit-tester.md" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Run '/kanban:create <feature description>' to create a kanban board" -ForegroundColor Gray
Write-Host "  2. Run 'npm run kanban' to open the kanban board viewer" -ForegroundColor Gray
Write-Host "  3. Run '/kanban:process' to start processing tasks" -ForegroundColor Gray

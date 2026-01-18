# Project Sync Script
# Runs architecture-check, sync-agents, and sync-claude-md in sequence

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PROJECT SYNC" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Phase 1: Architecture Check
Write-Host "[1/3] Running architecture-check..." -ForegroundColor Yellow
claude -p "run /architecture-check"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Architecture check completed with issues" -ForegroundColor Red
} else {
    Write-Host "Architecture check completed" -ForegroundColor Green
}
Write-Host ""

# Phase 2: Sync Agents
Write-Host "[2/3] Running sync-agents..." -ForegroundColor Yellow
claude -p "run /sync-agents"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync agents completed with issues" -ForegroundColor Red
} else {
    Write-Host "Sync agents completed" -ForegroundColor Green
}
Write-Host ""

# Phase 3: Sync Claude MD
Write-Host "[3/3] Running sync-claude-md..." -ForegroundColor Yellow
claude -p "run /sync-claude-md"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync claude-md completed with issues" -ForegroundColor Red
} else {
    Write-Host "Sync claude-md completed" -ForegroundColor Green
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PROJECT SYNC COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
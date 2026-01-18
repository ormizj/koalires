# Project Validate Fix Script
# Runs lint, architecture-check, sync-agents, and sync-claude-md in sequence

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PROJECT VALIDATE FIX" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Phase 1: Lint
Write-Host "[1/4] Running lint..." -ForegroundColor Yellow
claude -p "run /lint"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Lint completed with issues" -ForegroundColor Red
} else {
    Write-Host "Lint completed" -ForegroundColor Green
}
Write-Host ""

# Phase 2: Architecture Check
Write-Host "[2/4] Running architecture-check..." -ForegroundColor Yellow
claude -p "run /architecture-check"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Architecture check completed with issues" -ForegroundColor Red
} else {
    Write-Host "Architecture check completed" -ForegroundColor Green
}
Write-Host ""

# Phase 3: Sync Agents
Write-Host "[3/4] Running sync-agents..." -ForegroundColor Yellow
claude -p "run /sync-agents"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync agents completed with issues" -ForegroundColor Red
} else {
    Write-Host "Sync agents completed" -ForegroundColor Green
}
Write-Host ""

# Phase 4: Sync Claude MD
Write-Host "[4/4] Running sync-claude-md..." -ForegroundColor Yellow
claude -p "run /sync-claude-md"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync claude-md completed with issues" -ForegroundColor Red
} else {
    Write-Host "Sync claude-md completed" -ForegroundColor Green
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PROJECT VALIDATE FIX COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
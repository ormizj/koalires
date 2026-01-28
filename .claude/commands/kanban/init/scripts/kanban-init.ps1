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
$UpdaterAgentSource = Join-Path $TemplatesDir "kanban-command-updater.md"
$NextStepsDefaultSource = Join-Path $PSScriptRoot "../../process/templates/next-steps-default.json"

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

if (-not (Test-Path $UpdaterAgentSource)) {
    Write-Host "ERROR: Updater agent template not found at: $UpdaterAgentSource" -ForegroundColor Red
    exit 1
}

# Step 1: Create .kanban directory
Write-Host "[1/11] Creating .kanban directory..." -ForegroundColor Yellow
if (-not (Test-Path ".kanban")) {
    New-Item -ItemType Directory -Path ".kanban" | Out-Null
    Write-Host "  Created .kanban/" -ForegroundColor Green
} else {
    Write-Host "  .kanban/ already exists" -ForegroundColor Gray
}

# Step 2: Create .kanban/worker-logs directory
Write-Host "[2/11] Creating .kanban/worker-logs directory..." -ForegroundColor Yellow
if (-not (Test-Path ".kanban/worker-logs")) {
    New-Item -ItemType Directory -Path ".kanban/worker-logs" | Out-Null
    Write-Host "  Created .kanban/worker-logs/" -ForegroundColor Green
} else {
    Write-Host "  .kanban/worker-logs/ already exists" -ForegroundColor Gray
}

# Step 3: Create .claude/agents directory (if not exists)
Write-Host "[3/11] Ensuring .claude/agents directory exists..." -ForegroundColor Yellow
if (-not (Test-Path ".claude/agents")) {
    New-Item -ItemType Directory -Path ".claude/agents" -Force | Out-Null
    Write-Host "  Created .claude/agents/" -ForegroundColor Green
} else {
    Write-Host "  .claude/agents/ already exists" -ForegroundColor Gray
}

# Step 4: Copy kanban agents (always overwrite for latest version)
Write-Host "[4/11] Copying kanban agents..." -ForegroundColor Yellow
$AgentDest = ".claude/agents/kanban-unit-tester.md"
Copy-Item -Path $AgentSource -Destination $AgentDest -Force
Write-Host "  Copied kanban-unit-tester.md to $AgentDest" -ForegroundColor Green

$UpdaterAgentDest = ".claude/agents/kanban-command-updater.md"
Copy-Item -Path $UpdaterAgentSource -Destination $UpdaterAgentDest -Force
Write-Host "  Copied kanban-command-updater.md to $UpdaterAgentDest" -ForegroundColor Green

# Step 5: Copy viewer template (always overwrite for latest version)
Write-Host "[5/11] Copying viewer template..." -ForegroundColor Yellow
$ViewerDest = ".kanban/kanban-viewer"
if (Test-Path $ViewerDest) {
    Remove-Item -Path $ViewerDest -Recurse -Force
}
Copy-Item -Path $ViewerSource -Destination $ViewerDest -Recurse
Write-Host "  Copied to $ViewerDest/" -ForegroundColor Green

# Step 6: Initialize kanban-board.json (only if not exists)
Write-Host "[6/11] Initializing kanban-board.json..." -ForegroundColor Yellow
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
Write-Host "[7/11] Initializing kanban-progress.json..." -ForegroundColor Yellow
$ProgressFile = ".kanban/kanban-progress.json"
if (-not (Test-Path $ProgressFile) -or $Force) {
    [System.IO.File]::WriteAllText($ProgressFile, "{}")
    Write-Host "  Created $ProgressFile" -ForegroundColor Green
} else {
    Write-Host "  $ProgressFile already exists (preserving)" -ForegroundColor Gray
}

# Step 8: Create config.json with base settings (test config added by verify-tests)
Write-Host "[8/11] Creating config.json..." -ForegroundColor Yellow
$ConfigFile = ".kanban/config.json"
if (-not (Test-Path $ConfigFile) -or $Force) {
    # Detect project type and verification scripts
    $verification = @{}
    $projectType = "unknown"

    # Node.js detection (package.json)
    if (Test-Path "package.json") {
        $projectType = "nodejs"
        $pkgJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        if ($pkgJson.scripts.typecheck) {
            $verification.typecheck = "npm run typecheck"
        }
        if ($pkgJson.scripts.lint) {
            $verification.lint = "npm run lint"
        }
        if ($pkgJson.scripts.'lint:fix') {
            $verification.lintFix = "npm run lint:fix"
        }
    }
    # PHP/Composer detection (composer.json)
    elseif (Test-Path "composer.json") {
        $projectType = "php"
        $composerJson = Get-Content "composer.json" -Raw | ConvertFrom-Json
        if ($composerJson.scripts.test) {
            $verification.test = "composer test"
        }
        if ($composerJson.scripts.'test:unit') {
            $verification.testUnit = "composer test:unit"
        }
        if ($composerJson.scripts.lint -or $composerJson.scripts.'lint:fix' -or $composerJson.scripts.phpstan) {
            if ($composerJson.scripts.lint) { $verification.lint = "composer lint" }
            if ($composerJson.scripts.'lint:fix') { $verification.lintFix = "composer lint:fix" }
            if ($composerJson.scripts.phpstan) { $verification.phpstan = "composer phpstan" }
        }
    }
    # Python detection (pyproject.toml or requirements.txt)
    elseif ((Test-Path "pyproject.toml") -or (Test-Path "requirements.txt")) {
        $projectType = "python"
        # Common Python tools
        if (Get-Command "pytest" -ErrorAction SilentlyContinue) {
            $verification.test = "pytest"
        }
        if (Get-Command "ruff" -ErrorAction SilentlyContinue) {
            $verification.lint = "ruff check ."
            $verification.lintFix = "ruff check . --fix"
        } elseif (Get-Command "flake8" -ErrorAction SilentlyContinue) {
            $verification.lint = "flake8 ."
        }
        if (Get-Command "mypy" -ErrorAction SilentlyContinue) {
            $verification.typecheck = "mypy ."
        }
    }
    # Go detection (go.mod)
    elseif (Test-Path "go.mod") {
        $projectType = "go"
        $verification.test = "go test ./..."
        $verification.lint = "go vet ./..."
        if (Get-Command "golangci-lint" -ErrorAction SilentlyContinue) {
            $verification.lint = "golangci-lint run"
        }
    }
    # Rust detection (Cargo.toml)
    elseif (Test-Path "Cargo.toml") {
        $projectType = "rust"
        $verification.test = "cargo test"
        $verification.lint = "cargo clippy"
        $verification.build = "cargo build"
    }

    $configContent = @{
        projectType = $projectType
        testTimeout = 120000
        verification = $verification
    }
    $configContent | ConvertTo-Json -Depth 5 | Set-Content $ConfigFile -Encoding UTF8
    Write-Host "  Created $ConfigFile" -ForegroundColor Green
    Write-Host "    Detected project type: $projectType" -ForegroundColor Gray
    if ($verification.Count -gt 0) {
        Write-Host "    Detected verification commands: $($verification.Keys -join ', ')" -ForegroundColor Gray
    }
} else {
    Write-Host "  $ConfigFile already exists (preserving)" -ForegroundColor Gray
}

# Step 9: Add kanban script to package manager (if applicable)
Write-Host "[9/11] Adding kanban script to package manager..." -ForegroundColor Yellow

# Node.js: Add to package.json
if (Test-Path "package.json") {
    $PackageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    if (-not $PackageJson.scripts.kanban) {
        $PackageJson.scripts | Add-Member -NotePropertyName "kanban" -NotePropertyValue 'start http://localhost:4150/.kanban/kanban-viewer/ && npx serve . -p 4150 --cors' -Force
        $jsonContent = $PackageJson | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText("package.json", $jsonContent)
        Write-Host "  Added 'kanban' script to package.json" -ForegroundColor Green
    } else {
        Write-Host "  'kanban' script already exists in package.json" -ForegroundColor Gray
    }
}
# PHP: Add to composer.json
elseif (Test-Path "composer.json") {
    $ComposerJson = Get-Content "composer.json" -Raw | ConvertFrom-Json
    if (-not $ComposerJson.scripts) {
        $ComposerJson | Add-Member -NotePropertyName "scripts" -NotePropertyValue @{} -Force
    }
    if (-not $ComposerJson.scripts.kanban) {
        # PHP uses php built-in server or a simple approach
        $ComposerJson.scripts | Add-Member -NotePropertyName "kanban" -NotePropertyValue 'php -S localhost:4150 -t .' -Force
        $jsonContent = $ComposerJson | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText("composer.json", $jsonContent)
        Write-Host "  Added 'kanban' script to composer.json" -ForegroundColor Green
        Write-Host "    Run: composer kanban, then open http://localhost:4150/.kanban/kanban-viewer/" -ForegroundColor Gray
    } else {
        Write-Host "  'kanban' script already exists in composer.json" -ForegroundColor Gray
    }
}
# Python: Create a simple shell script
elseif ((Test-Path "pyproject.toml") -or (Test-Path "requirements.txt")) {
    $KanbanScript = ".kanban/serve-kanban.ps1"
    if (-not (Test-Path $KanbanScript)) {
        $scriptContent = @"
# Serve kanban viewer
`$port = 4150
Write-Host "Starting kanban viewer at http://localhost:`$port/.kanban/kanban-viewer/"
Start-Process "http://localhost:`$port/.kanban/kanban-viewer/"
python -m http.server `$port
"@
        [System.IO.File]::WriteAllText($KanbanScript, $scriptContent)
        Write-Host "  Created $KanbanScript" -ForegroundColor Green
        Write-Host "    Run: powershell -File $KanbanScript" -ForegroundColor Gray
    } else {
        Write-Host "  $KanbanScript already exists" -ForegroundColor Gray
    }
}
# Go: Create a simple shell script
elseif (Test-Path "go.mod") {
    $KanbanScript = ".kanban/serve-kanban.ps1"
    if (-not (Test-Path $KanbanScript)) {
        $scriptContent = @"
# Serve kanban viewer - requires a static file server
`$port = 4150
Write-Host "Starting kanban viewer at http://localhost:`$port/.kanban/kanban-viewer/"
Write-Host "Note: Install a static server like 'go install github.com/nicholaswilde/serve@latest'"
Start-Process "http://localhost:`$port/.kanban/kanban-viewer/"
# If you have Python installed:
python -m http.server `$port
"@
        [System.IO.File]::WriteAllText($KanbanScript, $scriptContent)
        Write-Host "  Created $KanbanScript" -ForegroundColor Green
        Write-Host "    Run: powershell -File $KanbanScript" -ForegroundColor Gray
    } else {
        Write-Host "  $KanbanScript already exists" -ForegroundColor Gray
    }
}
# Rust: Create a simple shell script
elseif (Test-Path "Cargo.toml") {
    $KanbanScript = ".kanban/serve-kanban.ps1"
    if (-not (Test-Path $KanbanScript)) {
        $scriptContent = @"
# Serve kanban viewer
`$port = 4150
Write-Host "Starting kanban viewer at http://localhost:`$port/.kanban/kanban-viewer/"
Start-Process "http://localhost:`$port/.kanban/kanban-viewer/"
# Uses Python's built-in HTTP server
python -m http.server `$port
"@
        [System.IO.File]::WriteAllText($KanbanScript, $scriptContent)
        Write-Host "  Created $KanbanScript" -ForegroundColor Green
        Write-Host "    Run: powershell -File $KanbanScript" -ForegroundColor Gray
    } else {
        Write-Host "  $KanbanScript already exists" -ForegroundColor Gray
    }
}
else {
    Write-Host "  No recognized package manager found" -ForegroundColor Yellow
    Write-Host "    To serve the kanban viewer, use any static file server at port 4150" -ForegroundColor Gray
    Write-Host "    Then open: http://localhost:4150/.kanban/kanban-viewer/" -ForegroundColor Gray
}

# Step 10: Initialize test directory structure
Write-Host "[10/11] Setting up test infrastructure..." -ForegroundColor Yellow

# Detect project environments
$hasClient = (Test-Path "client") -or (Test-Path "src") -or (Test-Path "app")
$hasServer = (Test-Path "server") -or (Test-Path "api")

# Create base tests directory
if (-not (Test-Path "tests")) {
    New-Item -ItemType Directory -Path "tests" | Out-Null
    Write-Host "  Created tests/" -ForegroundColor Green
} else {
    Write-Host "  tests/ already exists" -ForegroundColor Gray
}

if (-not (Test-Path "tests/unit")) {
    New-Item -ItemType Directory -Path "tests/unit" | Out-Null
}

# Create client test directories if client exists
if ($hasClient) {
    $clientDirs = @(
        "tests/unit/client",
        "tests/unit/client/stores",
        "tests/unit/client/composables",
        "tests/unit/client/components",
        "tests/unit/client/utils"
    )
    foreach ($dir in $clientDirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    Write-Host "  Created client test directories" -ForegroundColor Green
}

# Create server test directories if server exists
if ($hasServer) {
    $serverDirs = @(
        "tests/unit/server",
        "tests/unit/server/api",
        "tests/unit/server/utils",
        "tests/unit/server/repositories"
    )
    foreach ($dir in $serverDirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    Write-Host "  Created server test directories" -ForegroundColor Green
}

# Create integration tests directory
if (-not (Test-Path "tests/integration")) {
    New-Item -ItemType Directory -Path "tests/integration" | Out-Null
    Write-Host "  Created integration test directory" -ForegroundColor Green
} else {
    Write-Host "  tests/integration/ already exists" -ForegroundColor Gray
}

Write-Host "  Test infrastructure ready" -ForegroundColor Cyan

# Step 11: Copy next-steps rules template (only if not exists)
Write-Host "[11/11] Setting up next-steps rules..." -ForegroundColor Yellow
$NextStepsFile = ".kanban/next-steps.json"
if (-not (Test-Path $NextStepsFile) -or $Force) {
    if (Test-Path $NextStepsDefaultSource) {
        Copy-Item -Path $NextStepsDefaultSource -Destination $NextStepsFile -Force
        Write-Host "  Created $NextStepsFile with default rules" -ForegroundColor Green
    } else {
        Write-Host "  Warning: next-steps-default.json template not found" -ForegroundColor Yellow
        Write-Host "    Expected at: $NextStepsDefaultSource" -ForegroundColor Gray
    }
} else {
    Write-Host "  $NextStepsFile already exists (preserving)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Test infrastructure verification will run next..." -ForegroundColor Yellow
Write-Host "  The verify-tests sub-skill ensures TDD workflow is ready" -ForegroundColor Gray
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
Write-Host "  - .kanban/config.json" -ForegroundColor Gray
Write-Host "  - .kanban/next-steps.json (post-process commands)" -ForegroundColor Gray
Write-Host "  - .claude/agents/kanban-unit-tester.md" -ForegroundColor Gray
Write-Host "  - .claude/agents/kanban-command-updater.md" -ForegroundColor Gray
Write-Host "  - tests/unit/client/ (stores, composables, components, utils)" -ForegroundColor Gray
Write-Host "  - tests/unit/server/ (api, utils, repositories)" -ForegroundColor Gray
Write-Host "  - tests/integration/" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Run '/kanban:create <feature description>' to create a kanban board" -ForegroundColor Gray
Write-Host "  2. Run 'npm run kanban' to open the kanban board viewer" -ForegroundColor Gray
Write-Host "  3. Run '/kanban:process' to start processing tasks" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  IMPORTANT: RESTART REQUIRED" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  New agents were added:" -ForegroundColor Yellow
Write-Host "    - kanban-unit-tester.md (TDD specialist)" -ForegroundColor Yellow
Write-Host "    - kanban-command-updater.md (Kanban maintenance)" -ForegroundColor Yellow
Write-Host "  Claude Code must be restarted to recognize them." -ForegroundColor Yellow
Write-Host ""
Write-Host "  To restart: Exit this session and start a new one" -ForegroundColor White
Write-Host "  (Ctrl+C or type 'exit', then run 'claude' again)" -ForegroundColor Gray
Write-Host ""

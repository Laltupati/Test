# QualiVerse AI - Automated Startup & Setup Script
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       QualiVerse AI Setup & Start       " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Prerequisites
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "Error: Python is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Python 3.10+ and re-run this script." -ForegroundColor Red
    exit 1
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $nodeCmd -or -not $npmCmd) {
    Write-Host "Error: Node.js / npm is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js (v18+) and re-run this script." -ForegroundColor Red
    exit 1
}

$rootDir = $PSScriptRoot
Set-Location -Path $rootDir

# 2. Python Virtual Environment Setup
Write-Host "`n[2/5] Setting up Python virtual environment..." -ForegroundColor Yellow
$venvDir = Join-Path $rootDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Creating Python virtual environment (.venv)..." -ForegroundColor Gray
    python -m venv "$venvDir"
}

# 3. Backend Dependencies & Database Seed
Write-Host "`n[3/5] Installing backend dependencies & seeding database..." -ForegroundColor Yellow
$reqPath = Join-Path $rootDir "backend\requirements.txt"
& "$venvPython" -m pip install -r "$reqPath"

$seedPath = Join-Path $rootDir "backend\seed.py"
& "$venvPython" "$seedPath"

# 4. Frontend Dependencies Setup
Write-Host "`n[4/5] Setting up frontend dependencies..." -ForegroundColor Yellow
$frontendDir = Join-Path $rootDir "frontend"
$nodeModulesDir = Join-Path $frontendDir "node_modules"

if (-not (Test-Path $nodeModulesDir)) {
    Write-Host "Installing npm packages for frontend..." -ForegroundColor Gray
    Set-Location -Path $frontendDir
    npm install
    Set-Location -Path $rootDir
} else {
    Write-Host "Frontend node_modules already installed." -ForegroundColor Gray
}

# 5. Start Servers
Write-Host "`n[5/5] Launching Backend & Frontend servers..." -ForegroundColor Yellow

# Start Backend in a new PowerShell window
$backendRunPath = Join-Path $rootDir "backend\run.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting FastAPI Backend...' -ForegroundColor Green; & '$venvPython' '$backendRunPath'" -WorkingDirectory (Join-Path $rootDir "backend")

# Pause briefly for backend startup
Start-Sleep -Seconds 2

# Start Frontend in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting Vite Frontend...' -ForegroundColor Green; npm run dev" -WorkingDirectory $frontendDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   QualiVerse AI Started Successfully!  " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Backend API:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend App: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default Credentials:" -ForegroundColor Yellow
Write-Host "  Admin: admin@qualiverse.ai / S@ikir@n@12" -ForegroundColor Yellow
Write-Host "  User:  user@qualiverse.ai  / Qu@lity@12" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green

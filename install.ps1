# KUNAI CLI Installation Script for Windows PowerShell
# Run this with: .\install.ps1

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Magenta
Write-Host "  KUNAI CLI Installation (Windows)                      " -ForegroundColor Magenta
Write-Host "  Yumi | Yari | Kunai - P2P File Transfer & Messaging   " -ForegroundColor Magenta
Write-Host "=========================================================" -ForegroundColor Magenta
Write-Host ""

# Check Node.js
Write-Host "Checking dependencies..." -ForegroundColor Cyan
try {
    $nodeVersion = node -v
    Write-Host "[OK] Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check npm
try {
    $npmVersion = npm -v
    Write-Host "[OK] npm $npmVersion detected" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] npm is not installed." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Dependencies installed" -ForegroundColor Green
Write-Host ""

# Build project
Write-Host "Building project..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Build completed" -ForegroundColor Green
Write-Host ""

# Link globally
Write-Host "Installing global commands..." -ForegroundColor Cyan
npm link
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] npm link failed. You may need to run PowerShell as Administrator" -ForegroundColor Yellow
    Write-Host "Try: Right-click PowerShell -> Run as Administrator, then run this script again" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "  Installation completed successfully!                  " -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Available commands:" -ForegroundColor Blue
Write-Host "  kunai  - Ephemeral file transfer (like Magic Wormhole)" -ForegroundColor Yellow
Write-Host "  yumi   - P2P messaging" -ForegroundColor Yellow
Write-Host "  yari   - Encrypted P2P messaging" -ForegroundColor Yellow
Write-Host ""

Write-Host "Quick start:" -ForegroundColor Blue
Write-Host "  kunai                    # Start file transfer" -ForegroundColor Cyan
Write-Host "  kunai --encrypted        # Encrypted file transfer" -ForegroundColor Cyan
Write-Host "  yumi                     # Start P2P messaging" -ForegroundColor Cyan
Write-Host "  yari                     # Start encrypted messaging" -ForegroundColor Cyan
Write-Host ""

Write-Host "To uninstall:" -ForegroundColor Blue
Write-Host "  npm unlink -g shogun-yumi" -ForegroundColor Cyan
Write-Host ""

# Test if commands are available
try {
    $kunaiPath = Get-Command kunai -ErrorAction SilentlyContinue
    if ($kunaiPath) {
        Write-Host "[OK] Commands successfully installed and available globally" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Commands installed but may not be in PATH yet" -ForegroundColor Yellow
        Write-Host "   Try opening a new PowerShell window" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Could not verify command installation" -ForegroundColor Yellow
    Write-Host "   Try opening a new PowerShell window" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Happy hacking!" -ForegroundColor Magenta


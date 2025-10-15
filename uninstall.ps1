# KUNAI CLI Uninstallation Script for Windows PowerShell
# Run this with: .\uninstall.ps1

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Magenta
Write-Host "  KUNAI CLI Uninstallation (Windows)                    " -ForegroundColor Magenta
Write-Host "=========================================================" -ForegroundColor Magenta
Write-Host ""

# Check if commands are installed
$installed = $false
try {
    $kunai = Get-Command kunai -ErrorAction SilentlyContinue
    $yumi = Get-Command yumi -ErrorAction SilentlyContinue
    $yari = Get-Command yari -ErrorAction SilentlyContinue
    
    if ($kunai -or $yumi -or $yari) {
        $installed = $true
    }
} catch {
    $installed = $false
}

if (-not $installed) {
    Write-Host "[WARNING] KUNAI CLI commands are not globally installed" -ForegroundColor Yellow
    Write-Host "Nothing to uninstall." -ForegroundColor Blue
    exit 0
}

Write-Host "Removing global commands..." -ForegroundColor Cyan

# Unlink globally
npm unlink -g shogun-yumi 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Global commands removed" -ForegroundColor Green
} else {
    Write-Host "[WARNING] npm unlink encountered issues" -ForegroundColor Yellow
    Write-Host "You may need to run PowerShell as Administrator" -ForegroundColor Yellow
}

Write-Host ""

# Check if uninstallation was successful
try {
    $stillInstalled = $false
    $kunai = Get-Command kunai -ErrorAction SilentlyContinue
    $yumi = Get-Command yumi -ErrorAction SilentlyContinue
    $yari = Get-Command yari -ErrorAction SilentlyContinue
    
    if ($kunai -or $yumi -or $yari) {
        $stillInstalled = $true
    }
    
    if ($stillInstalled) {
        Write-Host "[WARNING] Some commands may still be available" -ForegroundColor Yellow
        Write-Host "   Try opening a new PowerShell window or manually remove:" -ForegroundColor Yellow
        
        if ($kunai) {
            Write-Host "     kunai: $($kunai.Source)" -ForegroundColor Cyan
        }
        if ($yumi) {
            Write-Host "     yumi: $($yumi.Source)" -ForegroundColor Cyan
        }
        if ($yari) {
            Write-Host "     yari: $($yari.Source)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "=========================================================" -ForegroundColor Green
        Write-Host "  Uninstallation completed successfully!                " -ForegroundColor Green
        Write-Host "=========================================================" -ForegroundColor Green
    }
} catch {
    Write-Host "[OK] Commands removed" -ForegroundColor Green
}

Write-Host ""
Write-Host "To reinstall:" -ForegroundColor Blue
Write-Host "  .\install.ps1             # Or: npm run install-global" -ForegroundColor Cyan
Write-Host ""

Write-Host "Goodbye!" -ForegroundColor Magenta


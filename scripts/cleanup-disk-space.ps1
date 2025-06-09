#!/usr/bin/env pwsh
#
# Disk Space Cleanup Script for n8n MCP Server
# This script cleans up various caches and temporary files to free disk space
#

param(
    [switch]$Help,
    [switch]$DryRun
)

if ($Help) {
    Write-Host "Disk Space Cleanup Script" -ForegroundColor Green
    Write-Host ""
    Write-Host "This script cleans up:"
    Write-Host "  - npm cache"
    Write-Host "  - Node.js temporary files"
    Write-Host "  - Project build artifacts"
    Write-Host "  - Windows temporary files (older than 7 days)"
    Write-Host "  - Unused dependencies"
    Write-Host ""
    Write-Host "Usage: ./scripts/cleanup-disk-space.ps1 [-DryRun] [-Help]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -DryRun  Show what would be cleaned without actually deleting"
    Write-Host "  -Help    Show this help message"
    Write-Host ""
    exit 0
}

$ErrorActionPreference = "Continue"
$workDir = Split-Path -Parent $PSScriptRoot

Write-Host "🧹 Starting disk space cleanup..." -ForegroundColor Green
Write-Host ""

# Change to project directory
Set-Location $workDir

# Function to get folder size
function Get-FolderSize {
    param([string]$Path)
    try {
        if (Test-Path $Path) {
            $size = (Get-ChildItem -Path $Path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            return [math]::Round($size / 1MB, 2)
        }
        return 0
    }
    catch {
        return 0
    }
}

# Function to safely remove folder
function Remove-FolderSafely {
    param([string]$Path, [string]$Description)
    
    if (Test-Path $Path) {
        $size = Get-FolderSize $Path
        if ($DryRun) {
            Write-Host "  [DRY RUN] Would remove: $Description ($size MB)" -ForegroundColor Yellow
        } else {
            Write-Host "  Removing: $Description ($size MB)" -ForegroundColor Blue
            try {
                Remove-Item -Path $Path -Recurse -Force -ErrorAction Stop
                Write-Host "    ✅ Removed successfully" -ForegroundColor Green
            } catch {
                Write-Host "    ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
}

Write-Host "📊 Current project folder sizes:" -ForegroundColor Cyan
Write-Host "  node_modules: $(Get-FolderSize 'node_modules') MB" -ForegroundColor White
Write-Host "  build: $(Get-FolderSize 'build') MB" -ForegroundColor White
Write-Host "  coverage: $(Get-FolderSize 'coverage') MB" -ForegroundColor White
Write-Host "  .wrangler: $(Get-FolderSize '.wrangler') MB" -ForegroundColor White
Write-Host ""

# Clean npm cache
Write-Host "🗑️  Cleaning npm cache..." -ForegroundColor Blue
if ($DryRun) {
    Write-Host "  [DRY RUN] Would run: npm cache clean --force" -ForegroundColor Yellow
} else {
    npm cache clean --force
    Write-Host "  ✅ npm cache cleaned" -ForegroundColor Green
}

# Clean project artifacts
Write-Host "🗑️  Cleaning project artifacts..." -ForegroundColor Blue
Remove-FolderSafely "coverage" "Test coverage files"
Remove-FolderSafely ".wrangler" "Wrangler cache"
Remove-FolderSafely "build" "Build artifacts"

# Clean node_modules and reinstall (optional)
if ($env:CLEAN_NODE_MODULES -eq "true") {
    Write-Host "🗑️  Cleaning node_modules..." -ForegroundColor Blue
    Remove-FolderSafely "node_modules" "Node modules"
    
    if (-not $DryRun) {
        Write-Host "📦 Reinstalling dependencies..." -ForegroundColor Blue
        npm install
        Write-Host "  ✅ Dependencies reinstalled" -ForegroundColor Green
    }
}

# Clean Windows temp files (be very careful here)
Write-Host "🗑️  Cleaning old temporary files..." -ForegroundColor Blue
if ($DryRun) {
    Write-Host "  [DRY RUN] Would clean temporary files older than 7 days" -ForegroundColor Yellow
} else {
    try {
        $tempPath = $env:TEMP
        $cutoff = (Get-Date).AddDays(-7)
        $tempFiles = Get-ChildItem -Path $tempPath -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cutoff }
        $tempCount = ($tempFiles | Measure-Object).Count
        
        if ($tempCount -gt 0) {
            Write-Host "  Found $tempCount old temp files to remove" -ForegroundColor White
            $tempFiles | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  ✅ Cleaned temporary files" -ForegroundColor Green
        } else {
            Write-Host "  ✅ No old temporary files found" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⚠️  Could not clean all temp files: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📊 Final project folder sizes:" -ForegroundColor Cyan
Write-Host "  node_modules: $(Get-FolderSize 'node_modules') MB" -ForegroundColor White
Write-Host "  build: $(Get-FolderSize 'build') MB" -ForegroundColor White
Write-Host "  coverage: $(Get-FolderSize 'coverage') MB" -ForegroundColor White
Write-Host "  .wrangler: $(Get-FolderSize '.wrangler') MB" -ForegroundColor White
Write-Host ""

if ($DryRun) {
    Write-Host "Dry run completed. No files were actually deleted." -ForegroundColor Yellow
    Write-Host "Run without -DryRun to perform actual cleanup." -ForegroundColor Yellow
} else {
    Write-Host "Disk cleanup completed!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Additional tips:" -ForegroundColor Cyan
Write-Host "  - Use Windows Disk Cleanup tool for system files" -ForegroundColor White
Write-Host "  - Empty Recycle Bin" -ForegroundColor White
Write-Host "  - Clear browser cache and downloads" -ForegroundColor White
Write-Host "  - Uninstall unused programs" -ForegroundColor White
Write-Host "  - Run: cleanmgr.exe for Windows Disk Cleanup" -ForegroundColor White 
#!/usr/bin/env pwsh
#
# Start n8n MCP Server with SSE Bridge
# This script starts both the main streamable HTTP server and the SSE bridge
#

param(
    [switch]$Help
)

if ($Help) {
    Write-Host "Start n8n MCP Server with SSE Bridge" -ForegroundColor Green
    Write-Host ""
    Write-Host "This script starts both:"
    Write-Host "  - Main MCP Server (streamable HTTP) on port 3000"
    Write-Host "  - SSE Bridge (converts SSE to streamable HTTP) on port 3001"
    Write-Host ""
    Write-Host "Usage: ./scripts/start-with-sse-bridge.ps1"
    Write-Host ""
    Write-Host "Environment Variables:"
    Write-Host "  N8N_BASE_URL - n8n API base URL"
    Write-Host "  N8N_API_KEY - n8n API key"
    Write-Host "  PORT - Main server port (default: 3000)"
    Write-Host "  SSE_BRIDGE_PORT - SSE bridge port (default: 3001)"
    Write-Host "  MCP_SERVER_URL - Target for SSE bridge (default: http://localhost:3000/mcp)"
    Write-Host ""
    exit 0
}

$ErrorActionPreference = "Stop"
$workDir = Split-Path -Parent $PSScriptRoot

Write-Host "🚀 Starting n8n MCP Server with SSE Bridge..." -ForegroundColor Green
Write-Host ""

# Check for required environment variables
$n8nBaseUrl = $env:N8N_BASE_URL
$n8nApiKey = $env:N8N_API_KEY

if (-not $n8nBaseUrl) {
    Write-Host "❌ N8N_BASE_URL environment variable is required" -ForegroundColor Red
    Write-Host "Set it with: `$env:N8N_BASE_URL = 'https://your-n8n-instance.com/api/v1'" -ForegroundColor Yellow
    exit 1
}

if (-not $n8nApiKey) {
    Write-Host "❌ N8N_API_KEY environment variable is required" -ForegroundColor Red
    Write-Host "Set it with: `$env:N8N_API_KEY = 'your-api-key'" -ForegroundColor Yellow
    exit 1
}

# Set default ports
if (-not $env:PORT) {
    $env:PORT = "3000"
}

if (-not $env:SSE_BRIDGE_PORT) {
    $env:SSE_BRIDGE_PORT = "3001"
}

if (-not $env:MCP_SERVER_URL) {
    $env:MCP_SERVER_URL = "http://localhost:$($env:PORT)/mcp"
}

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Main Server Port: $($env:PORT)" -ForegroundColor White
Write-Host "  SSE Bridge Port: $($env:SSE_BRIDGE_PORT)" -ForegroundColor White
Write-Host "  n8n API URL: $n8nBaseUrl" -ForegroundColor White
Write-Host "  n8n API Key: $($n8nApiKey.Substring(0, [Math]::Min(8, $n8nApiKey.Length)))..." -ForegroundColor White
Write-Host ""

# Change to project directory
Set-Location $workDir

try {
    # Build the project
    Write-Host "🔨 Building project..." -ForegroundColor Blue
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    
    # Start main server in background
    Write-Host "🌐 Starting main MCP server on port $($env:PORT)..." -ForegroundColor Blue
    $mainServerJob = Start-Job -ScriptBlock {
        param($workDir, $port, $n8nBaseUrl, $n8nApiKey)
        Set-Location $workDir
        $env:PORT = $port
        $env:N8N_BASE_URL = $n8nBaseUrl
        $env:N8N_API_KEY = $n8nApiKey
        node build/index.js
    } -ArgumentList $workDir, $env:PORT, $n8nBaseUrl, $n8nApiKey
    
    # Wait a moment for main server to start
    Start-Sleep -Seconds 3
    
    # Check if main server is running
    try {
        $healthCheck = Invoke-WebRequest -Uri "http://localhost:$($env:PORT)/health" -Method GET -TimeoutSec 5
        Write-Host "✅ Main server is running" -ForegroundColor Green
    } catch {
        Write-Host "❌ Main server failed to start" -ForegroundColor Red
        Stop-Job $mainServerJob -ErrorAction SilentlyContinue
        Remove-Job $mainServerJob -ErrorAction SilentlyContinue
        throw "Main server startup failed"
    }
    
    # Start SSE bridge
    Write-Host "🌉 Starting SSE bridge on port $($env:SSE_BRIDGE_PORT)..." -ForegroundColor Blue
    $sseJob = Start-Job -ScriptBlock {
        param($workDir, $port, $serverUrl)
        Set-Location $workDir
        $env:SSE_BRIDGE_PORT = $port
        $env:MCP_SERVER_URL = $serverUrl
        node build/sse-bridge.js
    } -ArgumentList $workDir, $env:SSE_BRIDGE_PORT, $env:MCP_SERVER_URL
    
    # Wait a moment for SSE bridge to start
    Start-Sleep -Seconds 3
    
    # Check if SSE bridge is running
    try {
        $bridgeHealthCheck = Invoke-WebRequest -Uri "http://localhost:$($env:SSE_BRIDGE_PORT)/health" -Method GET -TimeoutSec 5
        Write-Host "✅ SSE bridge is running" -ForegroundColor Green
    } catch {
        Write-Host "❌ SSE bridge failed to start" -ForegroundColor Red
        Stop-Job $mainServerJob -ErrorAction SilentlyContinue
        Stop-Job $sseJob -ErrorAction SilentlyContinue
        Remove-Job $mainServerJob -ErrorAction SilentlyContinue
        Remove-Job $sseJob -ErrorAction SilentlyContinue
        throw "SSE bridge startup failed"
    }
    
    Write-Host ""
    Write-Host "🎉 Both servers are running successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📡 Endpoints:" -ForegroundColor Cyan
    Write-Host "  Main MCP Server (streamable HTTP): http://localhost:$($env:PORT)/mcp" -ForegroundColor White
    Write-Host "  SSE Bridge: http://localhost:$($env:SSE_BRIDGE_PORT)/sse" -ForegroundColor White
    Write-Host "  Health checks: http://localhost:$($env:PORT)/health, http://localhost:$($env:SSE_BRIDGE_PORT)/health" -ForegroundColor White
    Write-Host ""
    Write-Host "🔍 Test with MCP Inspector:" -ForegroundColor Cyan
    Write-Host "  Streamable HTTP: npx @modelcontextprotocol/inspector `"http://localhost:$($env:PORT)/mcp?n8n.baseUrl=$n8nBaseUrl`&n8n.apiKey=$n8nApiKey`"" -ForegroundColor White
    Write-Host "  SSE (via bridge): npx @modelcontextprotocol/inspector `"http://localhost:$($env:SSE_BRIDGE_PORT)/sse?n8n.baseUrl=$n8nBaseUrl`&n8n.apiKey=$n8nApiKey`"" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Ctrl+C to stop both servers..." -ForegroundColor Yellow
    
    # Wait for user interruption
    try {
        while ($true) {
            Start-Sleep -Seconds 1
            
            # Check if jobs are still running
            if ($mainServerJob.State -eq "Failed" -or $mainServerJob.State -eq "Completed") {
                Write-Host "❌ Main server job ended unexpectedly" -ForegroundColor Red
                break
            }
            
            if ($sseJob.State -eq "Failed" -or $sseJob.State -eq "Completed") {
                Write-Host "❌ SSE bridge job ended unexpectedly" -ForegroundColor Red
                break
            }
        }
    } catch {
        # User interrupted
        Write-Host ""
        Write-Host "🛑 Shutting down servers..." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Clean up jobs
    if ($mainServerJob) {
        Stop-Job $mainServerJob -ErrorAction SilentlyContinue
        Remove-Job $mainServerJob -ErrorAction SilentlyContinue
    }
    
    if ($sseJob) {
        Stop-Job $sseJob -ErrorAction SilentlyContinue
        Remove-Job $sseJob -ErrorAction SilentlyContinue
    }
    
    Write-Host "✅ Cleanup complete" -ForegroundColor Green
} 
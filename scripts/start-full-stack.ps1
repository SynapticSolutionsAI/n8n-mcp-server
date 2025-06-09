# Full Stack Startup Script for n8n MCP Server
# This script starts the HTTP server, proxy, and inspector in the correct order

param(
    [switch]$SkipInspector = $false
)

Write-Host "Starting n8n MCP Server Full Stack..." -ForegroundColor Green

# Set up environment
& scripts/setup-environment.ps1

Write-Host "`nStep 1: Building the project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 2: Starting HTTP Server..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-ExecutionPolicy Bypass -File scripts/start-http-server.ps1" -WindowStyle Normal

# Wait for HTTP server to start
Write-Host "Waiting for HTTP server to start..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Test HTTP server
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
    Write-Host "HTTP Server is running: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "HTTP Server failed to start!" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 3: Starting MCP Proxy..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-ExecutionPolicy Bypass -File scripts/start-mcp-proxy.ps1" -WindowStyle Normal

# Wait for proxy to start
Write-Host "Waiting for MCP proxy to start..." -ForegroundColor Gray
Start-Sleep -Seconds 5

if (-not $SkipInspector) {
    Write-Host "`nStep 4: Starting MCP Inspector..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    & scripts/connect-inspector-to-proxy.ps1
} else {
    Write-Host "`nSkipping MCP Inspector..." -ForegroundColor Gray
}

Write-Host "`nFull stack startup complete!" -ForegroundColor Green
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  HTTP Server: http://localhost:3000" -ForegroundColor Gray
Write-Host "  MCP Proxy: http://localhost:8080/sse" -ForegroundColor Gray
if (-not $SkipInspector) {
    Write-Host "  Inspector: http://localhost:8276" -ForegroundColor Gray
} 
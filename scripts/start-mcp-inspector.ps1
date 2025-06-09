# Start MCP Inspector with proper authentication
# This script handles the PowerShell environment variable setup correctly

param(
    [string]$Port = "8276",
    [string]$ApiKey = "mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s",
    [string]$ProxyUrl = "https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev",
    [switch]$Local = $false
)

Write-Host "Starting MCP Inspector..." -ForegroundColor Green

# Set environment variables properly
$env:CLIENT_PORT = $Port

# Check if port is available
$portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "Warning: Port $Port is already in use. Trying next available port..." -ForegroundColor Yellow
    $Port = [string]([int]$Port + 1)
    $env:CLIENT_PORT = $Port
}

if ($Local) {
    # Connect to local development server (use streamable-http instead of SSE)
    $mcpUrl = "http://localhost:3000/mcp".Trim()
    Write-Host "Connecting to local MCP server: $mcpUrl" -ForegroundColor Cyan
    Write-Host "Transport: streamable-http" -ForegroundColor Gray
    
    & npx @modelcontextprotocol/inspector $mcpUrl
} else {
    # Connect to deployed proxy with API key (use streamable-http instead of SSE)
    # SSE is deprecated, use the streamable-http endpoint instead
    $mcpUrl = "$ProxyUrl/mcp?apiKey=$ApiKey".Trim()
    Write-Host "Connecting to deployed MCP proxy: $ProxyUrl" -ForegroundColor Cyan
    Write-Host "Using API key: $ApiKey" -ForegroundColor Gray
    Write-Host "Full URL: $mcpUrl" -ForegroundColor Gray
    Write-Host "Transport: streamable-http (SSE is deprecated)" -ForegroundColor Gray
    
    # Use call operator (&) to avoid argument parsing issues
    & npx @modelcontextprotocol/inspector $mcpUrl
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "MCP Inspector failed to start. Error code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Try running with different parameters or check the troubleshooting guide." -ForegroundColor Yellow
} 
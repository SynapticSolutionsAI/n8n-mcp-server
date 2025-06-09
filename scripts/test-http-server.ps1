# Test HTTP Server MCP Endpoint
# This script tests the streamable-http MCP endpoint

param(
    [string]$ServerUrl = "http://localhost:3000/mcp"
)

Write-Host "Testing n8n MCP Server HTTP endpoint..." -ForegroundColor Green
Write-Host "Server URL: $ServerUrl" -ForegroundColor Cyan

# Test 1: Health check
Write-Host ""
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
    Write-Host "Health: $($health.status)" -ForegroundColor Green
}
catch {
    Write-Host "Health check failed: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Root endpoint
Write-Host ""
Write-Host "Test 2: Root Endpoint" -ForegroundColor Yellow
try {
    $root = Invoke-RestMethod -Uri "http://localhost:3000/" -TimeoutSec 5
    Write-Host "Service: $($root.service)" -ForegroundColor Green
}
catch {
    Write-Host "Root endpoint failed: $_" -ForegroundColor Red
}

# Test 3: MCP tools/list request
Write-Host ""
Write-Host "Test 3: MCP Tools List" -ForegroundColor Yellow
try {
    $body = '{"jsonrpc":"2.0","method":"tools/list","id":1}'
    $url = "$ServerUrl" + "?n8nApiUrl=" + $env:N8N_API_URL + "&n8nApiKey=" + $env:N8N_API_KEY
    
    Write-Host "URL: $url" -ForegroundColor Gray
    Write-Host "Body: $body" -ForegroundColor Gray
    
    $response = Invoke-RestMethod -Uri $url -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    
    if ($response.result -and $response.result.tools) {
        Write-Host "Found $($response.result.tools.Count) tools" -ForegroundColor Green
        foreach ($tool in $response.result.tools) {
            Write-Host "  - $($tool.name): $($tool.description)" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "No tools found in response" -ForegroundColor Red
        Write-Host "Response: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "MCP request failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Green 
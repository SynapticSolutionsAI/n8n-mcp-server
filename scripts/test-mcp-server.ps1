# Test MCP Server endpoints and authentication
# This script verifies that the MCP server is working correctly

param(
    [string]$ApiKey = "mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s",
    [string]$ProxyUrl = "https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev",
    [switch]$Local = $false
)

function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [string]$Description
    )
    
    Write-Host "`nTesting: $Description" -ForegroundColor Cyan
    Write-Host "URL: $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-RestMethod @params
        Write-Host "✅ Success: $([int]$response.PSObject.Properties['StatusCode'].Value)" -ForegroundColor Green
        Write-Host "Response: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor White
        return $true
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "❌ Failed: HTTP $statusCode" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

Write-Host "=== MCP Server Test Suite ===" -ForegroundColor Yellow

if ($Local) {
    $baseUrl = "http://localhost:3000"
    Write-Host "Testing local MCP server: $baseUrl" -ForegroundColor Cyan
} else {
    $baseUrl = $ProxyUrl
    Write-Host "Testing deployed MCP proxy: $baseUrl" -ForegroundColor Cyan
}

# Test 1: Health check
$healthResult = Test-Endpoint -Url "$baseUrl/health" -Description "Health check endpoint"

# Test 2: Root endpoint
$rootResult = Test-Endpoint -Url "$baseUrl/" -Description "Root endpoint"

# Test 3: MCP endpoint without authentication (should fail with 401)
Write-Host "`nTesting: MCP endpoint without authentication (should fail)" -ForegroundColor Cyan
$unauthorizedResult = Test-Endpoint -Url "$baseUrl/mcp" -Method "POST" -Body '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' -Description "MCP without auth"

# Test 4: MCP endpoint with authentication
$headers = @{"X-API-Key" = $ApiKey}
$initializeBody = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
$authorizedResult = Test-Endpoint -Url "$baseUrl/mcp" -Method "POST" -Headers $headers -Body $initializeBody -Description "MCP with authentication"

# Test 5: Tools list
if ($authorizedResult) {
    $toolsBody = '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
    $toolsResult = Test-Endpoint -Url "$baseUrl/mcp" -Method "POST" -Headers $headers -Body $toolsBody -Description "List available tools"
}

# Test 6: SSE endpoint (if not local)
if (-not $Local) {
    $sseUrl = "$baseUrl/mcp/sse?apiKey=$ApiKey"
    Write-Host "`nTesting: SSE endpoint" -ForegroundColor Cyan
    Write-Host "URL: $sseUrl" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $sseUrl -Method GET -Headers @{"Accept" = "text/event-stream"}
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ SSE endpoint accessible" -ForegroundColor Green
            Write-Host "Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "❌ SSE endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n=== Test Results Summary ===" -ForegroundColor Yellow
Write-Host "Health Check: $(if($healthResult){'✅ PASS'}else{'❌ FAIL'})" -ForegroundColor $(if($healthResult){'Green'}else{'Red'})
Write-Host "Root Endpoint: $(if($rootResult){'✅ PASS'}else{'❌ FAIL'})" -ForegroundColor $(if($rootResult){'Green'}else{'Red'})
Write-Host "MCP Authentication: $(if($authorizedResult){'✅ PASS'}else{'❌ FAIL'})" -ForegroundColor $(if($authorizedResult){'Green'}else{'Red'})

if ($authorizedResult) {
    Write-Host "`n🎉 MCP Server is working correctly!" -ForegroundColor Green
    Write-Host "You can now use MCP Inspector with the following command:" -ForegroundColor Cyan
    if ($Local) {
        Write-Host "npx @modelcontextprotocol/inspector --url `"http://localhost:3000/mcp`"" -ForegroundColor White
    } else {
        Write-Host "npx @modelcontextprotocol/inspector --url `"$baseUrl/mcp/sse?apiKey=$ApiKey`"" -ForegroundColor White
    }
} else {
    Write-Host "`n❌ MCP Server has issues. Check the troubleshooting guide." -ForegroundColor Red
} 
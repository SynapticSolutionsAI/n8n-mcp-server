#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Test script for n8n MCP Server (Updated MCP 2025-03-26)

.DESCRIPTION
    Comprehensive testing script for the updated n8n MCP Server implementation
    following MCP specification 2025-03-26 with streamable HTTP transport.

.PARAMETER Local
    Test against local server (default: false, tests deployed Render server)

.PARAMETER Transport
    Transport protocol to test (default: streamable-http)
    Options: streamable-http

.PARAMETER Host
    Host to test against (default: n8n-mcp-server-j042.onrender.com for deployed, localhost for local)

.PARAMETER Port
    Port to test against (default: 443 for deployed, 3000 for local)

.EXAMPLE
    .\test-mcp-updated.ps1
    Test deployed server with streamable HTTP

.EXAMPLE
    .\test-mcp-updated.ps1 -Local
    Test local server with streamable HTTP

.EXAMPLE
    .\test-mcp-updated.ps1 -Local -Port 8080
    Test local server on port 8080
#>

param(
    [switch]$Local = $false,
    [ValidateSet("streamable-http")]
    [string]$Transport = "streamable-http",
    [string]$Host = "",
    [int]$Port = 0
)

# Color functions
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "ℹ️ $Message" -ForegroundColor Blue }
function Write-Warning { param($Message) Write-Host "⚠️ $Message" -ForegroundColor Yellow }

# Configuration
$n8nBaseUrl = "https://n8n.boris-spiegl.workers.dev/api/v1"
$n8nApiKey = "tGhOC7BxdXn3a0LbVLOpjZe06oTJuKQ8pI4lYRz6n8c"

# Determine host and port
if ($Local) {
    $Host = if ($Host) { $Host } else { "localhost" }
    $Port = if ($Port -ne 0) { $Port } else { 3000 }
    $Protocol = "http"
} else {
    $Host = if ($Host) { $Host } else { "n8n-mcp-server-j042.onrender.com" }
    $Port = if ($Port -ne 0) { $Port } else { 443 }
    $Protocol = "https"
}

$baseUrl = "${Protocol}://${Host}:${Port}"
if ($Port -eq 443 -or $Port -eq 80) {
    $baseUrl = "${Protocol}://${Host}"
}

Write-Info "🧪 Testing n8n MCP Server (MCP 2025-03-26 Specification)"
Write-Info "📋 Server: $baseUrl"
Write-Info "🚀 Transport: $Transport"
Write-Info "🌐 n8n API: $n8nBaseUrl"

# Test 1: Health Check
Write-Info "`n🩺 Test 1: Health Check"
try {
    $healthResponse = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -ContentType "application/json"
    if ($healthResponse.status -eq "ok") {
        Write-Success "Health check passed"
        Write-Info "   Service: $($healthResponse.service)"
        Write-Info "   Version: $($healthResponse.version)"
        Write-Info "   Protocol: $($healthResponse.protocol)"
        Write-Info "   Transport: $($healthResponse.transport)"
    } else {
        Write-Error "Health check failed: $($healthResponse | ConvertTo-Json)"
        exit 1
    }
} catch {
    Write-Error "Health check failed: $($_.Exception.Message)"
    exit 1
}

# Test 2: Root endpoint information
Write-Info "`n📄 Test 2: Root Endpoint Information"
try {
    $rootResponse = Invoke-RestMethod -Uri "$baseUrl/" -Method GET -ContentType "application/json"
    Write-Success "Root endpoint accessible"
    Write-Info "   Service: $($rootResponse.service)"
    Write-Info "   Protocol: $($rootResponse.protocol)"
    Write-Info "   Transport: $($rootResponse.transport)"
    Write-Info "   Available endpoints: $($rootResponse.endpoints | ConvertTo-Json -Compress)"
} catch {
    Write-Error "Root endpoint failed: $($_.Exception.Message)"
}

# Test 3: SSE Deprecation Check
Write-Info "`n🚫 Test 3: SSE Deprecation Check"
try {
    $sseResponse = Invoke-RestMethod -Uri "$baseUrl/mcp/sse" -Method GET -ContentType "application/json" -ErrorAction Stop
    Write-Error "SSE endpoint should return deprecation error"
} catch {
    if ($_.Exception.Response.StatusCode -eq 410) {
        Write-Success "SSE endpoint correctly returns 410 Gone (deprecated)"
    } else {
        Write-Warning "SSE endpoint returned unexpected status: $($_.Exception.Response.StatusCode)"
    }
}

# Test 4: MCP Initialize Request (Streamable HTTP)
Write-Info "`n🤝 Test 4: MCP Initialize Request"
$initializeRequest = @{
    jsonrpc = "2.0"
    id = 1
    method = "initialize"
    params = @{
        protocolVersion = "2025-03-26"
        capabilities = @{
            roots = @{
                listChanged = $true
            }
            sampling = @{}
        }
        clientInfo = @{
            name = "test-client"
            version = "1.0.0"
        }
    }
} | ConvertTo-Json -Depth 10

$queryParams = "n8n.baseUrl=$([System.Web.HttpUtility]::UrlEncode($n8nBaseUrl))&n8n.apiKey=$([System.Web.HttpUtility]::UrlEncode($n8nApiKey))"

try {
    $initResponse = Invoke-RestMethod -Uri "$baseUrl/mcp?$queryParams" -Method POST -Body $initializeRequest -ContentType "application/json"
    if ($initResponse.result) {
        Write-Success "MCP initialization successful"
        Write-Info "   Protocol Version: $($initResponse.result.protocolVersion)"
        Write-Info "   Server Name: $($initResponse.result.serverInfo.name)"
        Write-Info "   Server Version: $($initResponse.result.serverInfo.version)"
        Write-Info "   Capabilities: $($initResponse.result.capabilities | ConvertTo-Json -Compress)"
    } else {
        Write-Error "MCP initialization failed: $($initResponse | ConvertTo-Json)"
        if ($Local) {
            Write-Warning "Make sure local server is running with: npm start"
        }
        exit 1
    }
} catch {
    Write-Error "MCP initialization failed: $($_.Exception.Message)"
    if ($Local) {
        Write-Warning "Make sure local server is running with: npm start"
    }
    exit 1
}

# Test 5: List Tools
Write-Info "`n🔧 Test 5: List Tools"
$listToolsRequest = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/list"
    params = @{}
} | ConvertTo-Json -Depth 10

try {
    $toolsResponse = Invoke-RestMethod -Uri "$baseUrl/mcp?$queryParams" -Method POST -Body $listToolsRequest -ContentType "application/json"
    if ($toolsResponse.result -and $toolsResponse.result.tools) {
        Write-Success "Tools list retrieved successfully"
        Write-Info "   Available tools: $($toolsResponse.result.tools.Count)"
        foreach ($tool in $toolsResponse.result.tools) {
            Write-Info "   - $($tool.name): $($tool.description)"
        }
    } else {
        Write-Error "Failed to list tools: $($toolsResponse | ConvertTo-Json)"
    }
} catch {
    Write-Error "Tools list failed: $($_.Exception.Message)"
}

# Test 6: Call a Tool (list_workflows)
Write-Info "`n⚙️ Test 6: Call Tool (list_workflows)"
$callToolRequest = @{
    jsonrpc = "2.0"
    id = 3
    method = "tools/call"
    params = @{
        name = "list_workflows"
        arguments = @{}
    }
} | ConvertTo-Json -Depth 10

try {
    $toolCallResponse = Invoke-RestMethod -Uri "$baseUrl/mcp?$queryParams" -Method POST -Body $callToolRequest -ContentType "application/json"
    if ($toolCallResponse.result) {
        Write-Success "Tool call successful"
        Write-Info "   Tool: list_workflows"
        Write-Info "   Response type: $($toolCallResponse.result.content[0].type)"
        $responseText = $toolCallResponse.result.content[0].text
        if ($responseText.Length -gt 200) {
            Write-Info "   Response: $($responseText.Substring(0, 200))..."
        } else {
            Write-Info "   Response: $responseText"
        }
    } else {
        Write-Error "Tool call failed: $($toolCallResponse | ConvertTo-Json)"
    }
} catch {
    Write-Error "Tool call failed: $($_.Exception.Message)"
}

# Test 7: Invalid Method Test
Write-Info "`n🚫 Test 7: Invalid Method Test"
$invalidRequest = @{
    jsonrpc = "2.0"
    id = 4
    method = "invalid/method"
    params = @{}
} | ConvertTo-Json -Depth 10

try {
    $invalidResponse = Invoke-RestMethod -Uri "$baseUrl/mcp?$queryParams" -Method POST -Body $invalidRequest -ContentType "application/json"
    if ($invalidResponse.error -and $invalidResponse.error.code -eq -32601) {
        Write-Success "Invalid method correctly rejected with -32601 error"
    } else {
        Write-Warning "Invalid method response unexpected: $($invalidResponse | ConvertTo-Json)"
    }
} catch {
    Write-Warning "Invalid method test failed: $($_.Exception.Message)"
}

# Test 8: Missing Configuration Test
Write-Info "`n🚫 Test 8: Missing Configuration Test"
$missingConfigRequest = @{
    jsonrpc = "2.0"
    id = 5
    method = "initialize"
    params = @{
        protocolVersion = "2025-03-26"
        capabilities = @{}
        clientInfo = @{
            name = "test-client"
            version = "1.0.0"
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $missingConfigResponse = Invoke-RestMethod -Uri "$baseUrl/mcp" -Method POST -Body $missingConfigRequest -ContentType "application/json" -ErrorAction Stop
    Write-Warning "Missing configuration should return error"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Success "Missing configuration correctly rejected with 400 error"
    } else {
        Write-Warning "Missing configuration returned unexpected status: $($_.Exception.Response.StatusCode)"
    }
}

# Test 9: Test MCP Inspector Connection
Write-Info "`n🔍 Test 9: MCP Inspector Compatibility Test"
Write-Info "To test with MCP Inspector, run:"
Write-Info "   npx @modelcontextprotocol/inspector `"$baseUrl/mcp?$queryParams`""
Write-Info ""
Write-Info "Example MCP client configuration:"
$clientConfig = @{
    mcpServers = @{
        "n8n-server" = @{
            type = "streamable-http"
            url = "$baseUrl/mcp?$queryParams"
        }
    }
} | ConvertTo-Json -Depth 10

Write-Info $clientConfig

Write-Success "`n🎉 All tests completed!"
Write-Info "`n📚 Next Steps:"
Write-Info "1. Test with MCP Inspector: npx @modelcontextprotocol/inspector `"$baseUrl/mcp?$queryParams`""
Write-Info "2. Use in Claude Desktop or other MCP clients"
Write-Info "3. Refer to MCP documentation: https://modelcontextprotocol.io"
Write-Info ""
Write-Warning "⚠️ Note: SSE transport is deprecated. Use streamable-http transport for new integrations." 
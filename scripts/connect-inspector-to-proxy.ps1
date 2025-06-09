# Connect MCP Inspector to local MCP Proxy
# This connects to the local proxy running the n8n MCP server

param(
    [string]$ProxyPort = "8080",
    [string]$ProxyHost = "127.0.0.1",
    [string]$Transport = "sse",
    [string]$InspectorPort = "8276"
)

Write-Host "Connecting MCP Inspector to local proxy..." -ForegroundColor Green

# Set inspector port
$env:CLIENT_PORT = $InspectorPort

# Build the proxy URL based on transport
if ($Transport -eq "sse") {
    $proxyUrl = "http://$ProxyHost`:$ProxyPort/sse"
    Write-Host "Using SSE transport: $proxyUrl" -ForegroundColor Cyan
} elseif ($Transport -eq "streamablehttp") {
    $proxyUrl = "http://$ProxyHost`:$ProxyPort/mcp"
    Write-Host "Using StreamableHTTP transport: $proxyUrl" -ForegroundColor Cyan
} else {
    Write-Host "Invalid transport: $Transport. Use 'sse' or 'streamablehttp'" -ForegroundColor Red
    exit 1
}

Write-Host "Inspector will be available at: http://localhost:$InspectorPort" -ForegroundColor Yellow

try {
    Write-Host "`nStarting MCP Inspector..." -ForegroundColor Yellow
    
    if ($Transport -eq "sse") {
        # For SSE, just pass the URL
        & npx @modelcontextprotocol/inspector $proxyUrl
    } else {
        # For StreamableHTTP, specify the transport
        & npx @modelcontextprotocol/inspector --transport streamablehttp $proxyUrl
    }
}
catch {
    Write-Host "Error starting MCP Inspector: $_" -ForegroundColor Red
    Write-Host "Make sure the proxy is running first with: scripts/start-mcp-proxy.ps1" -ForegroundColor Yellow
} 
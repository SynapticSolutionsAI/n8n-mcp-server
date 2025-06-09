# Connect MCP Inspector directly to deployed Cloudflare Worker
# This bypasses local proxy issues and connects directly to the working deployment

param(
    [int]$InspectorPort = 8276
)

Write-Host "Connecting MCP Inspector directly to deployed server..." -ForegroundColor Green
Write-Host "Deployed Server: https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse" -ForegroundColor Cyan
Write-Host "API Key: mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s" -ForegroundColor Yellow

# Find an available port for the inspector
$portFound = $false
$portToTry = $InspectorPort
$maxAttempts = 10

for ($i = 0; $i -lt $maxAttempts; $i++) {
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect("127.0.0.1", $portToTry)
        $tcpClient.Close()
        # Port is in use, try next one
        $portToTry++
    } catch {
        # Port is available
        $portFound = $true
        break
    }
}

if (-not $portFound) {
    Write-Host "❌ Could not find an available port after trying $maxAttempts ports starting from $InspectorPort" -ForegroundColor Red
    exit 1
}

Write-Host "Using port $portToTry for Inspector..." -ForegroundColor Gray
Write-Host "Inspector will be available at: http://localhost:$portToTry" -ForegroundColor Green
Write-Host ""

# First, test the connection to the deployed server
Write-Host "Testing connection to deployed server..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/health" -Method GET -TimeoutSec 10
    Write-Host "✅ Server is reachable: $response" -ForegroundColor Green
} catch {
    Write-Host "❌ Server connection failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please check your internet connection and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Starting MCP Inspector..." -ForegroundColor Yellow

# Set environment variable for custom port
$env:PORT = $portToTry.ToString()

# Start the inspector with direct connection to deployed server  
try {
    npx @modelcontextprotocol/inspector "https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s"
} catch {
    Write-Host "❌ Failed to start MCP Inspector: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Try running manually with a different port:" -ForegroundColor Yellow
    Write-Host "PORT=$($portToTry + 1) npx @modelcontextprotocol/inspector `"https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s`"" -ForegroundColor Gray
} 
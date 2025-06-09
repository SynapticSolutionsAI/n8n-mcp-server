$mcpApiKey = "mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s"

$body = '{"jsonrpc":"2.0","method":"tools/list","id":1}'
$url = "https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=$mcpApiKey"

Write-Host "Testing deployed MCP proxy..."
Write-Host "URL: $url"
Write-Host "Body: $body"

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -ContentType "application/json" -Body $body
    Write-Host "Success!"
    if ($response.result -and $response.result.tools) {
        Write-Host "Found $($response.result.tools.Count) tools:"
        foreach ($tool in $response.result.tools) {
            Write-Host "  - $($tool.name): $($tool.description)"
        }
    } else {
        Write-Host "Response:"
        $response | ConvertTo-Json -Depth 5
    }
}
catch {
    Write-Host "Error: $_"
}

# Also test the SSE endpoint for connection
Write-Host ""
Write-Host "Testing SSE connection endpoint..."
$sseUrl = "https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=$mcpApiKey"
try {
    $sseResponse = Invoke-RestMethod -Uri $sseUrl -Method GET
    Write-Host "SSE endpoint response:"
    Write-Host $sseResponse
}
catch {
    Write-Host "SSE Error: $_"
} 
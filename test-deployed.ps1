$env:N8N_API_URL = "https://n8n.boris-spiegl.workers.dev/api/v1"
$env:N8N_API_KEY = "tGhOC7BxdXn3a0LbVLOpjZe06oTJuKQ8pI4lYRz6n8c"

$body = '{"jsonrpc":"2.0","method":"tools/list","id":1}'
$url = "https://n8n-mcp-server.boris-spiegl.workers.dev/mcp?n8nApiUrl=$env:N8N_API_URL&n8nApiKey=$env:N8N_API_KEY"

Write-Host "Testing deployed MCP endpoint..."
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
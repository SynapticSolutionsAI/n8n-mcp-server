$env:N8N_API_URL = "https://n8n.boris-spiegl.workers.dev/api/v1"
$env:N8N_API_KEY = "tGhOC7BxdXn3a0LbVLOpjZe06oTJuKQ8pI4lYRz6n8c"

$body = '{"jsonrpc":"2.0","method":"tools/list","id":1}'
$url = "http://localhost:3000/mcp?n8nApiUrl=$env:N8N_API_URL&n8nApiKey=$env:N8N_API_KEY"

Write-Host "Testing MCP endpoint..."
Write-Host "URL: $url"
Write-Host "Body: $body"

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -ContentType "application/json" -Body $body
    Write-Host "Success!"
    $response | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "Error: $_"
} 
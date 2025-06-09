# MCP Proxy Connection Script - Connect to Deployed Worker
# This script connects local tools to the deployed Cloudflare Worker MCP proxy

Write-Host "Connecting to deployed MCP Proxy on Cloudflare Worker..." -ForegroundColor Green
Write-Host "Deployed MCP Server: https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev" -ForegroundColor Cyan
Write-Host "API Key: mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s" -ForegroundColor Yellow
Write-Host ""
Write-Host "Available endpoints:" -ForegroundColor White
Write-Host "  - SSE: https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s" -ForegroundColor Gray
Write-Host "  - HTTP: https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp" -ForegroundColor Gray
Write-Host ""
Write-Host "Testing connection..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/health" -Method GET
    Write-Host "✅ Connection successful: $response" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Use one of these commands to connect tools:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. MCP Inspector:" -ForegroundColor White
    Write-Host "   npx @modelcontextprotocol/inspector `"https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Claude Desktop (add to config):" -ForegroundColor White
    Write-Host "   {" -ForegroundColor Gray
    Write-Host "     `"mcpServers`": {" -ForegroundColor Gray  
    Write-Host "       `"n8n`": {" -ForegroundColor Gray
    Write-Host "         `"command`": `"npx`"," -ForegroundColor Gray
    Write-Host "         `"args`": [`"@modelcontextprotocol/server-everything`", `"https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s`"]" -ForegroundColor Gray
    Write-Host "       }" -ForegroundColor Gray
    Write-Host "     }" -ForegroundColor Gray
    Write-Host "   }" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "❌ Connection failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please check your internet connection and try again." -ForegroundColor Yellow
} 
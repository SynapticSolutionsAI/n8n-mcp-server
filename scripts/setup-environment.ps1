# Environment Setup Script for n8n MCP Server
# This script sets up the required environment variables

Write-Host "Setting up environment variables for n8n MCP Server..." -ForegroundColor Green

# Set n8n API configuration
$env:N8N_API_URL = "https://n8n.boris-spiegl.workers.dev/api/v1"
$env:N8N_API_KEY = "tGhOC7BxdXn3a0LbVLOpjZe06oTJuKQ8pI4lYRz6n8c"

# Set proxy and inspector ports
$env:PROXY_PORT = "8080"
$env:INSPECTOR_PORT = "8276"
$env:HTTP_SERVER_PORT = "3000"

Write-Host "Environment variables set:" -ForegroundColor Cyan
Write-Host "  N8N_API_URL: $env:N8N_API_URL" -ForegroundColor Gray
Write-Host "  N8N_API_KEY: $($env:N8N_API_KEY.Substring(0,10))..." -ForegroundColor Gray
Write-Host "  PROXY_PORT: $env:PROXY_PORT" -ForegroundColor Gray
Write-Host "  INSPECTOR_PORT: $env:INSPECTOR_PORT" -ForegroundColor Gray
Write-Host "  HTTP_SERVER_PORT: $env:HTTP_SERVER_PORT" -ForegroundColor Gray

Write-Host "`nEnvironment setup complete!" -ForegroundColor Green 
# Deploy n8n MCP Server to Railway.app
# This script deploys the MCP server to Railway for better MCP Inspector compatibility

Write-Host "🚂 Deploying n8n MCP Server to Railway.app..." -ForegroundColor Green
Write-Host ""

# Check if Railway CLI is installed
$railwayInstalled = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayInstalled) {
    Write-Host "❌ Railway CLI not found. Installing..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please install Railway CLI by running:" -ForegroundColor White
    Write-Host "npm install -g @railway/cli" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or visit: https://docs.railway.app/deploy/cli" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# Check if user is logged in
Write-Host "🔐 Checking Railway authentication..." -ForegroundColor Yellow
$loginStatus = railway status 2>&1
if ($loginStatus -match "not logged in|authentication") {
    Write-Host "❌ Not logged in to Railway. Please run:" -ForegroundColor Red
    Write-Host "railway login" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Railway CLI authenticated" -ForegroundColor Green
Write-Host ""

# Build the project
Write-Host "🔨 Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful" -ForegroundColor Green
Write-Host ""

# Deploy to Railway
Write-Host "🚀 Deploying to Railway..." -ForegroundColor Yellow
railway deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Successfully deployed to Railway!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Getting deployment URL..." -ForegroundColor Yellow
    $domain = railway domain
    
    if ($domain) {
        Write-Host ""
        Write-Host "📡 Your MCP server is now live at:" -ForegroundColor Green
        Write-Host "https://$domain" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "🔧 MCP endpoints:" -ForegroundColor White
        Write-Host "  • Health check: https://$domain/health" -ForegroundColor Gray
        Write-Host "  • MCP endpoint: https://$domain/mcp" -ForegroundColor Gray
        Write-Host ""
        Write-Host "🧪 Test with MCP Inspector:" -ForegroundColor White
        Write-Host "npx @modelcontextprotocol/inspector https://$domain/mcp" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "📋 Claude Desktop config:" -ForegroundColor White
        Write-Host '{' -ForegroundColor Gray
        Write-Host '  "mcpServers": {' -ForegroundColor Gray
        Write-Host '    "n8n": {' -ForegroundColor Gray
        Write-Host '      "command": "npx",' -ForegroundColor Gray
        Write-Host '      "args": ["mcp-remote", "https://'$domain'/mcp"]' -ForegroundColor Gray
        Write-Host '    }' -ForegroundColor Gray
        Write-Host '  }' -ForegroundColor Gray
        Write-Host '}' -ForegroundColor Gray
    } else {
        Write-Host "⚠️ Could not retrieve domain. Check Railway dashboard." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Check the logs above for details." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔗 Useful commands:" -ForegroundColor White
Write-Host "  • railway logs     - View deployment logs" -ForegroundColor Gray
Write-Host "  • railway status   - Check service status" -ForegroundColor Gray
Write-Host "  • railway domain   - Get deployment URL" -ForegroundColor Gray
Write-Host "  • railway delete   - Delete the deployment" -ForegroundColor Gray 
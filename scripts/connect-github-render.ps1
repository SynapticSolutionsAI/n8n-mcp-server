# Connect GitHub Repository to Render.com for Deployment
# This script guides you through connecting your GitHub repo to Render

Write-Host "🔗 Connecting GitHub Repository to Render.com" -ForegroundColor Green
Write-Host ""
Write-Host "Follow these steps to deploy your MCP server to Render.com:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1️⃣ Push your code to GitHub:" -ForegroundColor White
Write-Host "   git add ." -ForegroundColor Gray
Write-Host "   git commit -m 'Deploy to Render'" -ForegroundColor Gray
Write-Host "   git push origin main" -ForegroundColor Gray
Write-Host ""

Write-Host "2️⃣ Go to Render.com and create a new Web Service:" -ForegroundColor White
Write-Host "   • Visit: https://dashboard.render.com/select-repo?type=web" -ForegroundColor Cyan
Write-Host "   • Connect your GitHub account" -ForegroundColor Gray
Write-Host "   • Select this repository: n8n-mcp-server" -ForegroundColor Gray
Write-Host ""

Write-Host "3️⃣ Use these deployment settings:" -ForegroundColor White
Write-Host "   Runtime: Node" -ForegroundColor Gray
Write-Host "   Build Command: npm install; npm run build" -ForegroundColor Gray
Write-Host "   Start Command: npm start" -ForegroundColor Gray
Write-Host "   Auto Deploy: Yes" -ForegroundColor Gray
Write-Host ""

Write-Host "4️⃣ Set environment variables (optional):" -ForegroundColor White
Write-Host "   N8N_BASE_URL=https://n8n.boris-spiegl.workers.dev/api/v1" -ForegroundColor Gray
Write-Host "   N8N_API_KEY=tGhOC7BxdXn3a0LbVLOpjZe06oTJuKQ8pI4lYRz6n8c" -ForegroundColor Gray
Write-Host "   NODE_ENV=production" -ForegroundColor Gray
Write-Host ""

Write-Host "5️⃣ Your MCP server will be available at:" -ForegroundColor White
Write-Host "   https://your-app-name.onrender.com/mcp" -ForegroundColor Cyan
Write-Host ""

Write-Host "🧪 Test with MCP Inspector:" -ForegroundColor Green
Write-Host "   npx @modelcontextprotocol/inspector https://your-app-name.onrender.com/mcp" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Claude Desktop config:" -ForegroundColor Green
Write-Host '{' -ForegroundColor Gray
Write-Host '  "mcpServers": {' -ForegroundColor Gray
Write-Host '    "n8n": {' -ForegroundColor Gray
Write-Host '      "command": "npx",' -ForegroundColor Gray
Write-Host '      "args": ["mcp-remote", "https://your-app-name.onrender.com/mcp"]' -ForegroundColor Gray
Write-Host '    }' -ForegroundColor Gray
Write-Host '  }' -ForegroundColor Gray
Write-Host '}' -ForegroundColor Gray
Write-Host ""

Write-Host "⚠️  Remember to replace 'your-app-name' with your actual Render app name!" -ForegroundColor Yellow 
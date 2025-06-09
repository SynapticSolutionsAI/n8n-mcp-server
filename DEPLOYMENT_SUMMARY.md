# n8n MCP Server - Deployment Summary

## ✅ WORKING DEPLOYMENT STATUS

**Primary MCP Server (with built-in proxy):** `https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev`
- **Status:** ✅ FULLY OPERATIONAL
- **API Key:** `mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s`
- **Tools Available:** 11 (all working)

## 🔧 MCP PROXY ARCHITECTURE

**YES, we ARE using MCP proxy - but it's deployed on the same Cloudflare Worker!**

The current setup uses a **built-in MCP proxy** deployed on Cloudflare Workers that:
- ✅ Handles both SSE and streamable-http transports
- ✅ Converts between different MCP transport protocols
- ✅ Provides CORS support for web clients
- ✅ No stdio dependencies (avoids connection issues)
- ✅ Deployed on the same worker as the n8n server for optimal performance

**Architecture:**
```
Client (Inspector/Claude) 
    ↓ (SSE/HTTP)
Cloudflare Worker (n8n-mcp-proxy-fixed)
    ├── MCP Proxy Logic (built-in)
    └── n8n MCP Server Logic
        ↓ (HTTPS API)
    n8n Instance (n8n.boris-spiegl.workers.dev)
```

## 🚀 QUICK START

### 1. Connect MCP Inspector (Recommended)
```bash
npm run inspector
```
or manually:
```bash
npx @modelcontextprotocol/inspector "https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s"
```

### 2. Claude Desktop Configuration
Add to your Claude Desktop config file:
```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-everything", "https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s"]
    }
  }
}
```

### 3. Direct API Testing
```bash
curl -X GET "https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/health"
```

## 📋 AVAILABLE ENDPOINTS

| Endpoint | Transport | Purpose |
|----------|-----------|---------|
| `/mcp/sse` | SSE | Primary MCP connection (with API key) |
| `/mcp` | HTTP | Alternative streamable-http transport |
| `/health` | HTTP | Health check endpoint |

## 🔑 AUTHENTICATION

**API Key:** `mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s`

**Methods:**
- Query parameter: `?apiKey=mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s`
- Header: `X-API-Key: mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s`
- Header: `Authorization: Bearer mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s`

## 🛠️ AVAILABLE TOOLS

1. **list_workflows** - List all n8n workflows
2. **get_workflow** - Get specific workflow details
3. **create_workflow** - Create new workflow
4. **update_workflow** - Update existing workflow
5. **delete_workflow** - Delete workflow
6. **activate_workflow** - Activate workflow
7. **deactivate_workflow** - Deactivate workflow
8. **list_executions** - List workflow executions
9. **get_execution** - Get execution details
10. **delete_execution** - Delete execution
11. **run_webhook** - Execute workflow via webhook

## ❌ DISCONTINUED: Local Python Proxy

**Why we stopped using local Python mcp-proxy:**
- ❌ Required stdio transport (connection issues)
- ❌ Port conflicts with MCP Inspector
- ❌ Complex multi-process setup
- ❌ Authentication issues
- ❌ URL duplication problems

**What we're using instead:**
- ✅ Built-in MCP proxy on Cloudflare Worker
- ✅ Direct SSE/HTTP transport support
- ✅ Single deployment, no local dependencies
- ✅ Reliable authentication and CORS

## 🔧 DEVELOPMENT COMMANDS

```bash
# Check connection to deployed server
npm run connect

# Start MCP Inspector (connects to deployed server)
npm run inspector

# Test deployment
npm run test:deploy

# Deploy updates to Cloudflare
npm run deploy:mcp-proxy-fixed
```

## 📝 NOTES

- **Local development:** No need to run local proxy - connect directly to deployed server
- **MCP Inspector:** Automatically finds available ports if default is in use
- **Claude Integration:** Use the SSE endpoint for best compatibility
- **Port conflicts:** Scripts automatically handle port conflicts
- **Updates:** Deploy changes with `npm run deploy:mcp-proxy-fixed`

**Last Updated:** December 9, 2024
**Status:** Production Ready ✅ 
# Render.com Environment Variables for n8n MCP Server

## Required Environment Variables

Set these in your Render Web Service settings:

### **1. n8n Configuration**
```
N8N_BASE_URL=https://n8n.boris-spiegl.workers.dev/api/v1
N8N_API_KEY=tGhOC7BxdXn3a0LbVLOpjZe06oTJuKQ8pI4lYRz6n8c
```

### **2. Runtime Configuration**
```
NODE_ENV=production
PORT=10000
```
*Note: Render automatically sets PORT, but 10000 is the default*

### **3. MCP Configuration (Optional)**
```
MCP_SERVER_NAME=n8n-mcp-server
MCP_SERVER_VERSION=0.1.3
```

## How to Set Environment Variables in Render

1. **Go to your Render service dashboard**
2. **Click on "Environment" tab**
3. **Add each variable:**
   - **Key**: `N8N_BASE_URL`
   - **Value**: `https://n8n.boris-spiegl.workers.dev/api/v1`
   
   - **Key**: `N8N_API_KEY`  
   - **Value**: `tGhOC7BxdXn3a0LbVLOpjZe06oTJuKQ8pI4lYRz6n8c`
   
   - **Key**: `NODE_ENV`
   - **Value**: `production`

4. **Click "Save Changes"**
5. **Redeploy your service**

## Alternative: Using .env File (Not Recommended for Production)

You can also create a `.env` file in your project root:

```env
N8N_BASE_URL=https://n8n.boris-spiegl.workers.dev/api/v1
N8N_API_KEY=tGhOC7BxdXn3a0LbVLOpjZe06oTJuKQ8pI4lYRz6n8c
NODE_ENV=production
```

**⚠️ Important**: Don't commit `.env` files to GitHub for security reasons!

## Testing Your Environment Variables

Your deployed MCP server should:
- ✅ Connect to the n8n API successfully
- ✅ Return 11 available tools
- ✅ Handle health checks at `/health`
- ✅ Respond to MCP requests at `/mcp`

## Common Issues

1. **Invalid API Key**: Check that `N8N_API_KEY` is correct
2. **Wrong Base URL**: Verify `N8N_BASE_URL` points to your n8n instance
3. **Port Issues**: Render handles ports automatically, don't override `PORT` unless needed 
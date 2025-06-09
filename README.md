# n8n MCP Server

[![npm version](https://badge.fury.io/js/%40leonardsellem%2Fn8n-mcp-server.svg)](https://badge.fury.io/js/%40leonardsellem%2Fn8n-mcp-server)

A Model Context Protocol (MCP) server that provides AI assistants with access to n8n workflow management capabilities.

## 🚀 Quick Start

### Using the Deployed Server (Recommended)

The easiest way to use the n8n MCP Server is through our deployed Cloudflare Workers instance:

**MCP Inspector URL:**
```
https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s
```

**Direct API URL:**
```
https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse
```

### Available Tools

The server provides 11 tools for n8n workflow management:

1. **list_workflows** - Retrieve a list of all workflows
2. **get_workflow** - Get a specific workflow by ID
3. **create_workflow** - Create a new workflow
4. **update_workflow** - Update an existing workflow
5. **delete_workflow** - Delete a workflow
6. **activate_workflow** - Activate a workflow
7. **deactivate_workflow** - Deactivate a workflow
8. **list_executions** - List workflow executions
9. **get_execution** - Get execution details
10. **delete_execution** - Delete an execution
11. **run_webhook** - Execute a workflow via webhook

## 🔧 Local Development

### Prerequisites

- Node.js 18+
- npm
- PowerShell (for Windows scripts)

### Setup

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd n8n-mcp-server
   npm install
   ```

2. **Set environment variables:**
   ```bash
   npm run setup-env
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

### Running Locally

#### Option 1: Full Stack (HTTP Server + Proxy + Inspector)
```bash
npm run start:full
```

#### Option 2: Individual Components
```bash
# Start HTTP server
npm run start:http

# Start proxy (in another terminal)
npm run start:proxy

# Start MCP Inspector (in another terminal)
npm run inspector
```

### Testing

```bash
# Test the deployed version
npm run test:deploy

# Test local HTTP server
npm run test:mcp

# Test with coverage
npm run test:coverage
```

## 🌐 Deployment

### Cloudflare Workers

The project includes multiple deployment targets:

```bash
# Deploy main HTTP server
npm run deploy

# Deploy MCP proxy with SSE support
npm run deploy:mcp-proxy-fixed

# Deploy SSE bridge
npm run deploy:sse-bridge
```

### Environment Variables

For deployment, set these environment variables:

- `N8N_BASE_URL` - Your n8n instance URL
- `N8N_API_KEY` - Your n8n API key
- `MCP_API_KEY` - API key for MCP access

## 📡 API Usage

### Streamable HTTP

Send JSON-RPC requests to the `/mcp` endpoint:

```javascript
const response = await fetch('https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=YOUR_API_KEY', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  })
});
```

### Server-Sent Events (SSE)

Connect to the SSE endpoint for real-time communication:

```javascript
const eventSource = new EventSource('https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev/mcp/sse?apiKey=YOUR_API_KEY');
```

## 🛠 Architecture

The project uses a vertical slice architecture with the following structure:

```
src/
├── api/           # n8n API client
├── config/        # Configuration and environment
├── tools/         # MCP tool implementations
│   ├── workflow/  # Workflow management tools
│   └── execution/ # Execution management tools
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
└── workers/       # Cloudflare Workers implementations
```

## 🔐 Authentication

The server supports multiple authentication methods:

1. **Query Parameter:** `?apiKey=your-key`
2. **Header:** `Authorization: Bearer your-key`
3. **Header:** `X-API-Key: your-key`

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build the TypeScript project |
| `npm run start` | Start the HTTP server |
| `npm run start:http` | Start HTTP server with environment setup |
| `npm run start:proxy` | Start MCP proxy |
| `npm run start:full` | Start full stack (HTTP + Proxy + Inspector) |
| `npm run dev` | Start development mode with watch |
| `npm run test` | Run tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run inspector` | Start MCP Inspector |
| `npm run deploy` | Deploy to Cloudflare Workers |

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts:** Use different ports with environment variables
2. **Authentication errors:** Verify API keys are correct
3. **Connection issues:** Check firewall and network settings

### Debug Mode

Enable debug logging:
```bash
export DEBUG=true
npm run start
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

- GitHub Issues: [Report bugs and request features]
- Documentation: [Additional docs in /docs folder]

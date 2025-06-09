/**
 * n8n MCP Server - Streamable HTTP Entry Point
 * 
 * This file serves as the streamable HTTP entry point for the n8n MCP Server,
 * which allows AI assistants to interact with n8n workflows through the MCP protocol.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadEnvironmentVariables } from './config/environment.js';
import { configureServer } from './config/server.js';
import { parseDotNotation } from './utils/config.js';
import { N8nApiConfig } from './types/index.js';

// Load environment variables from .env file
loadEnvironmentVariables();

const app = express();

// Enable CORS for all origins (required for MCP Inspector and cross-origin requests)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'n8n-mcp-server' });
});

// MCP endpoint - this is the main endpoint that handles all MCP communication
app.all('/mcp', async (req: Request, res: Response) => {
  try {
    // Get configuration from query parameters
    const config = parseDotNotation(req.query);
    
    // Create and configure the MCP server
    const server = await configureServer(config as N8nApiConfig);
    
    // Create streamable HTTP transport with proper options
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    
    // Set up cleanup when connection closes
    res.on('close', () => {
      transport.close();
      server.close();
    });

    // Connect server to transport
    await server.connect(transport);
    
    // Handle the HTTP request through the transport
    await transport.handleRequest(req, res, req.body);
    
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : 'Unknown error'
        },
        id: null,
      });
    }
  }
});

// Catch-all for MCP-related paths
app.all('/mcp/*', (req: Request, res: Response) => {
  res.status(404).json({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: 'Method not found',
    },
    id: null,
  });
});

// Root endpoint - minimal response
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ 
    service: 'n8n-mcp-server',
    version: '0.1.3',
    mcp_endpoint: '/mcp'
  });
});

const port = parseInt(process.env.PORT || '3000', 10);

app.listen(port, '0.0.0.0', () => {
  console.log(`n8n MCP Server (streamable-http) listening on port ${port}`);
  console.log(`MCP endpoint available at http://localhost:${port}/mcp`);
  console.log(`Health check available at http://localhost:${port}/health`);
}).on('error', (error: Error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

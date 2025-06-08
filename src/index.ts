/**
 * n8n MCP Server - Main Entry Point
 * 
 * This file serves as the entry point for the n8n MCP Server,
 * which allows AI assistants to interact with n8n workflows through the MCP protocol.
 */

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadEnvironmentVariables } from './config/environment.js';
import { configureServer } from './config/server.js';
import { parseDotNotation } from './utils/config.js';
import { N8nApiConfig } from './types/index.js';

// Load environment variables from .env file
loadEnvironmentVariables();

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'n8n-mcp-server' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'n8n MCP Server', 
    version: '0.1.3',
    endpoints: {
      health: '/health',
      mcp: '/mcp'
    }
  });
});

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

app.all('/mcp', async (req, res) => {
  try {
    const config = parseDotNotation(req.query);
    const server = await configureServer(config as N8nApiConfig);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    res.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

const port = parseInt(process.env.PORT || '3000', 10);

app.listen(port, '0.0.0.0', () => {
  console.log(`n8n MCP Server listening on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/health`);
}).on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

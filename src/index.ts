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

// SSE endpoint for MCP communication - GET request establishes SSE connection
app.get('/mcp/sse', async (req: Request, res: Response) => {
  try {
    // Validate API key or config
    const config = parseDotNotation(req.query);
    if (!config || Object.keys(config).length === 0) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'Invalid params: Missing n8n configuration in query parameters'
        },
        id: null,
      });
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, Mcp-Session-Id',
      'X-Accel-Buffering': 'no'
    });

    const sessionId = crypto.randomUUID();
    res.setHeader('Mcp-Session-Id', sessionId);

    // Send connection event
    res.write(`data: ${JSON.stringify({
      type: "connection",
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    })}\n\n`);

    // Send initialized notification
    res.write(`data: ${JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {}
    })}\n\n`);

    // Keep connection alive with ping
    const keepAlive = setInterval(() => {
      try {
        res.write(`: ping - ${new Date().toISOString()}\n\n`);
      } catch (error) {
        clearInterval(keepAlive);
      }
    }, 30000);

    // Clean up on close
    res.on('close', () => {
      clearInterval(keepAlive);
    });

    // Auto-close after 5 minutes
    setTimeout(() => {
      clearInterval(keepAlive);
      if (!res.headersSent) {
        res.end();
      }
    }, 300000);

  } catch (error) {
    console.error('Error setting up SSE:', error);
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

// SSE endpoint for MCP communication - POST request for message handling
app.post('/mcp/sse', async (req: Request, res: Response) => {
  try {
    // Get configuration from query parameters
    const config = parseDotNotation(req.query);
    
    // Create and configure the MCP server
    const server = await configureServer(config as N8nApiConfig);
    
    // Process the JSON-RPC request
    const jsonRpcRequest = req.body;
    
    // Handle the MCP request directly
    if (jsonRpcRequest.method === 'initialize') {
      // Handle initialize request
      const response = {
        jsonrpc: '2.0',
        id: jsonRpcRequest.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {}
          },
          serverInfo: {
            name: 'n8n-mcp-server',
            version: '0.1.3'
          }
        }
      };
      
      res.setHeader('Mcp-Session-Id', req.headers['mcp-session-id'] || crypto.randomUUID());
      return res.json(response);
    }
    
    // For other requests, use the streamable transport
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
    console.error('Error handling SSE POST request:', error);
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

// MCP endpoint - this is the main endpoint that handles all MCP communication (streamable HTTP)
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

/**
 * n8n MCP Server - Streamable HTTP Entry Point
 * 
 * This file serves as the streamable HTTP entry point for the n8n MCP Server,
 * which allows AI assistants to interact with n8n workflows through the MCP protocol.
 * 
 * Updated to follow MCP specification 2025-03-26 - SSE transport deprecated, 
 * using streamable HTTP as the recommended transport.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'n8n-mcp-server',
    version: '0.1.3',
    protocol: 'MCP 2025-03-26',
    transport: 'streamable-http'
  });
});

/**
 * Main MCP endpoint using streamable HTTP transport (recommended)
 * Handles all MCP protocol communication according to latest specification
 */
app.all('/mcp', async (req: Request, res: Response) => {
  let server: Server | undefined;
  let transport: StreamableHTTPServerTransport | undefined;
  
  try {
    // Get configuration from query parameters or headers
    const config = parseDotNotation(req.query);
    
    // Validate configuration
    if (!config || Object.keys(config).length === 0) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'Invalid params: Missing n8n configuration. Please provide n8n.baseUrl and n8n.apiKey in query parameters.'
        },
        id: null,
      });
    }

    // Create and configure the MCP server
    server = await configureServer(config as N8nApiConfig);
    
    // Create streamable HTTP transport with proper session management
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    
    // Set up cleanup when connection closes
    req.on('close', () => {
      try {
        if (transport) transport.close();
        if (server) server.close();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    });

    res.on('close', () => {
      try {
        if (transport) transport.close();
        if (server) server.close();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    });

    // Connect server to transport
    await server.connect(transport);
    
    // Log the request for debugging
    console.log(`MCP Request: ${req.method} ${req.path} - Config: ${JSON.stringify(Object.keys(config))}`);
    
    // Handle the HTTP request through the transport (this handles all MCP protocol logic)
    await transport.handleRequest(req, res, req.body);
    
  } catch (error) {
    console.error('Error handling MCP request:', error);
    
    // Clean up on error
    try {
      if (transport) transport.close();
      if (server) server.close();
    } catch (cleanupError) {
      console.error('Error during error cleanup:', cleanupError);
    }
    
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
          }
        },
        id: null,
      });
    }
  }
});

/**
 * Legacy SSE endpoint for backward compatibility
 * @deprecated SSE transport is deprecated as of MCP 2025-03-26. Use /mcp endpoint instead.
 */
app.get('/mcp/sse', async (req: Request, res: Response) => {
  console.warn('WARNING: SSE transport is deprecated. Please use streamable HTTP at /mcp endpoint instead.');
  
  res.status(410).json({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: 'SSE transport is deprecated. Please use streamable HTTP transport at /mcp endpoint.',
      data: {
        deprecated: true,
        alternative: '/mcp',
        transport: 'streamable-http',
        specification: 'MCP 2025-03-26'
      }
    },
    id: null,
  });
});

/**
 * Legacy SSE POST endpoint for backward compatibility
 * @deprecated SSE transport is deprecated as of MCP 2025-03-26. Use /mcp endpoint instead.
 */
app.post('/mcp/sse', async (req: Request, res: Response) => {
  console.warn('WARNING: SSE transport is deprecated. Please use streamable HTTP at /mcp endpoint instead.');
  
  res.status(410).json({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: 'SSE transport is deprecated. Please use streamable HTTP transport at /mcp endpoint.',
      data: {
        deprecated: true,
        alternative: '/mcp',
        transport: 'streamable-http',
        specification: 'MCP 2025-03-26'
      }
    },
    id: null,
  });
});

// Handle preflight OPTIONS requests
app.options('/mcp', (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  res.sendStatus(200);
});

// Catch-all for MCP-related paths
app.all('/mcp/*', (req: Request, res: Response) => {
  res.status(404).json({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: `Method not found: ${req.path}. Available endpoints: /mcp (streamable-http)`,
      data: {
        availableEndpoints: ['/mcp', '/health'],
        requestedPath: req.path,
        method: req.method
      }
    },
    id: null,
  });
});

// Root endpoint - API information
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ 
    service: 'n8n-mcp-server',
    version: '0.1.3',
    description: 'Model Context Protocol server for n8n workflow automation',
    protocol: 'MCP 2025-03-26',
    transport: 'streamable-http',
    endpoints: {
      mcp: '/mcp',
      health: '/health'
    },
    documentation: 'https://github.com/leonardsellem/n8n-mcp-server',
    specification: 'https://modelcontextprotocol.io'
  });
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: Function) => {
  console.error('Unhandled error:', error);
  
  if (!res.headersSent) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
        data: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      id: null,
    });
  }
});

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`🚀 n8n MCP Server (streamable-http) listening on ${host}:${port}`);
  console.log(`📋 MCP endpoint: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/mcp`);
  console.log(`❤️  Health check: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/health`);
  console.log(`📖 Specification: MCP 2025-03-26 (streamable-http transport)`);
  console.log(`⚠️  Note: SSE transport is deprecated, use streamable-http instead`);
}).on('error', (error: Error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

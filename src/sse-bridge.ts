/**
 * SSE Bridge for n8n MCP Server
 * 
 * This bridge converts SSE requests to streamable HTTP calls to the main MCP server.
 * This allows backward compatibility with clients that expect SSE transport.
 * 
 * Based on MCP specification 2025-03-26 - SSE transport is deprecated,
 * but this bridge provides compatibility through MCP proxy pattern.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import { parseDotNotation } from './utils/config.js';

const app = express();

// Enable CORS for SSE
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Cache-Control'],
  credentials: false
}));

app.use(express.json());

// The main MCP server URL (streamable HTTP)
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';

/**
 * SSE Bridge endpoint - converts SSE requests to streamable HTTP
 */
app.get('/sse', async (req: Request, res: Response) => {
  console.log('SSE Bridge: New SSE connection request');
  
  try {
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'X-Accel-Buffering': 'no'
    });

    const sessionId = crypto.randomUUID();
    res.setHeader('Mcp-Session-Id', sessionId);

    // Send connection event
    res.write(`data: ${JSON.stringify({
      type: "connection",
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    })}\n\n`);

    // Send SSE deprecation notice
    res.write(`data: ${JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/message",
      params: {
        level: "info",
        data: "SSE transport is deprecated. This bridge converts to streamable HTTP."
      }
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
      console.log('SSE Bridge: Connection closed');
      clearInterval(keepAlive);
    });

    // Auto-close after 5 minutes to prevent resource leaks
    setTimeout(() => {
      clearInterval(keepAlive);
      if (!res.headersSent) {
        res.end();
      }
    }, 300000);

  } catch (error) {
    console.error('SSE Bridge: Error setting up SSE connection:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'SSE Bridge error',
          data: error instanceof Error ? error.message : 'Unknown error'
        },
        id: null,
      });
    }
  }
});

/**
 * SSE Bridge POST endpoint - proxies messages to streamable HTTP server
 */
app.post('/sse', async (req: Request, res: Response) => {
  console.log('SSE Bridge: Proxying message to streamable HTTP server');
  
  try {
    // Get the query parameters and forward them
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    const targetUrl = queryString ? `${MCP_SERVER_URL}?${queryString}` : MCP_SERVER_URL;
    
    console.log(`SSE Bridge: Forwarding to ${targetUrl}`);
    
    // Forward the request to the streamable HTTP server
    const response = await axios({
      method: 'POST',
      url: targetUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      validateStatus: () => true // Accept all status codes
    });

    // Set session header for SSE compatibility
    res.setHeader('Mcp-Session-Id', req.headers['mcp-session-id'] || crypto.randomUUID());

    // Forward the response
    res.status(response.status);
    
    // Copy response headers
    Object.entries(response.headers).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value as string);
      }
    });

    res.json(response.data);
    
  } catch (error) {
    console.error('SSE Bridge: Error proxying to streamable HTTP:', error);
    
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'SSE Bridge proxy error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          target: MCP_SERVER_URL
        }
      },
      id: null,
    });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'n8n-mcp-sse-bridge',
    target: MCP_SERVER_URL,
    description: 'SSE bridge for n8n MCP Server (converts SSE to streamable HTTP)'
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'n8n-mcp-sse-bridge',
    description: 'SSE bridge for n8n MCP Server',
    note: 'SSE transport is deprecated. This bridge converts SSE to streamable HTTP.',
    target: MCP_SERVER_URL,
    endpoints: {
      sse: '/sse',
      health: '/health'
    }
  });
});

const port = parseInt(process.env.SSE_BRIDGE_PORT || '3001', 10);
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`🌉 SSE Bridge listening on ${host}:${port}`);
  console.log(`📡 SSE endpoint: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/sse`);
  console.log(`🎯 Target server: ${MCP_SERVER_URL}`);
  console.log(`⚠️  Note: SSE transport is deprecated, this bridge converts to streamable HTTP`);
}).on('error', (error: Error) => {
  console.error('❌ Failed to start SSE bridge:', error);
  process.exit(1);
}); 
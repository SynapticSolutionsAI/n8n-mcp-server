/**
 * Cloudflare Worker Entry Point for n8n MCP Server
 * 
 * This file serves as the entry point for the n8n MCP Server on Cloudflare Workers,
 * using Server-Sent Events (SSE) transport for MCP communication.
 */

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { configureServer } from './config/server.js';
import { parseDotNotation } from './utils/config.js';
import { N8nApiConfig } from './types/index.js';

export interface Env {
  // Cloudflare Worker environment variables
  N8N_API_URL?: string;
  N8N_API_KEY?: string;
  N8N_WEBHOOK_USERNAME?: string;
  N8N_WEBHOOK_PASSWORD?: string;
  DEBUG?: string;
}

// Store active transports by session ID
const transports = new Map<string, SSEServerTransport>();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    try {
      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response(
          JSON.stringify({ status: 'ok', service: 'n8n-mcp-server' }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Root endpoint
      if (url.pathname === '/') {
        return new Response(
          JSON.stringify({
            message: 'n8n MCP Server on Cloudflare Workers',
            version: '0.1.3',
            endpoints: {
              health: '/health',
              mcp: '/sse',
            },
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // MCP SSE endpoint
      if (url.pathname === '/sse') {
        // Create configuration from environment and query parameters
        const config: N8nApiConfig = {
          n8nApiUrl: env.N8N_API_URL,
          n8nApiKey: env.N8N_API_KEY,
          n8nWebhookUsername: env.N8N_WEBHOOK_USERNAME,
          n8nWebhookPassword: env.N8N_WEBHOOK_PASSWORD,
          debug: env.DEBUG?.toLowerCase() === 'true',
          // Override with query parameters if provided
          ...parseDotNotation(Object.fromEntries(url.searchParams)),
        };

        if (request.method === 'GET') {
          // Establish SSE connection
          return handleSSEConnection(config);
        } else if (request.method === 'POST') {
          // Handle incoming message
          return handleSSEMessage(request, config);
        }
      }

      // 404 for unknown endpoints
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },
};

async function handleSSEConnection(config: N8nApiConfig): Promise<Response> {
  // Create a readable stream for SSE
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Create MCP server
  const server = await configureServer(config);

  // Create a mock ServerResponse-like object for SSE transport
  const mockResponse = {
    writeHead: (statusCode: number, headers?: Record<string, string>) => {
      // Headers are handled by Response constructor
    },
    write: (data: string) => {
      writer.write(new TextEncoder().encode(data));
    },
    end: () => {
      writer.close();
    },
    setHeader: (name: string, value: string) => {
      // Headers are handled by Response constructor
    },
  } as any;

  // Create SSE transport
  const transport = new SSEServerTransport('/sse', mockResponse);
  
  // Store transport for POST requests
  transports.set(transport.sessionId, transport);

  // Connect server to transport
  await server.connect(transport);

  // Start SSE connection
  await transport.start();

  // Clean up on close
  transport.onclose = () => {
    transports.delete(transport.sessionId);
    server.close();
  };

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

async function handleSSEMessage(request: Request, config: N8nApiConfig): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId) {
      return new Response('Missing sessionId parameter', { status: 400 });
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      return new Response('Invalid or expired session', { status: 404 });
    }

    const body = await request.text();
    const message = JSON.parse(body);

    // Create a mock IncomingMessage for the transport
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    const mockRequest = {
      method: 'POST',
      url: request.url,
      headers,
    } as any;

    // Create a mock ServerResponse
    const mockResponse = {
      writeHead: () => {},
      write: () => {},
      end: () => {},
      setHeader: () => {},
    } as any;

    // Handle the message
    await transport.handlePostMessage(mockRequest, mockResponse, message);

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Error handling SSE message:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 
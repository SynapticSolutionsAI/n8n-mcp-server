/**
 * MCP Proxy Cloudflare Worker
 * 
 * This worker acts as a proxy to convert SSE transport requests 
 * to the working Streamable HTTP transport endpoint.
 */

export interface Env {
  MCP_TARGET_URL?: string;
  MCP_API_KEY?: string;
}

interface MCPRequest {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Set CORS headers for all requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response(
          JSON.stringify({ 
            status: 'ok', 
            service: 'mcp-proxy',
            targetUrl: env.MCP_TARGET_URL 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Root endpoint info
      if (url.pathname === '/') {
        return new Response(
          JSON.stringify({
            message: 'MCP Proxy Server',
            description: 'Converts SSE transport to Streamable HTTP transport',
            endpoints: {
              health: '/health',
              sse: '/mcp/sse',
              info: '/mcp',
            },
            targetUrl: env.MCP_TARGET_URL,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // SSE endpoint - proxies to Streamable HTTP
      if (url.pathname === '/mcp/sse') {
        return handleSSEProxy(request, env, corsHeaders);
      }

      // Standard MCP endpoint info
      if (url.pathname === '/mcp') {
        return new Response(
          JSON.stringify({
            message: 'MCP Proxy - SSE to Streamable HTTP',
            supportedTransports: ['sse'],
            proxyTarget: env.MCP_TARGET_URL,
            usage: {
              sse: {
                get: 'Connect to SSE stream',
                post: 'Send JSON-RPC requests',
              },
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 404 for unknown endpoints
      return new Response('Not Found', { 
        status: 404, 
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('Proxy error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};

async function handleSSEProxy(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const targetUrl = env.MCP_TARGET_URL || 'https://n8n-mcp-server.boris-spiegl.workers.dev/mcp';
  const apiKey = env.MCP_API_KEY || 'mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s';

  if (request.method === 'GET') {
    // Return SSE initialization stream
    const initMessage = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'mcp-proxy',
          version: '1.0.0',
        },
      },
    };

    const sseData = `data: ${JSON.stringify(initMessage)}\n\n`;

    return new Response(sseData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  if (request.method === 'POST') {
    // Proxy JSON-RPC requests to Streamable HTTP endpoint
    try {
      const body = await request.json() as MCPRequest;
      
      // Forward the request to the target Streamable HTTP endpoint
      // Add API key as query parameter
      const targetUrlWithKey = new URL(targetUrl);
      targetUrlWithKey.searchParams.set('apiKey', apiKey);
      
      console.log(`Proxying request to: ${targetUrlWithKey.toString()}`);
      console.log(`Request body:`, JSON.stringify(body));
      
      const targetResponse = await fetch(targetUrlWithKey.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!targetResponse.ok) {
        const errorText = await targetResponse.text();
        console.error(`Target server error: ${targetResponse.status} ${targetResponse.statusText}`, errorText);
        throw new Error(`Target server responded with ${targetResponse.status}: ${targetResponse.statusText}`);
      }

      const responseData = await targetResponse.json() as MCPResponse;
      
      return new Response(
        JSON.stringify(responseData),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (error) {
      console.error('Proxy request error:', error);
      
      // Return proper JSON-RPC error response
      const errorResponse: MCPResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error',
        },
      };

      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  return new Response('Method not allowed', { 
    status: 405, 
    headers: corsHeaders 
  });
} 
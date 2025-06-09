/**
 * Simplified Cloudflare Worker for n8n MCP Server
 * 
 * This implementation uses a simple HTTP-based MCP protocol
 * and proper SSE transport for client compatibility.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getEnvConfig } from './config/environment.js';
import { setupWorkflowTools } from './tools/workflow/index.js';
import { setupExecutionTools } from './tools/execution/index.js';
import { parseDotNotation } from './utils/config.js';
import { N8nApiConfig } from './types/index.js';

export interface Env {
  N8N_API_URL?: string;
  N8N_API_KEY?: string;
  N8N_WEBHOOK_USERNAME?: string;
  N8N_WEBHOOK_PASSWORD?: string;
  DEBUG?: string;
  MCP_AUTH_KEY?: string; // Simple API key for MCP authentication
}

// Simple authentication function
function isAuthenticated(request: Request, env: Env): boolean {
  // If no auth key is configured, allow all requests
  if (!env.MCP_AUTH_KEY) {
    return true;
  }

  const url = new URL(request.url);
  
  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').replace('Basic ', '');
    if (token === env.MCP_AUTH_KEY) {
      return true;
    }
  }
  
  // Check apiKey query parameter
  const apiKey = url.searchParams.get('apiKey');
  if (apiKey && apiKey === env.MCP_AUTH_KEY) {
    return true;
  }
  
  return false;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Set CORS headers for all requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response(
          JSON.stringify({ status: 'ok', service: 'n8n-mcp-server' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
              mcp: '/mcp',
              tools: '/tools',
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // SSE endpoint for SSE-compatible clients
      if (url.pathname === '/mcp/sse') {
        // For SSE connections, be more lenient with authentication
        // Some SSE clients don't pass query parameters correctly
        return handleSSERequest(request, env, corsHeaders);
      }

      // Redirect SSE to Streamable HTTP with deprecation notice
      if (url.pathname === '/sse') {
        return new Response(
          JSON.stringify({
            error: 'SSE transport deprecated',
            message: 'SSE transport is deprecated. Please use streamable-http transport at /mcp endpoint.',
            redirectTo: '/mcp',
            recommendedTransport: 'streamable-http',
          }),
          {
            status: 410, // Gone
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // MCP endpoint - simplified JSON-RPC over HTTP
      if (url.pathname === '/mcp') {
        // Check authentication for MCP requests
        if (!isAuthenticated(request, env)) {
          return new Response(
            JSON.stringify({
              error: 'Authentication required',
              message: 'Provide API key via Authorization header or apiKey query parameter',
              example: '?apiKey=your-api-key or Authorization: Bearer your-api-key',
            }),
            {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        if (request.method === 'POST') {
          return handleMCPRequest(request, env, corsHeaders);
        } else if (request.method === 'GET') {
          // Return information about the MCP server for GET requests
          return new Response(
            JSON.stringify({
              message: 'MCP JSON-RPC Endpoint',
              transport: 'http',
              protocol: 'jsonrpc-2.0',
              methods: ['initialize', 'tools/list', 'tools/call'],
              usage: 'Send POST requests with JSON-RPC 2.0 format',
              authentication: env.MCP_AUTH_KEY ? 'required' : 'disabled',
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // Tools list endpoint for easier testing
      if (url.pathname === '/tools') {
        return handleToolsRequest(env, corsHeaders);
      }

      // 404 for unknown endpoints
      return new Response('Not Found', { 
        status: 404, 
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('Worker error:', error);
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

async function handleMCPRequest(
  request: Request, 
  env: Env, 
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body = await request.json();
    
    // Create configuration from environment and query parameters
    const url = new URL(request.url);
    const config: N8nApiConfig = {
      n8nApiUrl: env.N8N_API_URL,
      n8nApiKey: env.N8N_API_KEY,
      n8nWebhookUsername: env.N8N_WEBHOOK_USERNAME,
      n8nWebhookPassword: env.N8N_WEBHOOK_PASSWORD,
      debug: env.DEBUG?.toLowerCase() === 'true',
      // Override with query parameters if provided
      ...parseDotNotation(Object.fromEntries(url.searchParams)),
    };

    // Handle different MCP methods
    if (body.method === 'initialize') {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'n8n-mcp-server',
              version: '0.1.3',
            },
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (body.method === 'tools/list') {
      const workflowTools = await setupWorkflowTools();
      const executionTools = await setupExecutionTools();
      
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            tools: [...workflowTools, ...executionTools],
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (body.method === 'tools/call') {
      const result = await handleToolCall(body.params, config);
      
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Unknown method
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        error: {
          code: -32601,
          message: 'Method not found',
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('MCP request error:', error);
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleSSERequest(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const config: N8nApiConfig = {
    n8nApiUrl: env.N8N_API_URL,
    n8nApiKey: env.N8N_API_KEY,
    n8nWebhookUsername: env.N8N_WEBHOOK_USERNAME,
    n8nWebhookPassword: env.N8N_WEBHOOK_PASSWORD,
    debug: env.DEBUG?.toLowerCase() === 'true',
    ...parseDotNotation(Object.fromEntries(url.searchParams)),
  };

  if (request.method === 'GET') {
    // Simple SSE response with proper initialization
    const initMessage = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'n8n-mcp-server',
          version: '0.1.3',
        },
      },
    };

    // Return proper SSE format with immediate response
    const sseData = `data: ${JSON.stringify(initMessage)}\n\n`;

    return new Response(sseData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  if (request.method === 'POST') {
    // Handle JSON-RPC requests for SSE transport
    try {
      const body = await request.json();
      
      if (body.method === 'initialize') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: {
                name: 'n8n-mcp-server',
                version: '0.1.3',
              },
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (body.method === 'tools/list') {
        const workflowTools = await setupWorkflowTools();
        const executionTools = await setupExecutionTools();
        
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              tools: [...workflowTools, ...executionTools],
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (body.method === 'tools/call') {
        const result = await handleToolCall(body.params, config);
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Unknown method
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32601, message: 'Method not found' },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (error) {
      console.error('SSE POST error:', error);
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Parse error' },
        }),
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

async function handleToolsRequest(
  env: Env, 
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const workflowTools = await setupWorkflowTools();
    const executionTools = await setupExecutionTools();
    
    return new Response(
      JSON.stringify({
        tools: [...workflowTools, ...executionTools],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Tools request error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to get tools',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleToolCall(params: any, config: N8nApiConfig): Promise<any> {
  const toolName = params.name;
  const args = params.arguments || {};

  // Import handlers dynamically
  const { 
    ListWorkflowsHandler, 
    GetWorkflowHandler,
    CreateWorkflowHandler,
    UpdateWorkflowHandler,
    DeleteWorkflowHandler,
    ActivateWorkflowHandler,
    DeactivateWorkflowHandler
  } = await import('./tools/workflow/index.js');
  
  const {
    ListExecutionsHandler,
    GetExecutionHandler,
    DeleteExecutionHandler,
    RunWebhookHandler
  } = await import('./tools/execution/index.js');

  // Route the tool call to the appropriate handler
  let handler: any;
  
  switch (toolName) {
    case 'list_workflows':
      handler = new ListWorkflowsHandler(config);
      break;
    case 'get_workflow':
      handler = new GetWorkflowHandler(config);
      break;
    case 'create_workflow':
      handler = new CreateWorkflowHandler(config);
      break;
    case 'update_workflow':
      handler = new UpdateWorkflowHandler(config);
      break;
    case 'delete_workflow':
      handler = new DeleteWorkflowHandler(config);
      break;
    case 'activate_workflow':
      handler = new ActivateWorkflowHandler(config);
      break;
    case 'deactivate_workflow':
      handler = new DeactivateWorkflowHandler(config);
      break;
    case 'list_executions':
      handler = new ListExecutionsHandler(config);
      break;
    case 'get_execution':
      handler = new GetExecutionHandler(config);
      break;
    case 'delete_execution':
      handler = new DeleteExecutionHandler(config);
      break;
    case 'run_webhook':
      handler = new RunWebhookHandler(config);
      break;
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }

  const result = await handler.execute(args);
  
  return {
    content: result.content,
    isError: result.isError || false,
  };
} 
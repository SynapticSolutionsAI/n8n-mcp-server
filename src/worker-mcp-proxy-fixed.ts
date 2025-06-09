/**
 * Fixed MCP Proxy - Streamable HTTP to SSE Converter
 * 
 * This implementation combines the working streamable HTTP MCP server
 * with SSE proxy functionality in a single worker to avoid Cloudflare
 * Workers networking limitations (error code 1042).
 */

export interface Env {
  N8N_BASE_URL: string;
  N8N_API_KEY: string;
  MCP_API_KEY: string;
}

interface MCPJSONRPCRequest {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: any;
}

interface MCPJSONRPCResponse {
  jsonrpc: string;
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// Session management for MCP connections
class MCPSessionManager {
  private sessions = new Map<string, { id: string; created: number; lastActivity: number }>();
  
  createSession(): string {
    const sessionId = `mcp-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessions.set(sessionId, {
      id: sessionId,
      created: Date.now(),
      lastActivity: Date.now()
    });
    return sessionId;
  }
  
  updateActivity(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      return true;
    }
    return false;
  }
  
  getSession(sessionId: string) {
    return this.sessions.get(sessionId);
  }
  
  cleanupOldSessions() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity > maxAge) {
        this.sessions.delete(id);
      }
    }
  }
}

const sessionManager = new MCPSessionManager();

/**
 * Validate API key
 */
function validateApiKey(providedKey: string | null, expectedKey: string): boolean {
  if (!providedKey || !expectedKey) {
    return false;
  }
  return providedKey === expectedKey;
}

/**
 * Create MCP initialization response
 */
async function createMCPInitResponse(): Promise<MCPJSONRPCResponse> {
  return {
    jsonrpc: "2.0",
    result: {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
        tools: { listChanged: true }
      },
      serverInfo: {
        name: "n8n-mcp-server",
        version: "1.0.0"
      }
    }
  };
}

/**
 * Handle MCP JSON-RPC requests using existing streamable HTTP logic
 */
async function handleMCPRequest(
  request: MCPJSONRPCRequest,
  env: Env,
  sessionId?: string
): Promise<MCPJSONRPCResponse> {
  console.log(`Handling MCP request (session: ${sessionId}):`, JSON.stringify(request));
  
  // Update session activity if provided
  if (sessionId) {
    sessionManager.updateActivity(sessionId);
  }
  
  try {

    switch (request.method) {
      case 'initialize':
        console.log('Initialize request received');
        return createMCPInitResponse();
        
      case 'tools/list':
        console.log('Listing tools');
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            tools: [
              { name: "list_workflows", description: "List all workflows", inputSchema: { type: "object", properties: {}, required: [] } },
              { name: "get_workflow", description: "Get workflow details", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
              { name: "create_workflow", description: "Create a new workflow", inputSchema: { type: "object", properties: { name: { type: "string" }, active: { type: "boolean" } }, required: ["name"] } },
              { name: "update_workflow", description: "Update a workflow", inputSchema: { type: "object", properties: { id: { type: "string" }, workflow: { type: "object" } }, required: ["id", "workflow"] } },
              { name: "delete_workflow", description: "Delete a workflow", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
              { name: "activate_workflow", description: "Activate a workflow", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
              { name: "deactivate_workflow", description: "Deactivate a workflow", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
              { name: "list_executions", description: "List workflow executions", inputSchema: { type: "object", properties: { limit: { type: "number" } }, required: [] } },
              { name: "get_execution", description: "Get execution details", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
              { name: "delete_execution", description: "Delete an execution", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
              { name: "run_webhook", description: "Execute a webhook", inputSchema: { type: "object", properties: { path: { type: "string" }, data: { type: "object" } }, required: ["path"] } }
            ]
          }
        };
        
      case 'tools/call':
        console.log('Tool call request:', request.params);
        const toolName = request.params?.name;
        const toolArgs = request.params?.arguments || {};
        
        // Forward tool call to n8n API
        let n8nResponse;
        try {
          const response = await fetch(`${env.N8N_BASE_URL}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-N8N-API-KEY': env.N8N_API_KEY
            },
            body: JSON.stringify({
              tool: toolName,
              args: toolArgs
            })
          });
          
          n8nResponse = await response.json();
        } catch (error) {
          console.error('Error calling n8n API:', error);
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32603,
              message: "n8n API error",
              data: error instanceof Error ? error.message : String(error)
            }
          };
        }
        
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(n8nResponse, null, 2)
              }
            ]
          }
        };
        
      default:
        throw new Error(`Unknown method: ${request.method}`);
    }
  } catch (error) {
    console.error('Error handling MCP request:', error);
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code: -32603,
        message: "Internal error",
        data: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * Create SSE response with proper headers and streaming
 */
function createSSEResponse(sessionId: string): Response {
  const encoder = new TextEncoder();
  
  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send connection event
      const connectionEvent = `data: ${JSON.stringify({
        type: "connection",
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })}\n\n`;
      controller.enqueue(encoder.encode(connectionEvent));
      
      // Send initialized notification
      const initEvent = `data: ${JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      })}\n\n`;
      controller.enqueue(encoder.encode(initEvent));
      
      // Keep connection alive
      const keepAlive = setInterval(() => {
        try {
          const ping = `: ping - ${new Date().toISOString()}\n\n`;
          controller.enqueue(encoder.encode(ping));
        } catch (error) {
          clearInterval(keepAlive);
        }
      }, 30000);
      
      // Clean up on close
      setTimeout(() => {
        clearInterval(keepAlive);
        controller.close();
      }, 300000); // 5 minutes max
    }
  });
  
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, Mcp-Session-Id',
      'Mcp-Session-Id': sessionId,
      'X-Accel-Buffering': 'no'
    }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Clean up old sessions periodically
    if (Math.random() < 0.01) { // 1% chance to trigger cleanup
      sessionManager.cleanupOldSessions();
    }
    
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, Mcp-Session-Id',
    };
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response('MCP Proxy Server OK', { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }
    
    // Validate API key for MCP endpoints
    if (url.pathname.startsWith('/mcp')) {
      let apiKey = url.searchParams.get('apiKey');
      if (!apiKey) {
        // Check headers for MCP Inspector compatibility
        apiKey = request.headers.get('X-API-Key') || 
                 request.headers.get('apiKey') || 
                 request.headers.get('Authorization')?.replace('Bearer ', '') || null;
      }
      if (!validateApiKey(apiKey, env.MCP_API_KEY)) {
        return new Response('Unauthorized', { 
          status: 401, 
          headers: corsHeaders 
        });
      }
    }
    
    // Extract session ID from headers
    let sessionId = request.headers.get('Mcp-Session-Id');
    
    // SSE endpoint - GET request to establish SSE connection
    if (url.pathname === '/mcp/sse' && request.method === 'GET') {
      console.log('Establishing SSE connection');
      
      // Create new session for this connection
      sessionId = sessionManager.createSession();
      console.log('Created SSE session:', sessionId);
      
      return createSSEResponse(sessionId);
    }
    
    // SSE endpoint - POST request for message handling
    if (url.pathname === '/mcp/sse' && request.method === 'POST') {
      console.log('Handling SSE POST message');
      
      try {
        const contentType = request.headers.get('Content-Type');
        if (!contentType?.includes('application/json')) {
          return new Response('Content-Type must be application/json', { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        const jsonRpcRequest: JSONRPCRequest = await request.json();
        console.log('Received JSON-RPC request:', JSON.stringify(jsonRpcRequest));
        
        // Process the MCP request
        const response = await handleMCPRequest(jsonRpcRequest, env, sessionId || undefined);
        console.log('Generated response:', JSON.stringify(response));
        
        // Send response back to client with session header
        const responseHeaders = {
          ...corsHeaders,
          'Content-Type': 'application/json'
        };
        
        if (sessionId) {
          responseHeaders['Mcp-Session-Id'] = sessionId;
        }
        
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: responseHeaders
        });
        
      } catch (error) {
        console.error('Error processing SSE POST message:', error);
        
        const errorResponse = {
          jsonrpc: "2.0",
          id: 0,
          error: {
            code: -32700,
            message: "Parse error",
            data: error instanceof Error ? error.message : String(error)
          }
        };
        
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: corsHeaders
        });
      }
    }
    
    // Streamable HTTP endpoint (compatibility)
    if (url.pathname === '/mcp' && request.method === 'POST') {
      console.log('Handling streamable HTTP request');
      
      try {
        const jsonRpcRequest: JSONRPCRequest = await request.json();
        const response = await handleMCPRequest(jsonRpcRequest, env);
        
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
        
      } catch (error) {
        console.error('Error processing streamable HTTP request:', error);
        
        const errorResponse = {
          jsonrpc: "2.0",
          id: 0,
          error: {
            code: -32700,
            message: "Parse error",
            data: error instanceof Error ? error.message : String(error)
          }
        };
        
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: corsHeaders
        });
      }
    }
    
    // 404 for unknown endpoints
    return new Response('Not Found', { 
      status: 404, 
      headers: corsHeaders 
    });
  }
}; 
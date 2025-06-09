@echo off
REM Start MCP Inspector with streamable-http transport
REM This avoids PowerShell argument parsing issues

echo Starting MCP Inspector...
echo Transport: streamable-http (SSE is deprecated)

set API_KEY=mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s
set PROXY_URL=https://n8n-mcp-proxy-fixed.boris-spiegl.workers.dev
set CLIENT_PORT=8276

echo Connecting to: %PROXY_URL%
echo Using API key: %API_KEY%

REM Use streamable-http endpoint instead of SSE
npx @modelcontextprotocol/inspector "%PROXY_URL%/mcp?apiKey=%API_KEY%"

if %ERRORLEVEL% neq 0 (
    echo.
    echo MCP Inspector failed to start. Error code: %ERRORLEVEL%
    echo Try checking the troubleshooting guide.
    pause
) 
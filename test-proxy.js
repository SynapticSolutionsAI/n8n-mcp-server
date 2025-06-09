// Simple test to debug proxy issue
const targetUrl = 'https://n8n-mcp-server.boris-spiegl.workers.dev/mcp?apiKey=mcp-n8n-8k2p9x4w7v5q3m6n1j8h5r2y9t4e6u3s';
const body = {
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
};

console.log('Making request to:', targetUrl);
console.log('Request body:', JSON.stringify(body));

fetch(targetUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  body: JSON.stringify(body),
})
.then(response => {
  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
  return response.text();
})
.then(text => {
  console.log('Response body:', text);
})
.catch(error => {
  console.error('Error:', error);
}); 
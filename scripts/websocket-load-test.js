/*
Simple WebSocket load tester for the MessagingGateway.
Spawns N socket.io-client connections and tracks how many succeed.

Usage: node scripts/websocket-load-test.js [count]

Example: node scripts/websocket-load-test.js 500  # defaults to port 3000 unless WS_URL is set
*/

const io = require('socket.io-client');

const url = process.env['WS_URL'] || 'http://localhost:3000/messaging';
// optional auth token to accompany each handshake
const authToken = process.env['WS_AUTH_TOKEN'] || '';
const count = parseInt(process.argv[2], 10) || 100;

let connected = 0;
let failed = 0;

console.log(`attempting to open ${count} connections to ${url}`);
if (authToken) console.log('using auth token from WS_AUTH_TOKEN');

for (let i = 0; i < count; i++) {
  const socket = io(url, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
    auth: authToken ? { token: authToken } : undefined,
  });

  socket.on('connect', () => {
    connected++;
    // optionally join a room or authenticate if needed
    if (connected + failed === count) report();
  });

  socket.on('connect_error', (err) => {
    failed++;
    if (connected + failed === count) report();
  });

  socket.on('disconnect', () => {});
}

function report() {
  console.log(`connected: ${connected}, failed: ${failed}`);
  process.exit(0);
}

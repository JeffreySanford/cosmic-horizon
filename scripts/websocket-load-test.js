/*
Simple WebSocket load tester for the MessagingGateway.
Spawns N socket.io-client connections and tracks how many succeed.

Usage: node scripts/websocket-load-test.js [count]

Example: node scripts/websocket-load-test.js 500
*/

const io = require('socket.io-client');

const url = process.env['WS_URL'] || 'http://localhost:3333/messaging';
const count = parseInt(process.argv[2], 10) || 100;

let connected = 0;
let failed = 0;

console.log(`attempting to open ${count} connections to ${url}`);

for (let i = 0; i < count; i++) {
  const socket = io(url, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
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

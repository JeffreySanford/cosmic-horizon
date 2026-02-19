const http = require('http');
const PORT = process.env.PORT || 9404;

const metrics = `# HELP kafka_request_latency_seconds Simulated Kafka request latency (seconds)
# TYPE kafka_request_latency_seconds summary
kafka_request_latency_seconds{quantile="0.5"} 0.005
kafka_request_latency_seconds{quantile="0.95"} 0.01
kafka_request_latency_seconds{quantile="0.99"} 0.0123
kafka_request_latency_seconds_sum 0.0283
kafka_request_latency_seconds_count 100
`;

const server = http.createServer((req, res) => {
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    res.end(metrics);
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(
    `Mock Kafka metrics server listening on http://localhost:${PORT}/metrics`,
  );
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());

// simple express server to mimic a subset of Tapis endpoints for CI (ES module)
import express from 'express';
const app = express();
app.use(express.json());

app.get('/v3/oauth2', (req, res) => {
  res.json({ version: 'v3' });
});

app.get('/v3/jobs', (req, res) => {
  res.json({ jobs: [] });
});

app.post('/v3/jobs/submit', (req, res) => {
  res.json({ job_id: 'mock-job-1', status: 'QUEUED' });
});

app.get('/v3/jobs/:id/status', (req, res) => {
  res.json({ id: req.params.id, status: 'RUNNING', progress: 0.1 });
});

const port = process.env.MOCK_TAPIS_PORT || 4000;
app.listen(port, () => {
  console.log(`Mock Tapis server listening on ${port}`);
});

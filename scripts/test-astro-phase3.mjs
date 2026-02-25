#!/usr/bin/env node
// Manual smoke test for Phase 3 (real-data jobs with astro service).
// Usage: ASTRO=true pnpm run test-astro

import fetch from 'node-fetch';
import fs from 'fs';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const DATA_DIR = process.env.ASTRO_DATA_DIR || './astronomy-data';

async function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  console.log('Submitting astronomy job');
  const resp = await fetch(`${API_URL}/jobs/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent: 'phase3-test',
      dataset_id: 'sample',
      params: {},
    }),
  });
  const json = await resp.json();
  const jobId = json.jobId;
  console.log('jobId=', jobId);

  let status;
  for (let i = 0; i < 60; i++) {
    const sresp = await fetch(`${API_URL}/jobs/status/${jobId}`);
    status = await sresp.json();
    console.log('status', status.status);
    if (['COMPLETED', 'FAILED', 'CANCELED'].includes(status.status)) break;
    await delay(1000);
  }

  if (status.status !== 'COMPLETED') {
    console.error('job did not complete successfully', status);
    process.exit(1);
  }

  console.log('Job completed; fetching result');
  const rresp = await fetch(`${API_URL}/jobs/result/${jobId}`);
  const result = await rresp.json();
  console.log('result', result);

  // verify file exists locally (stored under astronomy-data maybe)
  const fitsPath = `${DATA_DIR}/${jobId}.fits`;
  if (fs.existsSync(fitsPath)) {
    console.log('Found FITS file at', fitsPath);
  } else {
    console.warn('No FITS file found at', fitsPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

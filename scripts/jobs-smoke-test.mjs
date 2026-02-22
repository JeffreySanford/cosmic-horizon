#!/usr/bin/env node
// simple script to exercise the login endpoint for a user and admin account
// usage: node scripts/auth-test.mjs
// environment variables override defaults; .env.local is loaded automatically

import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';

const baseUrl = process.env.API_URL || 'http://localhost:3000';

async function login(email, password) {
  const url = `${baseUrl}/api/auth/login`;
  try {
    const res = await axios.post(url, { email, password });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new Error(`login failed (${err.response.status}): ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

async function probeHistory(token) {
  const url = `${baseUrl}/api/jobs/history/list`;
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await axios.get(url, { headers });
    console.log(`GET /jobs/history/list ${token ? 'with' : 'without'} token ->`, res.status);
    if (res.status === 200) {
      console.log('response:\n', JSON.stringify(res.data, null, 2));
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      console.log(`GET /jobs/history/list ${token ? 'with' : 'without'} token ->`, err.response.status);
    } else {
      console.error('probe error', err);
    }
  }
}

async function submitJob(token, datasetId, params) {
  const url = `${baseUrl}/api/jobs/submit`;
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const res = await axios.post(url, { agent: 'AlphaCal', dataset_id: datasetId, params }, { headers });
    console.log(`submitted job ${res.data.id} status ${res.status}`);
    return res.data.id;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      console.error('job submit error', err.response.status, err.response.data);
    } else {
      console.error('job submit error', err);
    }
    return null;
  }
}

async function waitForStatus(jobId, token) {
  const headers = { Authorization: `Bearer ${token}` };
  while (true) {
    const res = await axios.get(`${baseUrl}/api/jobs/${jobId}/status`, { headers });
    const status = res.data.status;
    console.log(`job ${jobId} status ${status}`);
    if (['COMPLETED','FAILED','CANCELLED'].includes(status)) {
      return res.data;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function main() {
  // use seeded credentials from env if available
  const userEmail = process.env.USER_EMAIL || process.env.SEED_TEST_EMAIL || 'test@cosmic.local';
  const userPass = process.env.USER_PASS || process.env.SEED_TEST_PASSWORD || 'Password123!';
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || 'admin@cosmic.local';
  const adminPass = process.env.ADMIN_PASS || process.env.SEED_ADMIN_PASSWORD || 'AdminPassword123!';

  console.log('Probing history endpoint without token');
  await probeHistory(null);

  console.log('Logging in as regular user...');
  let userToken = null;
  try {
    const user = await login(userEmail, userPass);
    userToken = user.access_token;
    console.log('User token:', userToken);
  } catch (err) {
    console.error('User login error:', err.message);
  }

  console.log('Probing history endpoint with user token');
  await probeHistory(userToken);

  // determine dataset to use for submission; env vars control outcome
  // - DATASET_ID: explicit dataset identifier (takes precedence)
  // - FAILURE: when truthy the script will pick a "quota" dataset to
  //   exercise the failure path in the demo adapter.
  // Default behaviour is to submit a working job (e2e-pass-dataset...).
  const datasetId =
    process.env.DATASET_ID ||
    (process.env.FAILURE
      ? `quota-trigger-${Date.now()}`
      : `e2e-pass-dataset-${Date.now()}`);
  console.log(`Submitting job against dataset: ${datasetId}`);
  if (userToken) {
    const jobId = await submitJob(userToken, datasetId, {
      gpu_count: 1,
      rfi_strategy: 'medium',
      target_name: 'M51',
    });
    if (jobId) {
      const final = await waitForStatus(jobId, userToken);
      console.log('final job', final);
      if (final.status !== 'COMPLETED') {
        // if job didn't succeed, surface the failure reason and exit non‑zero
        const reason =
          final.result?.error_message || final.notes || 'unknown';
        console.error(`job did not complete successfully: ${reason}`);
        process.exit(1);
      } else {
        // successful run – report the output/product if present
        const output = final.result?.output_url || final.result?.output;
        if (output) {
          // demo adapter returns a fake NRAO URL; strip domain for clarity
          const display = String(output).replace(
            /^https:\/\/archive\.vla\.nrao\.edu/, 
            '[demo-host]'
          );
          console.log('job produced output:', display);
        }
      // write a simple report file for CI/inspection
      try {
        const report = {
          id: final.id,
          dataset: datasetId,
          status: final.status,
          result: final.result,
          created_at: final.created_at,
          completed_at: final.completed_at,
          output: output || null,
        };
        const fileName =
          process.env.REPORT_FILE || `job-report-${Date.now()}.json`;
        await fs.promises.writeFile(fileName, JSON.stringify(report, null, 2));
        console.log(`wrote report to ${fileName}`);
      } catch (err) {
        console.error('failed to write report file', err);
      }

      // optionally generate a real FITS file using Python + astropy
      if (process.env.GENERATE_FITS) {
        try {
          const fitsPath = `job-output-${final.id}.fits`;
          const script = `
import numpy as np
from astropy.io import fits

# simple 100x100 test image
arr = np.arange(100*100, dtype=np.float32).reshape((100,100))
fits.writeto('${fitsPath}', arr, overwrite=True)
`;
          const tmp = 'generate_fits.py';
          await fs.promises.writeFile(tmp, script);
          const { exec } = await import('child_process');
          await new Promise((res, rej) =>
            exec(
              `${process.env.PYTHON || 'python'} ${tmp}`,
              (err, stdout, stderr) => {
                if (err) return rej(err);
                res(stdout);
              },
            ),
          );
          console.log('generated FITS file', fitsPath);
          await fs.promises.unlink('generate_fits.py');
        } catch (err) {
          console.error('failed to create FITS file', err);
        }
      }
      }
    }
  }

  console.log('Logging in as admin...');
  let adminToken = null;
  try {
    const admin = await login(adminEmail, adminPass);
    adminToken = admin.access_token;
    console.log('Admin token:', adminToken);
  } catch (err) {
    console.error('Admin login error:', err.message);
  }

  console.log('Probing history endpoint with admin token');
  await probeHistory(adminToken);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

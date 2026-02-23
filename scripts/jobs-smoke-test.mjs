#!/usr/bin/env node
// simple script to exercise the login endpoint for a user and admin account
// usage: node scripts/auth-test.mjs
// environment variables override defaults; .env.local is loaded automatically

import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const baseUrl = process.env.API_URL || 'http://localhost:3000';

function maskToken(tok) {
  if (!tok || typeof tok !== 'string') return tok;
  if (tok.length <= 10) return tok;
  return `${tok.slice(0,6)}...${tok.slice(-4)}`;
}

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

  // clean previous artifacts so only a single job's files remain
  const outDir = path.resolve(process.cwd(), 'job-test');
  await fs.promises.rm(outDir, { recursive: true, force: true });
  await fs.promises.mkdir(outDir, { recursive: true });

  console.log('Logging in as regular user...');
  let userToken = null;
  try {
    const user = await login(userEmail, userPass);
    userToken = user.access_token;
    console.log('User token:', maskToken(userToken));
  } catch (err) {
    console.error('User login error:', err.message);
  }

  // skip listing history; demo should focus on the single submitted job

  // determine dataset to use for submission; env vars control outcome
  // - DATASET_ID: explicit dataset identifier (takes precedence)
  // - FAILURE: when truthy the script will pick a "quota" dataset to
  //   exercise the failure path in the demo adapter.
  // - TARGET: object name to include in job params and FITS header
  // Default behaviour is to submit a working job (e2e-pass-dataset...).
  const datasetId =
    process.env.DATASET_ID ||
    (process.env.FAILURE
      ? `quota-trigger-${Date.now()}`
      : `e2e-pass-dataset-${Date.now()}`);
  const targetName = process.env.TARGET || 'M51';
  console.log(`Submitting job against dataset: ${datasetId} target: ${targetName}`);
  if (userToken) {
    const jobId = await submitJob(userToken, datasetId, {
      gpu_count: 1,
      rfi_strategy: 'medium',
      target_name: targetName,
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
      // outDir was already prepared at script start

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
          local_fits_path: final.status === 'COMPLETED' ? path.join(outDir, `job-output-${final.id}.fits`) : null,
          local_png_path: final.status === 'COMPLETED' ? path.join(outDir, `job-output-${final.id}.png`) : null,
        };
        const fileName = path.join(
          outDir,
          process.env.REPORT_FILE || `job-report-${Date.now()}.json`,
        );
        await fs.promises.writeFile(fileName, JSON.stringify(report, null, 2));
        console.log(`wrote report to ${fileName}`);
      } catch (err) {
        console.error('failed to write report file', err);
      }

      // always generate a real FITS file using Python + astropy when job succeeded
      if (final.status === 'COMPLETED') {
        try {
          const fitsPath = path.join(outDir, `job-output-${final.id}.fits`);
              // escape backslashes for Python strings
          const safeFitsPath = fitsPath.replace(/\\/g, '\\\\');
          const script = `
import numpy as np
from astropy.io import fits

# higher-resolution synthetic "star" image: sharp Gaussian blob 512x512
size = 512
cx, cy = size//2, size//2
sigma = 8.0
arr = np.zeros((size, size), dtype=np.float32)
for i in range(size):
    for j in range(size):
        # Gaussian centred in image with narrow sigma
        arr[j,i] = np.exp(-((i-cx)**2+(j-cy)**2) / (2*sigma**2))

hdu = fits.PrimaryHDU(arr)
hdu.header['OBJECT'] = '${targetName}'
hdu.writeto(r'${safeFitsPath}', overwrite=True)
`;
          const tmp = path.join(outDir, 'generate_fits.py');
          await fs.promises.writeFile(tmp, script);
          const { exec } = await import('child_process');
          // prefer virtualenv python if available
          let pythonCmd = process.env.PYTHON || 'python';
          const venvPython = path.join(process.cwd(), '.venv',
            process.platform === 'win32' ? 'Scripts' : 'bin',
            process.platform === 'win32' ? 'python.exe' : 'python');
          if (await fs.promises
            .access(venvPython)
            .then(() => true)
            .catch(() => false)) {
            pythonCmd = venvPython;
          }
          await new Promise((res, rej) =>
            exec(
              `${pythonCmd} ${tmp}`,
              { cwd: outDir },
              (err, stdout, stderr) => {
                if (err) return rej(err);
                res(stdout);
              },
            ),
          );
          console.log('generated FITS file', fitsPath);
          await fs.promises.unlink(tmp);
          // convert FITS -> PNG using Python/astropy & matplotlib
          try {
            // ensure matplotlib installed in the venv
            try {
              await new Promise((res, rej) => {
                exec(
                  `${pythonCmd} -c "import matplotlib"`,
                  (err) => {
                    if (err) return rej(err);
                    res();
                  },
                );
              });
            } catch {
              console.log('matplotlib not present, installing in venv');
              await new Promise((res, rej) => {
                exec(
                  `${pythonCmd} -m pip install matplotlib`,
                  (err, stdout, stderr) => {
                    if (err) return rej(err);
                    console.log(stdout, stderr);
                    res();
                  },
                );
              });
            }

            const pngPath = path.join(outDir, `job-output-${final.id}.png`);
            const safeFits = fitsPath.replace(/\\/g, '\\\\');
            const safePng = pngPath.replace(/\\/g, '\\\\');
            const convScript = `
from astropy.io import fits
import matplotlib.pyplot as plt

hdu = fits.open(r'${safeFits}')[0]
plt.imshow(hdu.data, cmap='gray', origin='lower')
plt.title('OBJECT: ${targetName}')
plt.axis('off')
plt.savefig(r'${safePng}', bbox_inches='tight', pad_inches=0)
`;
            const convTmp = path.join(outDir, 'convert_fits.py');
            await fs.promises.writeFile(convTmp, convScript);
            await new Promise((res, rej) => {
              exec(
                `${pythonCmd} ${convTmp}`,
                { cwd: outDir },
                (err, stdout, stderr) => {
                  if (err) return rej(err);
                  res(stdout);
                },
              );
            });
            console.log('generated PNG file', pngPath);
            await fs.promises.unlink(convTmp);
          } catch (err) {
            console.error('failed to convert FITS to PNG', err);
          }
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
    console.log('Admin token:', maskToken(adminToken));
  } catch (err) {
    console.error('Admin login error:', err.message);
  }

  // admin probe omitted in demo run
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

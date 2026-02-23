#!/usr/bin/env node
// usage: node scripts/auth-test.mjs
// improved version with reliability, safety, and vectorized FITS generation
import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec as execCb, execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCb);
const execFile = promisify(execFileCb);

const baseUrl = process.env.API_URL || 'http://localhost:3000';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 2000);
const POLL_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS || 5 * 60_000);
const OUT_DIR = process.env.OUT_DIR || path.resolve(process.cwd(), 'job-test');

const http = axios.create({
  baseURL: baseUrl,
  timeout: Number(process.env.HTTP_TIMEOUT_MS || 15_000),
  validateStatus: () => true,
});

function maskToken(tok) {
  if (!tok || typeof tok !== 'string') return tok;
  if (tok.length <= 10) return tok;
  return `${tok.slice(0, 6)}...${tok.slice(-4)}`;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isOk(res) {
  return res.status >= 200 && res.status < 300;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureCleanDir(dir) {
  await fs.promises.rm(dir, { recursive: true, force: true });
  await fs.promises.mkdir(dir, { recursive: true });
}

async function login(email, password) {
  const res = await http.post('/api/auth/login', { email, password });
  if (!isOk(res)) {
    throw new Error(`login failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

async function submitJob(token, datasetId, params) {
  const res = await http.post(
    '/api/jobs/submit',
    { agent: 'AlphaCal', dataset_id: datasetId, params },
    { headers: authHeaders(token) }
  );

  if (!isOk(res)) {
    throw new Error(`job submit failed (${res.status}): ${JSON.stringify(res.data)}`);
  }

  if (!res.data?.id) {
    throw new Error(`job submit returned no id: ${JSON.stringify(res.data)}`);
  }

  console.log(`submitted job ${res.data.id} status ${res.status}`);
  return res.data.id;
}

async function getJobStatus(jobId, token) {
  const res = await http.get(`/api/jobs/${jobId}/status`, { headers: authHeaders(token) });
  if (!isOk(res)) {
    throw new Error(`status check failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

async function waitForTerminalStatus(jobId, token) {
  const start = Date.now();
  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      const data = await getJobStatus(jobId, token);
      const status = data.status;
      console.log(`job ${jobId} status ${status}`);

      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
        return data;
      }
    } catch (e) {
      console.warn(`poll attempt ${attempt} error: ${e?.message || e}`);
    }

    if (Date.now() - start > POLL_TIMEOUT_MS) {
      throw new Error(`poll timeout after ${Math.round(POLL_TIMEOUT_MS / 1000)}s for job ${jobId}`);
    }

    const delay = Math.min(POLL_INTERVAL_MS * Math.max(1, Math.floor(attempt / 5)), 10_000);
    await sleep(delay);
  }
}

async function writeReport(outDir, final, datasetId, output) {
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

  const fileName = path.join(outDir, process.env.REPORT_FILE || `job-report-${Date.now()}.json`);
  await fs.promises.writeFile(fileName, JSON.stringify(report, null, 2));
  console.log(`wrote report to ${fileName}`);
}

async function pickPython() {
  let pythonCmd = process.env.PYTHON || 'python';

  const venvPython = path.join(
    process.cwd(),
    '.venv',
    process.platform === 'win32' ? 'Scripts' : 'bin',
    process.platform === 'win32' ? 'python.exe' : 'python'
  );

  const venvExists = await fs.promises
    .access(venvPython)
    .then(() => true)
    .catch(() => false);

  if (venvExists) pythonCmd = venvPython;
  return pythonCmd;
}

async function ensurePythonDeps(pythonCmd, modules, { hardFail = false } = {}) {
  const check = async (m) => {
    try {
      await exec(`${pythonCmd} -c "import ${m}"`);
      return true;
    } catch {
      return false;
    }
  };

  for (const m of modules) {
    const ok = await check(m);
    if (!ok) {
      const msg = `missing python module "${m}" (python=${pythonCmd}).`;
      if (hardFail) throw new Error(msg);
      console.warn(msg);
      return false;
    }
  }
  return true;
}

async function generateFitsAndPng({ outDir, jobId, targetName }) {
  const pythonCmd = await pickPython();

  const requirePy = !!process.env.REQUIRE_PY;
  const requirePng = !!process.env.REQUIRE_PNG;

  const hasFitsDeps = await ensurePythonDeps(pythonCmd, ['numpy', 'astropy'], { hardFail: requirePy });
  if (!hasFitsDeps) return;

  const fitsPath = path.join(outDir, `job-output-${jobId}.fits`);
  const pngPath = path.join(outDir, `job-output-${jobId}.png`);

  const genScript = `
import os
import numpy as np
from astropy.io import fits

target = os.environ.get("TARGET_NAME", "M51")
out_fits = os.environ["OUT_FITS"]

size = int(os.environ.get("FITS_SIZE", "2048"))
yy, xx = np.indices((size, size), dtype=np.float32)
cx = (size - 1) / 2.0
cy = (size - 1) / 2.0
x = xx - cx
y = yy - cy
r = np.hypot(x, y)
theta = np.arctan2(y, x)

obj = target.lower()

if ("galaxy" in obj) or ("andromeda" in obj) or ("m31" in obj):
    img = np.exp(-r/ (size * 0.20)) * (1.0 + 0.5*np.cos(4*theta + r/(size * 0.03)))
elif "mars" in obj:
    img = (r < (size * 0.40)).astype(np.float32)
else:
    sigma = size * 0.25
    img = np.exp(-((x*x + y*y) / (2.0 * sigma*sigma))).astype(np.float32)

hdu = fits.PrimaryHDU(img.astype(np.float32))
hdu.header["OBJECT"] = target
hdu.writeto(out_fits, overwrite=True)
`;

  const genTmp = path.join(outDir, `generate_fits_${Date.now()}.py`);
  await fs.promises.writeFile(genTmp, genScript);

  await exec(`${pythonCmd} ${genTmp}`, {
    env: { ...process.env, TARGET_NAME: targetName, OUT_FITS: fitsPath },
    cwd: outDir,
    maxBuffer: 10 * 1024 * 1024,
  });
  await fs.promises.unlink(genTmp);
  console.log('generated FITS file', fitsPath);

  const hasPngDeps = await ensurePythonDeps(pythonCmd, ['matplotlib'], { hardFail: requirePng });
  if (!hasPngDeps) {
    console.warn('skipping PNG generation (matplotlib missing).');
    return;
  }

  const convScript = `
import os
from astropy.io import fits
import matplotlib.pyplot as plt

in_fits = os.environ["IN_FITS"]
out_png = os.environ["OUT_PNG"]
target = os.environ.get("TARGET_NAME", "")

hdu = fits.open(in_fits)[0]
plt.imshow(hdu.data, cmap="gray", origin="lower")
plt.title(f"OBJECT: {target}")
plt.axis("off")
plt.savefig(out_png, bbox_inches="tight", pad_inches=0)
`;

  const convTmp = path.join(outDir, `convert_fits_${Date.now()}.py`);
  await fs.promises.writeFile(convTmp, convScript);

  await exec(`${pythonCmd} ${convTmp}`, {
    env: { ...process.env, TARGET_NAME: targetName, IN_FITS: fitsPath, OUT_PNG: pngPath },
    cwd: outDir,
    maxBuffer: 10 * 1024 * 1024,
  });
  await fs.promises.unlink(convTmp);
  console.log('generated PNG file', pngPath);
}

async function main() {
  const userEmail = process.env.USER_EMAIL || process.env.SEED_TEST_EMAIL || 'test@cosmic.local';
  const userPass = process.env.USER_PASS || process.env.SEED_TEST_PASSWORD || 'Password123!';
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || 'admin@cosmic.local';
  const adminPass = process.env.ADMIN_PASS || process.env.SEED_ADMIN_PASSWORD || 'AdminPassword123!';

  await ensureCleanDir(OUT_DIR);

  console.log('Logging in as regular user...');
  let userToken = null;
  try {
    const user = await login(userEmail, userPass);
    userToken = user.access_token;
    console.log('User token:', maskToken(userToken));
  } catch (e) {
    console.error('User login error:', e.message || e);
    process.exitCode = 1;
    return;
  }

  const datasetId =
    process.env.DATASET_ID ||
    (process.env.FAILURE ? `quota-trigger-${Date.now()}` : `e2e-pass-dataset-${Date.now()}`);

  const targetName = process.env.TARGET || 'M51';

  console.log(`Submitting job against dataset: ${datasetId} target: ${targetName}`);

  const jobId = await submitJob(userToken, datasetId, {
    gpu_count: 1,
    rfi_strategy: 'medium',
    target_name: targetName,
  });

  const final = await waitForTerminalStatus(jobId, userToken);
  console.log('final job', final);

  const output = final.result?.output_url || final.result?.output || null;
  if (output) {
    const display = String(output).replace(/^https:\/\/archive\.vla\.nrao\.edu/, '[demo-host]');
    console.log('job produced output:', display);
  }

  await writeReport(OUT_DIR, final, datasetId, output);

  if (final.status !== 'COMPLETED') {
    const reason = final.result?.error_message || final.notes || 'unknown';
    console.error(`job did not complete successfully: ${reason}`);
    process.exitCode = 1;
    return;
  }

  await generateFitsAndPng({ outDir: OUT_DIR, jobId: final.id, targetName });

  console.log('Logging in as admin...');
  try {
    const admin = await login(adminEmail, adminPass);
    console.log('Admin token:', maskToken(admin.access_token));
  } catch (e) {
    console.warn('Admin login failed (non-fatal for demo):', e.message || e);
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e?.stack || e);
  process.exitCode = 1;
});

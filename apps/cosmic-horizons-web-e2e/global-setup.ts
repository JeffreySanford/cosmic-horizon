import type { FullConfig } from '@playwright/test';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

async function isUrlHealthy(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    return await new Promise<boolean>((resolve) => {
      const req = lib.get(u, (res) => {
        const ok = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
        // consume and close the response
        res.resume();
        resolve(ok);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

export default async function globalSetup(_config: FullConfig) {
  void _config; // parameter provided by Playwright but not used in our setup
  const apiBase = process.env['API_BASE_URL'] ?? 'http://127.0.0.1:3000';
  const healthUrl = `${apiBase.replace(/\/$/, '')}/health`;
  const timeoutMs = Number(process.env['API_READY_TIMEOUT_MS'] ?? 30000);
  const pollIntervalMs = 500;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const ok = await isUrlHealthy(healthUrl);
    if (ok) {
      // API is ready — exit globalSetup
      return;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`API ${healthUrl} not reachable after ${timeoutMs}ms`);
}

import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
  console.log('\nSetting up...\n');

  const host = process.env.HOST ?? 'localhost';
  const configuredPort = process.env.API_PORT;
  const port = configuredPort ? Number(configuredPort) : 3000;
  await waitForPortOpen(port, { host });
  await waitForApiHealth(host, port);
  await waitForAuthReadiness(host, port);

  // Hint: Use `globalThis` to pass variables to global teardown.
  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};

async function waitForApiHealth(host: string, port: number): Promise<void> {
  const timeoutMs = 30_000;
  const pollIntervalMs = 500;
  const deadline = Date.now() + timeoutMs;
  const url = `http://${host}:${port}/api/health`;
  let lastErrorMessage = 'health endpoint did not return 200';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastErrorMessage = `HTTP ${response.status}`;
    } catch (error) {
      lastErrorMessage = (error as Error).message;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Timed out waiting for API health endpoint at ${url}. Last error: ${lastErrorMessage}`,
  );
}

async function waitForAuthReadiness(host: string, port: number): Promise<void> {
  const timeoutMs = 30_000;
  const pollIntervalMs = 500;
  const deadline = Date.now() + timeoutMs;
  const url = `http://${host}:${port}/api/auth/login`;
  let lastErrorMessage = 'auth endpoint did not return 201';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@cosmic.local',
          password: 'Password123!',
        }),
      });

      if (response.status === 201) {
        return;
      }

      // 401 indicates auth route is reachable; keep waiting for transient startup conditions.
      lastErrorMessage = `HTTP ${response.status}`;
    } catch (error) {
      lastErrorMessage = (error as Error).message;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Timed out waiting for auth readiness at ${url}. Last error: ${lastErrorMessage}`,
  );
}

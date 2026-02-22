#!/usr/bin/env node

/**
 * Pull or refresh the configured Ollama model.
 */

const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11435';
const model = process.env.OLLAMA_MODEL || 'qwen3:8b';
const timeoutMs = Number(process.env.OLLAMA_GENERATE_TIMEOUT_MS || 120000);

const start = Date.now();

function fail(message, details) {
  console.error(`\n[llm:pull] FAIL: ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

async function main() {
  console.log(`[llm:pull] Endpoint: ${baseUrl}`);
  console.log(`[llm:pull] Model: ${model}`);

  const { controller, timer } = withTimeout(timeoutMs);
  try {
    const resp = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
      }),
    });
    if (!resp.ok) {
      fail(`Ollama /api/pull returned HTTP ${resp.status}`);
    }
    const json = await resp.json();
    if (json?.status && typeof json.status === 'string') {
      console.log(`[llm:pull] ${json.status}`);
    }
    const elapsed = Date.now() - start;
    console.log(`[llm:pull] PASS in ${elapsed}ms`);
  } catch (err) {
    fail(
      `Unable to pull model "${model}" from ${baseUrl}.`,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }
}

await main();

#!/usr/bin/env node

/**
 * List locally available Ollama models from the configured endpoint.
 */

const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11435';
const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 30000);

function fail(message, details) {
  console.error(`\n[llm:models] FAIL: ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

async function main() {
  console.log(`[llm:models] Endpoint: ${baseUrl}`);
  const { controller, timer } = withTimeout(timeoutMs);
  try {
    const resp = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) {
      fail(`Ollama /api/tags returned HTTP ${resp.status}`);
    }
    const json = await resp.json();
    const models = Array.isArray(json?.models) ? json.models : [];
    if (!models.length) {
      console.log('[llm:models] No models available.');
      return;
    }
    console.log('[llm:models] Available models:');
    for (const model of models) {
      if (typeof model?.name === 'string') {
        console.log(`- ${model.name}`);
      }
    }
  } catch (err) {
    fail(
      `Unable to query models from ${baseUrl}.`,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }
}

await main();

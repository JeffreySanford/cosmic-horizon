#!/usr/bin/env node

/**
 * Local LLM readiness smoke check.
 *
 * Verifies:
 * 1) Ollama endpoint is reachable
 * 2) expected model is available
 * 3) simple non-stream generation succeeds (optional in quick mode)
 */

const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11435';
const model = process.env.OLLAMA_MODEL || 'qwen3:8b';
const quickMode =
  process.argv.includes('--quick') || process.env.OLLAMA_SMOKE_QUICK === 'true';
const tagsTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 30000);
const generateTimeoutMs = Number(
  process.env.OLLAMA_GENERATE_TIMEOUT_MS || 120000,
);

const start = Date.now();

function fail(message, details) {
  console.error(`\n[llm:smoke] FAIL: ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

async function checkTags() {
  const { controller, timer } = withTimeout(tagsTimeoutMs);
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
    const names = models
      .map((m) => (typeof m?.name === 'string' ? m.name : ''))
      .filter(Boolean);
    if (!names.includes(model)) {
      fail(
        `Expected model "${model}" not found in Ollama model list.`,
        `Available models: ${names.length ? names.join(', ') : '(none)'}\nTip: run warmup service or set OLLAMA_MODEL to an available model.`,
      );
    }
    return names;
  } catch (err) {
    fail(
      `Unable to reach Ollama at ${baseUrl}.`,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }
}

async function checkGenerate() {
  const { controller, timer } = withTimeout(generateTimeoutMs);
  try {
    const resp = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt:
          'Respond with exactly this JSON: {"ok":true,"service":"ollama"}',
        stream: false,
        options: {
          temperature: 0,
        },
      }),
    });
    if (!resp.ok) {
      fail(`Ollama /api/generate returned HTTP ${resp.status}`);
    }
    const json = await resp.json();
    const text = typeof json?.response === 'string' ? json.response : '';
    if (!text) {
      fail('Ollama generation response was empty.');
    }
  } catch (err) {
    fail(
      `Generation smoke check failed for model "${model}".`,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`[llm:smoke] Checking endpoint: ${baseUrl}`);
  console.log(`[llm:smoke] Expected model: ${model}`);
  if (quickMode) {
    console.log('[llm:smoke] Mode: quick (tags/model check only)');
  }
  await checkTags();
  if (!quickMode) {
    await checkGenerate();
  }
  const elapsed = Date.now() - start;
  console.log(`[llm:smoke] PASS in ${elapsed}ms`);
}

await main();

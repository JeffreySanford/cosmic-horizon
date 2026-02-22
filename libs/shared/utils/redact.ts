export function redactHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const sensitive = ['authorization', 'x-api-key', 'x-access-token'];
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (sensitive.includes(k.toLowerCase())) {
      result[k] = '<REDACTED>';
    } else {
      result[k] = v;
    }
  }
  return result;
}

export function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const cloned: Record<string, unknown> = JSON.parse(JSON.stringify(body));
  function recurse(obj: Record<string, unknown>) {
    for (const key of Object.keys(obj)) {
      const current = obj[key];
      if (current && typeof current === 'object') {
        recurse(current as Record<string, unknown>);
      } else if (/(token|secret|password)/i.test(key)) {
        obj[key] = '<REDACTED>';
      }
    }
  }
  recurse(cloned);
  return cloned;
}

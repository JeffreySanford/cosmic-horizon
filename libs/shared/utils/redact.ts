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

export function redactBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const cloned = JSON.parse(JSON.stringify(body));
  function recurse(obj: any) {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object') {
        recurse(obj[key]);
      } else if (/(token|secret|password)/i.test(key)) {
        obj[key] = '<REDACTED>';
      }
    }
  }
  recurse(cloned);
  return cloned;
}

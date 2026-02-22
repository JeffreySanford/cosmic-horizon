import { redactHeaders, redactBody } from './redact';

describe('redaction utilities', () => {
  it('should redact sensitive headers', () => {
    const hdrs = { Authorization: 'Bearer secret', foo: 'bar' };
    const out = redactHeaders(hdrs);
    expect(out.Authorization).toBe('<REDACTED>');
    expect(out.foo).toBe('bar');
  });

  it('should redact tokens and secrets from body', () => {
    const b = { token: 'abc', nested: { secret_key: 'xyz', keep: 1 } };
    const r = redactBody(b);
    expect(r.token).toBe('<REDACTED>');
    expect(r.nested.secret_key).toBe('<REDACTED>');
    expect(r.nested.keep).toBe(1);
  });
});
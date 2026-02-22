import { transitionState } from './job-state';
// reuse enum defined in job-state.ts
import { CanonicalJobStatus } from './job-state';

describe('Job state transitions', () => {
  it('allows proper forward transitions', () => {
    let state = { status: CanonicalJobStatus.SUBMITTED };
    state = transitionState(state, CanonicalJobStatus.QUEUED);
    expect(state.status).toBe(CanonicalJobStatus.QUEUED);
    state = transitionState(state, CanonicalJobStatus.RUNNING);
    expect(state.status).toBe(CanonicalJobStatus.RUNNING);
    state = transitionState(state, CanonicalJobStatus.SUCCEEDED);
    expect(state.status).toBe(CanonicalJobStatus.SUCCEEDED);
  });

  it('ignores illegal backward transitions', () => {
    const state = { status: CanonicalJobStatus.SUCCEEDED };
    const next = transitionState(state, CanonicalJobStatus.RUNNING);
    expect(next.status).toBe(CanonicalJobStatus.SUCCEEDED);
  });

  it('is idempotent on same status', () => {
    const state = { status: CanonicalJobStatus.RUNNING };
    const next = transitionState(state, CanonicalJobStatus.RUNNING);
    expect(next).toBe(state);
  });
});

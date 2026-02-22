// canonical statuses duplicated from backend tacc-integration.service.ts
export enum CanonicalJobStatus {
  SUBMITTED = 'SUBMITTED',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  UNKNOWN = 'UNKNOWN',
}

export interface JobState {
  status: CanonicalJobStatus;
}

// allowed transitions
const allowed: Record<CanonicalJobStatus, CanonicalJobStatus[]> = {
  [CanonicalJobStatus.SUBMITTED]: [CanonicalJobStatus.QUEUED],
  [CanonicalJobStatus.QUEUED]: [CanonicalJobStatus.RUNNING, CanonicalJobStatus.CANCELED],
  [CanonicalJobStatus.RUNNING]: [CanonicalJobStatus.SUCCEEDED, CanonicalJobStatus.FAILED, CanonicalJobStatus.CANCELED],
  [CanonicalJobStatus.SUCCEEDED]: [],
  [CanonicalJobStatus.FAILED]: [],
  [CanonicalJobStatus.CANCELED]: [],
  [CanonicalJobStatus.UNKNOWN]: Object.values(CanonicalJobStatus),
};

export function transitionState(
  current: JobState,
  nextStatus: CanonicalJobStatus,
): JobState {
  if (current.status === nextStatus) {
    return current; // idempotent
  }
  const allowedList = allowed[current.status] || [];
  if (allowedList.includes(nextStatus)) {
    return { status: nextStatus };
  }
  // disallowed transition: ignore
  return current;
}

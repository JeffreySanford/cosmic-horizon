import axios, { AxiosError } from 'axios';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type JobStatus = 'QUEUED' | 'QUEUING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface JobRecord {
  id: string;
  user_id: string;
  agent: string;
  dataset_id: string;
  status: JobStatus;
  progress: number;
  params: Record<string, string | number | boolean | undefined>;
  result?: {
    output_url?: string;
    metrics?: Record<string, number | string>;
    error_message?: string;
  };
}

interface DatasetRecord {
  id: string;
  label: string;
  lastUpdated: string;
}

interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

const TERMINAL_STATUSES = new Set<JobStatus>(['COMPLETED', 'FAILED', 'CANCELLED']);
jest.setTimeout(40000);

async function loginSeededUser(): Promise<string> {
  const response = await axios.post<LoginResponse>('/api/auth/login', {
    email: 'test@cosmic.local',
    password: 'Password123!',
  });
  expect(response.status).toBe(201);
  return response.data.access_token;
}

async function waitForTerminalJobStatus(
  jobId: string,
  authHeader: Record<string, string>,
  maxAttempts = 60,
  delayMs = 250,
): Promise<JobRecord> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const statusResponse = await axios.get<JobRecord>(`/api/jobs/${jobId}/status`, {
      headers: authHeader,
    });
    expect(statusResponse.status).toBe(200);

    const job = statusResponse.data;
    if (TERMINAL_STATUSES.has(job.status)) {
      return job;
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  }

  throw new Error(`Job ${jobId} did not reach terminal status within ${maxAttempts} polls`);
}

describe('jobs path e2e', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    const token = await loginSeededUser();
    authHeader = { Authorization: `Bearer ${token}` };
  });

  it('submits a valid job against a seeded dataset and reaches COMPLETED', async () => {
    const datasetId = `e2e-pass-dataset-${Date.now()}`;
    const datasetDir = resolve(process.cwd(), 'astronomy-data', datasetId);

    await mkdir(datasetDir, { recursive: true });
    await writeFile(
      resolve(datasetDir, 'README.txt'),
      'e2e seeded dataset fixture for positive jobs path',
      'utf8',
    );

    const refreshResponse = await axios.post<DatasetRecord[]>('/api/datasets/refresh', undefined, {
      headers: authHeader,
    });
    expect(refreshResponse.status).toBe(201);
    expect(refreshResponse.data.some((dataset) => dataset.id === datasetId)).toBe(true);

    const submitResponse = await axios.post<JobRecord>(
      '/api/jobs/submit',
      {
        agent: 'AlphaCal',
        dataset_id: datasetId,
        params: {
          gpu_count: 1,
          rfi_strategy: 'low',
          target_name: 'M87',
          product_goal: 'science-ready image',
        },
      },
      { headers: authHeader },
    );
    expect(submitResponse.status).toBe(201);
    expect(submitResponse.data.id).toBeTruthy();

    const terminalJob = await waitForTerminalJobStatus(submitResponse.data.id, authHeader);
    expect(terminalJob.status).toBe('COMPLETED');
    expect(terminalJob.result?.output_url).toEqual(expect.any(String));
  });

  it('submits a known failing job, then verifies FAILED terminal status and reason', async () => {
    const failingDatasetId = `quota-trigger-${Date.now()}`;

    let submitStatus: number | null = null;
    try {
      await axios.post(
        '/api/jobs/submit',
        {
          agent: 'AlphaCal',
          dataset_id: failingDatasetId,
          params: {
            gpu_count: 1,
            rfi_strategy: 'medium',
            target_name: 'M51',
          },
        },
        { headers: authHeader },
      );
      throw new Error('Expected failing job submission to return 500');
    } catch (error) {
      const submitError = error as AxiosError<{ message?: string }>;
      submitStatus = submitError.response?.status ?? null;
    }

    expect(submitStatus).toBe(500);

    let failedJob: JobRecord | undefined;
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const historyResponse = await axios.get<{ jobs: JobRecord[]; total: number }>(
        '/api/jobs/history/list?limit=100&offset=0',
        { headers: authHeader },
      );
      expect(historyResponse.status).toBe(200);
      failedJob = historyResponse.data.jobs.find((job) => job.dataset_id === failingDatasetId);
      if (failedJob) {
        break;
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }

    expect(failedJob).toBeDefined();
    if (!failedJob) {
      throw new Error('Expected failed job record to exist in history');
    }
    const terminalJob = await waitForTerminalJobStatus(failedJob.id, authHeader);
    expect(terminalJob.status).toBe('FAILED');
    expect(terminalJob.result?.error_message).toContain('Queue is full / quota exceeded');
  });
});

# Engineering Spike: TACC Remote Job Orchestration

**Status:** Research / Initial Draft
**Contact:** CosmicAI Integration Team
**Target Platform:** TACC (Texas Advanced Computing Center) Open-Source AI Platform

## 1. Objective

Define the API contracts and communication protocols for the VLASS Portal to trigger and monitor AI-reprocessing jobs on TACC-scale resources.

## 2. Proposed Architecture

The Portal (`vlass-api`) will act as a client to the TACC API Gateway.

```mermaid
sequenceDiagram
    participant User
    participant Portal (Web)
    participant API (NestJS)
    participant TACC (Job Queue)
    participant Worker (GPU)

    User->>Portal: Configures Job (e.g., Reprocess Cutout)
    Portal->>API: POST /api/jobs/submit
    API->>TACC: Auth & Submit sbatch/Singularity
    TACC-->>API: JobID: 99821
    API-->>Portal: Job Queued (ID: 99821)
    
    loop Status Polling
        API->>TACC: GET /status/99821
        TACC-->>API: RUNNING | COMPLETED
    end

    Worker->>Portal: Write SRDP to S3/Archive
    API->>User: Notify (Socket.io)
```

## 3. API Contract Draft

### Submit Job

`POST /api/jobs/submit`
**Payload:**

```json
{
  "agent": "AlphaCal",
  "dataset_id": "VLASS2.1.eb123456",
  "params": {
    "rfi_strategy": "high_sensitivity",
    "gpu_count": 2,
    "max_runtime": "04:00:00"
  },
  "webhook_url": "https://vlass-portal.org/api/webhooks/tacc"
}
```

### Get Status

`GET /api/jobs/:id/status`
**Response:**

```json
{
  "id": "99821",
  "status": "QUEUED | RUNNING | COMPLETED | FAILED",
  "progress": 0.45,
  "metrics": {
    "vram_usage": "14GB",
    "visibilities_processed": "4.5B"
  },
  "output_url": "https://archive.vla.nrao.edu/..."
}
```

### Cancel Job

`DELETE /api/jobs/:id`

## 4. Security & Authentication

- **OAuth2/OIDC:** Portal retrieves short-lived TACC tokens via delegated credentials.
- **Resource Quotas:** API-level enforcement of TACC SUs (Service Units) per user.

## 5. Next Steps

- [ ] Implement `TaccIntegrationService` in `vlass-api`.
- [ ] Scaffold `vlass-api/src/app/jobs` module.
- [ ] Validate TACC API Gateway connectivity via sandbox environment.

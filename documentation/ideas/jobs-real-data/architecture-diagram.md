# Cosmic Horizon Real-Data Jobs Architecture

This document integrates the real-data jobs architecture into one reference
view for `documentation/ideas/jobs-real-data/`. It combines the gateway
topology, the job lifecycle state machine, and an HPC-grade control-plane
overlay that introduces policy, auditability, and streaming updates.

## Scope and Intent

- This is a **reference architecture prototype**, not production.
- The design keeps the existing NestJS + Angular stack and `TaccAdapter` contract.
- It supports mode-based backends (`demo`, `local-llm`, `astronomy`) without UI rewrites.
- It prioritizes async orchestration, persistent state, and safe artifact serving.

## Diagram 1: End-to-End Compute Gateway

This view shows runtime components and data/control flows across frontend,
API, adapters, queue/worker, storage, and external systems.

```mermaid
flowchart LR
  %% ---------- Frontend ----------
  subgraph FE["Frontend (Angular + NgRx)"]
    FE1[Jobs Console]
    FE2[Dataset Selector]
    FE3[Job List + Cancel]
    FE4[Telemetry Tiles]
  end

  %% ---------- API ----------
  subgraph API["NestJS API Gateway"]
    AP1[JobsController]
    AP2[DatasetsController]
    AP3[TaccIntegrationService]
    AP4[Adapter Factory]
    AP5[JobManifestService]
    AP6[EventsModule]
    AP7[File Serving Module]
    AP8[Metrics Endpoint]
  end

  %% ---------- Adapters ----------
  subgraph ADP["Adapter Layer"]
    AD1[DemoTaccAdapter]
    AD2[LocalLlmAdapter]
    AD3[CasaAdapter]
  end

  %% ---------- Queue + Worker ----------
  subgraph QW["Queue and Worker Plane"]
    Q1[Redis Stream or List]
    Q2[Worker Runner]
    Q3[Retry and Backoff]
    Q4[Heartbeat Updater]
  end

  %% ---------- Compute ----------
  subgraph CMP["Compute Runtime"]
    C1[docker run --rm CASA]
    C2[Optional WSClean]
    C3[Astro Metadata Helper]
  end

  %% ---------- Data ----------
  subgraph DATA["State and Artifacts"]
    D1[(Redis Job Manifest)]
    D2[(Postgres Job History)]
    D3["astronomy-data (measurement sets)"]
    D4["results (FITS artifacts)"]
  end

  %% ---------- External ----------
  subgraph EXT["External Systems"]
    X1[Kafka or RabbitMQ]
    X2[TACC Slurm Cloud Adapter Target]
  end

  FE1 -->|POST /jobs/submit| AP1
  FE2 -->|GET /api/datasets| AP2
  FE3 -->|DELETE /jobs/:id| AP1
  FE4 -->|GET /metrics| AP8

  AP1 --> AP3
  AP2 --> AP3
  AP3 --> AP4
  AP3 --> AP5
  AP3 --> AP6
  AP3 --> AP7

  AP4 --> AD1
  AP4 --> AD2
  AP4 --> AD3

  AD3 -->|enqueue job| Q1
  AD3 -->|persist queued state| D1
  AD3 -->|mirror summary| D2

  Q1 --> Q2
  Q2 --> Q3
  Q2 --> Q4
  Q2 --> C1
  Q2 --> C2
  Q2 --> C3

  C1 -->|read input| D3
  C1 -->|write outputs| D4
  Q4 -->|status/progress| D1
  Q2 -->|final state| D2

  AP5 --> D1
  AP5 --> D2
  AP7 -->|allowlisted stream| D4
  AP6 --> X1
  AD3 --> X2

  click AP3 "documentation/ideas/jobs-real-data/backend-adapter-design.md" "Adapter orchestration details"
  click FE2 "documentation/ideas/jobs-real-data/frontend-enhancements.md" "Dataset UI details"
  click D3 "documentation/ideas/jobs-real-data/dataset-acquisition.md" "Dataset acquisition details"
  click Q1 "documentation/ideas/jobs-real-data/phases-and-steps.md" "Queue and worker rollout"
```

## Diagram 2: Job Lifecycle and Endpoint Behavior

This state machine defines deterministic transitions for status, timeout,
failure, cancellation, and result/file endpoint behavior.

```mermaid
stateDiagram-v2
  [*] --> VALIDATING: POST /jobs/submit

  VALIDATING: validate request\ndataset exists\nmode enabled\nschema valid\ndisk threshold check
  VALIDATING --> REJECTED: validation fails
  VALIDATING --> REGISTERED: jobId assigned\nmanifest created

  REGISTERED --> QUEUED: push queue message

  QUEUED: queue depth tracked\nretry budget initialized\ncancel token watch
  QUEUED --> RUNNING: worker claims lock
  QUEUED --> CANCELED: user cancels before start

  RUNNING: container launched\nheartbeat updates\nstdout stderr capture
  RUNNING --> COMPLETED: outputs validated\nchecksums recorded
  RUNNING --> FAILED: non-zero exit or exception
  RUNNING --> TIMED_OUT: runtime budget exceeded
  RUNNING --> CANCELED: cancel signal observed

  COMPLETED: result URL set\nartifacts registered
  FAILED: error code/message\nlog pointers recorded
  TIMED_OUT: timeout reason\npartial logs recorded
  CANCELED: canceledBy and cleanup status
  REJECTED: validation errors returned

  state "GET /jobs/status/:id" as STATUS {
    [*] --> READ_MANIFEST
    READ_MANIFEST --> MAP_TO_API
    MAP_TO_API --> [*]
  }

  state "GET /jobs/result/:id" as RESULT {
    [*] --> CHECK_COMPLETED
    CHECK_COMPLETED --> RETURN_READY: state is COMPLETED
    CHECK_COMPLETED --> RETURN_NOT_READY: state is not COMPLETED
    RETURN_READY --> [*]
    RETURN_NOT_READY --> [*]
  }

  state "GET /files/:id" as FILES {
    [*] --> ALLOWLIST_LOOKUP
    ALLOWLIST_LOOKUP --> STREAM_FITS: safe mapping exists
    ALLOWLIST_LOOKUP --> DENY: invalid mapping
    STREAM_FITS --> [*]
    DENY --> [*]
  }

  COMPLETED --> STATUS
  FAILED --> STATUS
  TIMED_OUT --> STATUS
  CANCELED --> STATUS
  REJECTED --> STATUS
  COMPLETED --> RESULT
  COMPLETED --> FILES
```

## Diagram 3: HPC-Grade Control Plane Overlay

This overlay adds the extra control-plane components needed for stronger
operational parity with HPC gateway patterns: policy enforcement, audit log,
streaming job updates, and artifact registry/provenance.

```mermaid
flowchart TB
  subgraph UX["User Experience Plane"]
    U1[Angular Jobs UI]
    U2[Realtime Job Timeline]
    U3[Dataset Governance Panel]
  end

  subgraph CTRL["Control Plane (NestJS)"]
    C1[Gateway API]
    C2[Policy Engine]
    C3[AuthN AuthZ and Quotas]
    C4[Audit Event Emitter]
    C5[SSE or WebSocket Stream]
  end

  subgraph ORCH["Orchestration Plane"]
    O1[Adapter Factory]
    O2[Queue Broker]
    O3[Worker Pool]
    O4[Scheduler Bridge]
  end

  subgraph DATA["Data and Provenance Plane"]
    D1[(Job Manifest Store)]
    D2[(Audit Log - append only)]
    D3[(Artifact Registry)]
    D4[/FITS + metadata + hash/]
    D5[/MS dataset manifest + attribution/]
  end

  subgraph HPC["Execution Targets"]
    H1[Local CASA Containers]
    H2[Kubernetes Jobs]
    H3[Slurm or TACC]
  end

  U1 --> C1
  U2 --> C5
  U3 --> C1

  C1 --> C2
  C2 --> C3
  C1 --> O1
  C1 --> C4
  C1 --> C5

  O1 --> O2
  O2 --> O3
  O3 --> O4
  O4 --> H1
  O4 --> H2
  O4 --> H3

  C1 --> D1
  C4 --> D2
  O3 --> D1
  O3 --> D3
  D3 --> D4
  C1 --> D5

  D1 --> C5
  D2 --> U2
  D3 --> U1
```

## Implementation Notes

- Avoid synchronous `docker exec` in API request flow; use queue + worker.
- Treat job manifest as source-of-truth for status, progress, and errors.
- Keep artifact serving allowlisted to mapped outputs only.
- Keep dataset attribution metadata alongside manifest records.
- Keep CI paths lightweight by default; gate heavy astronomy tests behind opt-in flags.

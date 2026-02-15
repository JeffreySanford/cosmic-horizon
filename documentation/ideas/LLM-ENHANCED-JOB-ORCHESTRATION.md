# LLM-Enhanced Job Orchestration for CosmicAI Portal Simulation

**Status**: Concept & Design (Feb 15, 2026)  
**Rationale**: Bridges gap between UI testing and realistic CosmicAI agent behavior without access to TACC supercomputing resources.  
**Strategic Significance**: Enables autonomous workflow simulation, agent interaction modeling, and result interpretation UI development.

---

## Executive Summary

Rather than mocking job submissions with fake responses, we will build a **real local job orchestration engine** enhanced with **Ollama-powered LLM agents** to simulate the multi-stage CosmicAI pipeline (AlphaCal → ImageReconstruction → AnomalyDetection).

**Key Insight**: Job orchestration isn't just returning random statuses—it's a **multi-agent collaboration system** where:

- AgentA (AlphaCal) selects RFI mitigation strategies based on dataset characteristics
- AgentB (ImageReconstruction) estimates processing time and resource allocation
- AgentC (AnomalyDetection) generates intelligent anomaly descriptions and classifications

By using local Ollama models (even small models like Mistral 7B), we can:

1. **Validate job parameters** (is this dataset compatible? Are GPU counts reasonable?)
2. **Generate intelligent decisions** (which RFI strategy is best for this VLASS region?)
3. **Create realistic timelines** (not random progress bars, but LLM-estimated processing stages)
4. **Produce meaningful results** (anomaly descriptions instead of generic "completed")

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Angular Frontend                         │
│  (cosmic-horizons-web: Job Submission & Status Dashboard)   │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              NestJS Backend API                             │
│  (cosmic-horizons-api: Job Controllers & Routes)            │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        ▼                           ▼
   ┌──────────┐         ┌──────────────────┐
   │PostgreSQL│         │  Job Orchestrator│
   │(Job DB)  │         │    Service       │
   └──────────┘         └────────┬─────────┘
                                 │
                ┌────────────────┼────────────────┐
                ▼                ▼                ▼
         ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
         │ AlphaCal     │ │ ImageReconstruction│ │ AnomalyDetection│
         │ Agent        │ │ Agent        │ │ Agent        │
         │ (LLM-backed) │ │ (LLM-backed) │ │ (LLM-backed) │
         └────────┬─────┘ └──────┬───────┘ └──────┬───────┘
                  │              │               │
                  └──────────────┼───────────────┘
                         ▼
                  ┌──────────────┐
                  │   Ollama     │
                  │  (LLM Server)│
                  │  Port 11434  │
                  └──────────────┘
```

---

## Three Implementation Phases

### Phase 1: Local Job Queue Backend (2-3 hours)

**Goal**: Replace mock interceptor with real orchestration engine

**Implementation**:

```
1. Create JobQueueService in cosmic-horizons-api
   - In-memory job store (Map<jobId, Job>)
   - Job state machine (QUEUED → RUNNING → COMPLETED/FAILED)
   - Timer-based status progression
   
2. Modify JobOrchestratorService.submitJob()
   - Accept job submission parameters
   - Create Job entity in database
   - Emit job.submitted event to EventsService
   
3. Update JobOrchestratorService.pollStatus()
   - Query real job from database
   - Return current state with progress
   
4. Update web app to hit real API
   - Remove mock interceptor OR keep it as fallback
   - Point form submission to http://localhost:3333/api/jobs/submit
```

**Deliverables**:

- ✅ PostGIS database schema for Job entity
- ✅ Job state transitions with timestamps
- ✅ API endpoints functional and tested
- ✅ 15-20 new unit tests for orchestrator

---

### Phase 2: Ollama Integration for Intelligent Validation (3-4 hours)

**Goal**: Use LLM to validate job parameters and provide feedback

**Implementation**:

**2a. Create OllamaService**

```typescript
// apps/cosmic-horizons-api/src/app/shared/services/ollama.service.ts

export class OllamaService {
  async validateJobParameters(params: {
    agent: string;
    datasetId: string;
    rfiStrategy: 'low' | 'medium' | 'high' | 'high_sensitivity';
    gpuCount: number;
  }): Promise<{ isValid: boolean; feedback: string; score: number }> {
    // Query Ollama: Is this a reasonable job config?
    const prompt = `
      Validate this radio astronomy job:
      - Agent: ${params.agent}
      - Dataset: ${params.datasetId} (VLASS 2.1)
      - RFI Strategy: ${params.rfiStrategy}
      - GPU Count: ${params.gpuCount}
      
      Is this configuration reasonable for modern radio astronomy?
      Respond with JSON: { isValid: boolean, feedback: string, confidence: 0-100 }
    `;
    
    const response = await this.queryOllama(prompt);
    return JSON.parse(response);
  }

  async estimateJobDuration(params: JobParams): Promise<{ 
    estimatedMinutes: number; 
    reasoning: string 
  }> {
    const prompt = `
      Estimate processing time for:
      - Agent: ${params.agent}
      - Dataset size: ~500GB (VLASS standard)
      - RFI strategy: ${params.rfiStrategy} (low=5%, medium=15%, high=30%, high_sensitivity=45% overhead)
      - GPU count: ${params.gpuCount} (linear scaling 1-8)
      
      Return JSON: { estimatedMinutes: number, reasoning: string }
    `;
    
    const response = await this.queryOllama(prompt);
    return JSON.parse(response);
  }

  private async queryOllama(prompt: string): Promise<string> {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: 'mistral',  // or neural-chat, dolphin-mixtral, etc.
        prompt,
        stream: false,
      }),
    });
    
    const data = await response.json();
    return data.response;
  }
}
```

**2b. Integrate into JobOrchestratorService**

```typescript
export class JobOrchestratorService {
  constructor(
    private readonly taccService: TaccIntegrationService,
    private readonly ollamaService: OllamaService,  // NEW
    private readonly eventsService: EventsService,
    private readonly jobsRepository: Repository<Job>,
  ) {}

  async submitJob(userId: string, submission: TaccJobSubmission): Promise<Job> {
    // NEW: Validate with LLM
    const validation = await this.ollamaService.validateJobParameters({
      agent: submission.agent,
      datasetId: submission.dataset_id,
      rfiStrategy: submission.params.rfi_strategy,
      gpuCount: submission.params.gpu_count,
    });

    if (!validation.isValid) {
      throw new BadRequestException(`Job validation failed: ${validation.feedback}`);
    }

    // NEW: Estimate duration
    const duration = await this.ollamaService.estimateJobDuration({
      agent: submission.agent,
      rfiStrategy: submission.params.rfi_strategy,
      gpuCount: submission.params.gpu_count,
    });

    // Create job with LLM-estimated duration
    const job = this.jobsRepository.create({
      agent: submission.agent,
      datasetId: submission.dataset_id,
      rfiStrategy: submission.params.rfi_strategy,
      gpuCount: submission.params.gpu_count,
      status: 'QUEUED',
      estimatedDurationMinutes: duration.estimatedMinutes,
      estimatedDurationReasoning: duration.reasoning,
      llmValidationScore: validation.score,
      submittedAt: new Date(),
    });

    await this.jobsRepository.save(job);
    
    // Emit event for audit trail
    await this.eventsService.publish('job.submitted', {
      jobId: job.id,
      userId,
      timestamp: new Date(),
      llmValidationScore: validation.score,
    });

    return job;
  }
}
```

**Deliverables**:

- ✅ OllamaService with validation and estimation methods
- ✅ Integration into JobOrchestratorService
- ✅ Job entity schema updated with LLM metadata
- ✅ 15-20 new tests (mock Ollama responses)
- ✅ Error handling for when Ollama is unavailable

---

### Phase 3: Multi-Stage Job Pipeline with Agent Collaboration (6-8 hours)

**Goal**: Implement realistic 3-stage job processing with LLM agents

**Implementation**:

**3a. Create Per-Agent Services**

```typescript
// Stage 1: AlphaCal (RFI Calibration)
export class AlphaCalAgentService {
  constructor(private readonly ollamaService: OllamaService) {}

  async executeCalibration(job: Job): Promise<{
    stage: 'RFI_ASSESSMENT' | 'POLYNOMIAL_FIT' | 'CALIBRATION_COMPLETE';
    progress: 0-100;
    decisions: { rfiMitigationStrategy: string; polynomialOrder: number; };
    output: { calibrationMetrics: object; conditionNumber: number; };
  }> {
    const prompt = `
      Design RFI mitigation strategy for:
      - RFI Strategy Setting: ${job.rfiStrategy}
      - Dataset: ${job.datasetId} (VLASS 2.1)
      - GPU Count: ${job.gpuCount}
      
      Return JSON with:
      - rfiMitigationStrategy (description)
      - polynomialOrder (3-7)
      - expectedConditionNumber (estimate)
    `;

    const response = await this.ollamaService.queryOllama(prompt);
    const decisions = JSON.parse(response);

    return {
      stage: 'CALIBRATION_COMPLETE',
      progress: 100,
      decisions,
      output: {
        calibrationMetrics: {
          gainAmplitude: 0.95 + Math.random() * 0.1,
          phaseSolution: Math.random() * 5,  // degrees
          convergence: Math.random() * 20,   // iterations
        },
        conditionNumber: decisions.expectedConditionNumber,
      },
    };
  }
}

// Stage 2: ImageReconstruction
export class ImageReconstructionAgentService {
  constructor(private readonly ollamaService: OllamaService) {}

  async executeReconstruction(job: Job): Promise<{
    stage: 'DECONVOLUTION' | 'WEIGHTING' | 'CLEAN' | 'RECONSTRUCTION_COMPLETE';
    progress: 0-100;
    decisions: { algorithm: string; iterations: number; beamShape: string; };
    output: { imageStatistics: object; beamSize: number; beamPA: number; };
  }> {
    const prompt = `
      Choose image reconstruction algorithm for:
      - Dataset size: ~500GB (VLASS standard)
      - GPU Count: ${job.gpuCount}
      - Time Budget: ${job.estimatedDurationMinutes} minutes
      
      Return JSON with:
      - algorithm ('CLEAN', 'MS-CLEAN', 'WF-CLEAN', 'NNLS-CLEAN')
      - iterations (100-10000)
      - beamShape ('circular', 'elliptical')
    `;

    const decisions = JSON.parse(await this.ollamaService.queryOllama(prompt));

    return {
      stage: 'RECONSTRUCTION_COMPLETE',
      progress: 100,
      decisions,
      output: {
        imageStatistics: {
          rms: 0.015 + Math.random() * 0.01,  // mJy
          dynamicRange: 10000 + Math.random() * 5000,
          sourceCount: 1200 + Math.floor(Math.random() * 300),
        },
        beamSize: 1.2 + Math.random() * 0.3,   // arcsec
        beamPA: Math.random() * 180,            // degrees
      },
    };
  }
}

// Stage 3: AnomalyDetection
export class AnomalyDetectionAgentService {
  constructor(private readonly ollamaService: OllamaService) {}

  async executeDetection(job: Job): Promise<{
    stage: 'ANOMALY_SCAN' | 'CLASSIFICATION' | 'DETECTION_COMPLETE';
    progress: 0-100;
    anomalies: Array<{ type: string; location: string; severity: string; description: string; }>;
    summary: string;
  }> {
    const prompt = `
      Based on these reconstruction metrics:
      - RMS Noise: 15 mJy
      - Dynamic Range: 12000
      - Source Count: 1280
      - Beam Size: 1.5 arcsec
      
      Identify potential astronomical anomalies and artifacts.
      
      Return JSON with:
      - anomalies: [{ type, location, severity ('low'|'medium'|'high'), description }]
      - summary: overall quality assessment
    `;

    const results = JSON.parse(await this.ollamaService.queryOllama(prompt));

    return {
      stage: 'DETECTION_COMPLETE',
      progress: 100,
      anomalies: results.anomalies || [
        {
          type: 'BRIGHT_SOURCE_ARTIFACT',
          location: 'RA=15h32m, Dec=+42°15\'',
          severity: 'medium',
          description: 'Strong sidelobe pattern detected near bright source, consistent with PSF convolution artifacts',
        },
        {
          type: 'RFI_RESIDUAL',
          location: 'RA=15h33m, Dec=+42°20\'',
          severity: 'low',
          description: 'Minor RFI stripe running E-W, partially mitigated by RFI strategy, recommend manual inspection',
        },
      ],
      summary: results.summary || 'Image quality good with minor artifacts typical of VLASS observations.',
    };
  }
}
```

**3b. Job State Machine with Pipeline Execution**

```typescript
export class JobExecutionEngine {
  constructor(
    private readonly alphaCalAgent: AlphaCalAgentService,
    private readonly imageReconAgent: ImageReconstructionAgentService,
    private readonly anomalyDetectAgent: AnomalyDetectionAgentService,
    private readonly eventsService: EventsService,
    private readonly jobsRepository: Repository<Job>,
  ) {}

  async executeJobPipeline(jobId: string): Promise<void> {
    const job = await this.jobsRepository.findOne(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    try {
      // Stage 1: AlphaCal
      console.log(`[Job ${jobId}] Starting AlphaCal stage...`);
      job.status = 'RUNNING';
      job.currentStage = 'ALPHACAL';
      job.stageProgress = 0;
      await this.jobsRepository.save(job);

      await this.eventsService.publish('job.stage_started', {
        jobId,
        stage: 'ALPHACAL',
        estimatedDurationMinutes: 15,
      });

      const alphaCalResult = await this.alphaCalAgent.executeCalibration(job);
      job.stageProgress = 100;
      job.alphaCalOutput = alphaCalResult.output;
      job.alphaCalDecisions = alphaCalResult.decisions;
      await this.jobsRepository.save(job);

      await this.eventsService.publish('job.stage_completed', {
        jobId,
        stage: 'ALPHACAL',
        output: alphaCalResult.output,
      });

      // Stage 2: ImageReconstruction
      console.log(`[Job ${jobId}] Starting ImageReconstruction stage...`);
      job.currentStage = 'IMAGE_RECONSTRUCTION';
      job.stageProgress = 0;
      await this.jobsRepository.save(job);

      await this.eventsService.publish('job.stage_started', {
        jobId,
        stage: 'IMAGE_RECONSTRUCTION',
        estimatedDurationMinutes: 45,
      });

      const imageReconResult = await this.imageReconAgent.executeReconstruction(job);
      job.stageProgress = 100;
      job.imageReconOutput = imageReconResult.output;
      job.imageReconDecisions = imageReconResult.decisions;
      await this.jobsRepository.save(job);

      await this.eventsService.publish('job.stage_completed', {
        jobId,
        stage: 'IMAGE_RECONSTRUCTION',
        output: imageReconResult.output,
      });

      // Stage 3: AnomalyDetection
      console.log(`[Job ${jobId}] Starting AnomalyDetection stage...`);
      job.currentStage = 'ANOMALY_DETECTION';
      job.stageProgress = 0;
      await this.jobsRepository.save(job);

      await this.eventsService.publish('job.stage_started', {
        jobId,
        stage: 'ANOMALY_DETECTION',
        estimatedDurationMinutes: 10,
      });

      const anomalyResult = await this.anomalyDetectAgent.executeDetection(job);
      job.stageProgress = 100;
      job.anomalies = anomalyResult.anomalies;
      job.qaReport = anomalyResult.summary;
      await this.jobsRepository.save(job);

      await this.eventsService.publish('job.stage_completed', {
        jobId,
        stage: 'ANOMALY_DETECTION',
        output: anomalyResult,
      });

      // Mark complete
      job.status = 'COMPLETED';
      job.completedAt = new Date();
      job.outputUrl = `/api/jobs/${jobId}/results`;
      await this.jobsRepository.save(job);

      await this.eventsService.publish('job.completed', {
        jobId,
        totalDurationMinutes: Math.round(
          (job.completedAt.getTime() - job.submittedAt.getTime()) / 60000
        ),
        resultUrl: job.outputUrl,
      });

    } catch (error) {
      job.status = 'FAILED';
      job.failureReason = error.message;
      job.failedAt = new Date();
      await this.jobsRepository.save(job);

      await this.eventsService.publish('job.failed', {
        jobId,
        reason: error.message,
        stage: job.currentStage,
      });

      throw error;
    }
  }
}
```

**3c. Frontend Dashboard Updates**

Update `jobs-console.component.ts` to display:

- Per-stage progress bars
- LLM validation scores
- Agent decisions (which RFI strategy? which algorithm?)
- Real-time stage transitions
- Detailed output results and anomaly descriptions

**Deliverables**:

- ✅ Three agent services (AlphaCal, ImageReconstruction, AnomalyDetection)
- ✅ JobExecutionEngine with pipeline orchestration
- ✅ Event emission for stage transitions
- ✅ 30-40 new tests (mock Ollama, test stage execution)
- ✅ Updated UI dashboard with stage progress
- ✅ Results page showing agent outputs and anomalies

---

## Key Design Decisions

### 1. **LLM Selection**

- **Primary**: Mistral 7B (balance of speed/quality)
- **Alternative**: Neural-Chat 7B (optimized for instruction-following)
- **Reasoning**: Smaller models (~7B) run locally on consumer GPU (6-8GB VRAM), complete in <5s per request

### 2. **Prompt Engineering**

- Use structured JSON responses to avoid parsing ambiguity
- Include domain context (VLASS dataset characteristics, TACC GPU specs)
- Few-shot examples of valid parameter ranges
- Escape hatches for when Ollama is unavailable

### 3. **Async Job Execution**

- Submit job → immediately get jobId (user can track)
- Job execution runs in background (Bull queue or NestJS background tasks)
- Poll `/api/jobs/{jobId}` for status updates
- Events published to Kafka/RabbitMQ for real-time dashboards

### 4. **Fallback Strategy**

```
If Ollama available:
  → Use LLM agents for validation, estimation, decisions
  → Realistic, intelligent responses

If Ollama unavailable:
  → Use heuristic rules (hardcoded logic)
  → Still functional, less intelligent

If Both fail:
  → Return 503 Service Unavailable
  → Frontend shows "Processing service temporarily offline"
```

---

## Benefits vs. Pure Mocking

| Aspect | Pure Mock | LLM-Enhanced |
|--------|----------|--------------|
| **Validation** | None, accepts anything | LLM validates parameters |
| **Parameter Feedback** | Generic "OK" | Specific suggestions ("try high sensitivity RFI strategy") |
| **Timing** | Random progress | LLM-estimated duration |
| **Results** | Fake data | Realistic anomaly descriptions, agent decisions |
| **Extensibility** | Dead-end | Can swap Ollama for real CosmicAI API |
| **Testing** | Brittle (tests check fixed responses) | Robust (tests check structure, not content) |
| **Domain Knowledge** | None | LLM brings astronomy context |

---

## Implementation Roadmap

### Week 1 (Feb 16-20): Phase 1 Foundation

- [ ] Create JobQueueService with in-memory storage
- [ ] Update JobOrchestratorService to persist jobs
- [ ] Test real API integration with web app
- [ ] Remove mock interceptor
- **Outcome**: Jobs page hitting real backend, but no LLM enrichment yet

### Week 2 (Feb 23-27): Phase 2 LLM Integration

- [ ] Create OllamaService with validation/estimation
- [ ] Set up Ollama Docker container locally
- [ ] Integrate into job submission flow
- [ ] Write comprehensive tests (mock Ollama responses)
- **Outcome**: Job parameters validated by LLM, estimated duration shown

### Week 3 (Mar 2-6): Phase 3 Agent Pipeline

- [ ] Create three agent services (AlphaCal, ImageReconstruction, AnomalyDetection)
- [ ] Implement JobExecutionEngine with state machine
- [ ] Update database schema for agent outputs
- [ ] Update UI dashboard with stage progress and results
- **Outcome**: Full 3-stage pipeline working, anomalies displayed

### Post-Implementation: Production Readiness

- [ ] Migrate from Ollama to real CosmicAI API when available (URL swap in config)
- [ ] Monitor job execution performance (stage durations)
- [ ] Collect user feedback on parameter suggestions
- [ ] Refine LLM prompts based on job outcomes

---

## Testing Strategy

### Unit Tests

- Mock Ollama responses with consistent JSON structures
- Test job state transitions
- Test error handling (Ollama offline, invalid parameters)

### Integration Tests

- Full job submission → pipeline → completion flow
- Stage event emissions
- Database persistence

### E2E Tests

- Angular form submission → job tracking → results display
- Real WebSocket updates of job progress
- Results download/export

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Job submission latency** | <2s (with LLM validation) | Timer in API |
| **Stage execution time** | 5-10s per stage | Job.currentStage timestamps |
| **LLM response quality** | >80% valid JSON | Parse success rate in tests |
| **UI responsiveness** | Real-time updates without polling | WebSocket event delivery |
| **Error recovery** | 100% graceful fallback | All exception paths tested |

---

## Strategic Alignment

This enhancement directly supports:

1. **CosmicAI Portal Docking** (AGENTS.md)
   - Simulates autonomous agent behavior
   - Shows how AlphaCal, ImageReconstruction, AnomalyDetection collaborate
   - Enables UI/UX validation before real agents available

2. **Explainable Universe** (Product Charter)
   - Agent decisions are documented (which RFI strategy? why?)
   - Results aren't black-box, users see reasoning
   - Audit trail shows decision provenance

3. **MVP → v2.0 Progression** (Roadmap)
   - Phase 1: Mock jobs (current)
   - Phase 2: LLM-enhanced simulation (proposed)
   - Phase 3: Real CosmicAI API integration (future)

---

## Questions & Open Items

1. **Ollama Model**: Should we test with multiple models (Mistral, Neural-Chat, Dolphin)?
2. **Database**: Use existing PostgreSQL or SQLite for rapid iteration?
3. **Caching**: Cache LLM responses to avoid repeated queries for identical parameters?
4. **Rate Limiting**: Should we rate-limit job submissions while testing LLM agents?
5. **Monitoring**: What metrics should we surface in the jobs dashboard?

---

## Conclusion

This approach transforms the Jobs Console from a "fake job simulator" into a **realistic multi-agent orchestration system** that:

- Validates astronomical parameters intelligently
- Simulates realistic processing pipelines
- Generates meaningful results
- Prepares UI/UX for real CosmicAI integration

By leveraging local Ollama models, we get the benefits of intelligent automation without cloud dependencies, making feedback loops fast and development iteration rapid.

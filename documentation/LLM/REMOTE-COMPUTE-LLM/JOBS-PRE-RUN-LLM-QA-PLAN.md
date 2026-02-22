# Jobs View Pre-Run LLM Q&A Plan

Status date: 2026-02-22
Owner: Jobs UX + Remote Compute Gateway team

## Objective

Add an optional "Have Questions?" experience to the Jobs view so users can ask
pre-run questions and get context-aware answers before submitting a job.

Visibility rule:

- Q&A entry point is shown only when the Jobs summary sidebar is expanded.
- Q&A panel opens only after user clicks a "Have Questions?" control.

## Feasibility (Current State)

This is feasible with the existing stack.

Reasons:

- The Jobs UI already captures rich pre-run context (agent, dataset, target,
  RA/Dec, band, duration, product goal, runtime, GPU, RFI strategy).
- Backend already has `local-llm` infrastructure and Ollama integration path.
- Environment contract already includes LLM-related variables
  (`REMOTE_COMPUTE_MODE`, `OLLAMA_*`).
- Existing optimization endpoint can be complemented by a Q&A endpoint.

## What the LLM Can Answer

With current context injection, the assistant can answer:

- "What will this job do?"
- "Is this setup likely to be expensive?"
- "Should I use AlphaCal or ImageReconstruction first?"
- "What could fail with these parameters?"
- "How long might this run?"

The assistant should not claim:

- Scientific certainty about outcomes.
- Guaranteed runtime/cost.
- Site policy/legal constraints unless sourced from authoritative docs.

## UX Design

## Trigger Pattern

1. User opens summary sidebar.
2. User clicks `Have Questions?` button/icon.
3. Inline panel appears at bottom of sidebar:
   - suggested starter questions
   - free-text input
   - answer cards with confidence + caveats

## Interaction Model

- Question input: single prompt field + submit.
- Optional quick chips:
  - "What does this job do?"
  - "What should I change before running?"
  - "What are likely failure modes?"
  - "Estimate cost/runtime risk."
- Answers include:
  - short recommendation
  - rationale based on selected form values
  - explicit uncertainty statement

## Backend/API Design

Add endpoint (example):

- `POST /api/jobs/preflight-qa`

Request shape (example):

```json
{
  "question": "Should I increase GPUs for this run?",
  "jobContext": {
    "agent": "ImageReconstruction",
    "dataset_id": "VLASS2.1...",
    "params": {
      "target_name": "M87 Core Field",
      "target_ra_hours": 12.5137,
      "target_dec_degrees": 12.3911,
      "frequency_band": "L",
      "observation_duration_hours": 4,
      "product_goal": "science-ready-image-cube",
      "rfi_strategy": "medium",
      "gpu_count": 1,
      "max_runtime": "48h"
    }
  }
}
```

Response shape (example):

```json
{
  "answer": "Start with 1-2 GPUs. Increase only if queue/cost budget allows.",
  "confidence": "medium",
  "caveats": [
    "Runtime depends on dataset size and cluster queue conditions.",
    "This is advisory, not a scheduler guarantee."
  ],
  "recommended_changes": [
    { "field": "gpu_count", "value": 2, "reason": "Balanced throughput/cost" }
  ]
}
```

## Context Strategy (How Answers Are Grounded)

Use strict context assembly per request:

1. Current form inputs from the Jobs UI.
2. Selected agent workflow metadata.
3. Runtime mode/capability signals (`demo`, `local-llm`, `live`).
4. Curated policy and runbook snippets from repository docs (RAG).

No free-form internet call should be required for pre-run guidance unless
explicitly enabled.

## Training Required for the LLM

Full model training is not required for v1.

Recommended approach:

1. Prompt + RAG first (required)
   - Build a retrieval index from internal docs:
     - adapter guide
     - env reference
     - live cutover runbook
     - access/phase plans
   - Inject only relevant passages into prompt.

2. Supervised tuning dataset (optional, later)
   - Create a small domain QA set from real operator questions.
   - Include "good answer" and "unsafe answer" examples.
   - Focus on calibration, reconstruction, anomaly triage guidance.

3. Safety alignment set (required)
   - "Unknown/insufficient data" behaviors.
   - No fake guarantees.
   - No secret leakage in answers.
   - Explicit confidence and caveats in every response.

4. Evaluation harness (required)
   - Accuracy/grounding checks against curated expected answers.
   - Hallucination rate tracking.
   - Refusal quality tests for unsupported questions.

## Data/Training Artifacts to Prepare

- `qa_seed_questions.jsonl` with representative operator questions.
- `qa_expected_answers.jsonl` with reviewed reference answers.
- `qa_safety_cases.jsonl` for refusal/leakage/overclaim tests.
- Retrieval corpus manifest from `documentation/` sources.

## Risk Controls

- Redact tokens/secrets from prompt context before LLM call.
- Hard response schema validation.
- Confidence required; default to "low" if model uncertain.
- Add "advisory only" note in UI.
- Capture audit log of question, context hash, and response.

## Rollout Plan

Phase 1:

- Feature-flagged UI (sidebar-only Q&A panel).
- Local-llm only.
- Fixed prompt template + minimal retrieval.

Phase 2:

- Add live-mode serving path.
- Add recommendation chips and structured field updates.
- Add analytics on question categories and answer usefulness.

Phase 3:

- Introduce curated fine-tune (if needed).
- Add policy-aware response constraints and deeper eval gates.

## Acceptance Criteria

- Q&A visible only when summary sidebar is expanded.
- "Have Questions?" trigger opens panel without reducing core form usability.
- Answers include confidence + caveats.
- No secret leakage in logs or responses.
- Response latency acceptable for UX (<2s local target; mode-dependent).

## Open Questions

- Should answers be persisted per draft job or session-only?
- Should Q&A responses be exportable into job provenance notes?
- Do we allow model to propose direct form autofill changes in v1?

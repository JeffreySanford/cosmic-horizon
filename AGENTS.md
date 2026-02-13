<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## Testing & CI/CD

- All unit tests and E2E tests must pass locally before pushing (`pnpm test`, `pnpm e2e:mvp`)
- GitHub Actions automatically runs full test suite on push - monitor with `gh run list` or `gh run watch`
- Test environment polyfills are handled at test-setup level for cross-platform compatibility

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## CosmicAI Docking & AI Control Plane

### 1. Context: The ngVLA "Phase Change"

The upcoming ngVLA represents a phase change in radio astronomy, producing a data firehose of approximately 7.5-8 GB/s (raw visibilities) and annual archive growth of approximately 240 PB. At this scale, traditional human-only workflows are not viable; a single 4-hour observation can generate 109 TB, making local downloads and manual parameter tuning (the human bottleneck) impractical.

AI/ML agents are required at this scale.

### 2. Targeted CosmicAI Agents

Cosmic Horizon is designed to dock with and provide operational UI surfaces for autonomous engines being developed by the NSF-Simons CosmicAI initiative:

- `AlphaCal`: autonomous interferometric calibration focused on direction-dependent effects and RFI at scale.
- `Radio Image Reconstruction`: GPU-accelerated reconstruction models for tens to hundreds of billions of visibilities per ngVLA observation.
- `Anomaly Detection`: transfer-learning models for events in hyperspectral cubes and calibration anomaly detection.
- `CosmicAI Assistant`: integration with the specialized assistant hosted on the TACC open-source AI data platform.

### 3. Portal Role: "AI Control Plane"

CosmicAI delivers the back-half (math and compute fabric). Cosmic Horizon delivers the front-half (MLOps and UX). Docking priorities:

- `Inference UI`: replace notebook-centric workflows with enterprise-grade dashboards for monitoring agent performance.
- `Job Orchestration`: provide a web-native interface to launch AI-assisted reprocessing jobs on TACC-scale resources.
- `Auditability and Trust`: preserve human-in-the-loop controls to inspect, verify, and audit autonomous agent outputs.
- `Explainable UI`: use Community Notebooks and Aladin snapshots to document and explain AI-driven results, aligning with the "Explainable Universe" theme.

### 4. Technical Integration Targets

- `Platform`: open-source AI data platform hosted at TACC.
- `Protocols`: design for dataset federation and GPU job orchestration.
- `Performance`: maintain the `<1s` SSR first paint target so agent-generated Science Ready Data Products (SRDPs) are immediately explorable.

### 5. Strategic Milestone

- `Symposium`: Cosmic Horizons Conference 2026 (Charlottesville, VA).
- `Abstract Deadline`: April 1, 2026.

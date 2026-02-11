# Cosmic Horizons 2026 Abstract Pack

Status date: 2026-02-10

Conference context in this draft:

- Event: Cosmic Horizons Conference 2026 (2nd Annual)

- Core dates: July 13-16, 2026

- Venue: The Virginia Guest House, Charlottesville, Virginia

- Registration/submission hub: Whova / CosmicAI / NRAO conference pages

Use the official event pages to confirm final deadline and fee updates before submission.

Compliance note:

- This abstract pack should be framed around public-data-compatible workflows unless explicit FITS/policy permissions are confirmed.

- See `documentation/marketing/scope/DATA-POLICY-BOUNDARIES.md`.

## Title

`vlass-portal: A Web-Native Operational Interface for AI-Driven VLASS Data Exploration and Analysis Aligned with CosmicAI and ngVLA Infrastructure`

## Abstract (Short, ~150 words)

The Very Large Array Sky Survey (VLASS) generates large, evolving radio datasets that require scalable and usable workflows for exploration and AI-assisted analysis. We present `vlass-portal`, an open-source web platform designed as an operational interface for VLASS workflows. Current capabilities include server-side rendering for fast first paint, integrated Aladin Lite visualization with permalink/snapshot workflows, and community notebook-style posts with revision history for reproducibility.

These pillars establish a production-ready foundation for upcoming model-inference integration, async job orchestration, and explainability tooling aligned with CosmicAI and ngVLA priorities. Our goal is to provide the missing domain UX and control-plane layer that complements backend compute ecosystems (Jupyter/GPU resources) with workflow orchestration, auditability, and human-in-the-loop review. We demonstrate current platform capabilities and outline the integration path for calibration, reconstruction, and anomaly-detection pipelines at scale.

## Abstract (Long, ~250 words)

The Very Large Array Sky Survey (VLASS) produces high-volume, continuously useful radio data that increasingly depends on AI-assisted processing for discovery and validation. We present `vlass-portal` (`github.com/JeffreySanford/vlass-portal`), an open-source, web-native scientific operations interface designed to bridge production web workflows with AI-enabled radio astronomy pipelines.

The platform has shipped three core pillars:

1. Server-side rendering and fast first paint for responsive data access.

2. Integrated Aladin Lite controls with permalink state and snapshot sharing.

3. Community notebook-style posts with revision history for reproducible collaboration.

This baseline is being extended toward AI-inference integration, GPU-backed job orchestration, dataset federation, and explainability workflows. The objective is not to replace scientific modeling frameworks, but to operationalize them through a usable and auditable control plane: model runs as trackable jobs, reproducible parameters attached to outputs, and role-aware workflows for team science. Any FITS-oriented expansion is treated as permission-gated pending formal policy guidance.

This scope aligns with Cosmic Horizons themes including trustworthy AI, high-dimensional data analysis, and infrastructure readiness for ngVLA-scale data velocity. We position `vlass-portal` as the domain UX and MLOps-adjacent layer that complements institutional compute platforms, enabling researchers to move from isolated notebooks toward shared, reproducible, and interpretable operational workflows.

We will demonstrate VLASS exploration and share integration patterns for next-stage model services (e.g., calibration anomaly detection and image reconstruction) in support of scalable, human-centered radio astronomy operations.

## Keywords

- radio astronomy platforms

- VLASS

- ngVLA readiness

- AI operations

- reproducible workflows

- web-based scientific tooling

## Technical Demo Variant (~180 words)

### Title

`vlass-portal: Operational Web Control Plane for VLASS AI Workflows (Technical Demonstration)`

### Abstract

We present a technical demonstration of `vlass-portal`, an open-source web control plane for VLASS-oriented AI workflows. The stack uses Angular + Nx on the frontend, API services with role-aware auth on the backend, and reproducibility-focused workflow entities for post/revision lineage. Current production-ready capabilities include server-side rendering for low-latency first paint, Aladin Lite integration with permalink-encoded viewer state, and snapshot/revision workflows that preserve analysis context.

The demo focuses on implementation mechanics relevant to Cosmic Horizons infrastructure tracks: request flow from UI action to API orchestration, state capture for reproducibility, and operational controls that support human-in-the-loop validation. We show how these pieces form a stable foundation for near-term model-serving integration (inference endpoints), async GPU job execution, and explainability overlays without reworking the user-facing platform.

This contribution is positioned as complementary infrastructure: not model development itself, but the operational interface that makes AI pipelines observable, auditable, and usable by distributed astronomy teams preparing for ngVLA-scale data operations.

## Lightning Talk Variant (~100 words)

### Title

`vlass-portal: Web Operations Layer for AI-Driven VLASS Workflows`

### Abstract

## `vlass-portal` is an open-source web operations layer for VLASS workflows, built to complement AI model and compute platforms with usable orchestration and reproducibility. The current implementation ships three pillars: SSR fast first paint, Aladin Lite viewer state with permalinks/snapshots, and revisioned notebook-style collaboration posts. This lightning talk shows how those capabilities create a practical control-plane foundation for upcoming model inference endpoints, async GPU job execution, and explainability overlays. The focus is operational readiness: making AI-assisted radio astronomy workflows observable, auditable, and usable by teams preparing for ngVLA-scale data velocity
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*

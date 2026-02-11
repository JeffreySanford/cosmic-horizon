# Symposium Draft: Cosmic Horizons 2026

**Topic:** Scaling Radio Astronomy with AI-Driven Control Planes: The VLASS Portal Architecture
**Venue:** Cosmic Horizons Conference 2026 (Charlottesville, VA)
**Abstract Deadline:** April 1, 2026

## 1. Abstract Summary

The Next-Generation Very Large Array (ngVLA) will produce raw data at rates (~8 GB/s) that preclude traditional manual calibration and imaging workflows. The NSF-Simons CosmicAI initiative is developing autonomous engines (AlphaCal, Radio Image Reconstruction) to handle this "firehose."

The VLASS Portal serves as the **AI Control Plane**, bridging the gap between high-performance compute fabric (TACC) and the scientific user. This presentation details the architecture required to provide real-time monitoring, auditability, and job orchestration for autonomous agents while maintaining a high-performance SSR frontend for immediate exploration of Science Ready Data Products (SRDPs).

## 2. Technical Pillars

### A. Three-Tier Architecture & Rust Compute

- **Frontend (Angular 21):** SSR-first strategy for <1s paint targets, ensuring agent-generated snapshots are instantly shareable.
- **API (NestJS):** Orchestration layer for metadata, threaded communication, and role-based access.
- **Compute (Rust):** High-efficiency TITS (Transformation and Imaging Task Suite) for low-latency coordinate transformations and ephemeris calculations.

### B. Quality & Governance Gates

- **Docs Policy:** Automated consistency checks between ADRs and source-of-truth models.
- **Verification:** 100% test coverage target for core scientific logic (ephemeris, permalink resolution).
- **Affiliation-Safe Positioning:** Designed for seamless docking with NRAO/VLA infrastructure while maintaining portability across open-source AI data platforms.

## 3. AI Agent Integration (The Docking Plan)

| Agent | Portal UI Role | Compute Target |
|-------|----------------|----------------|
| **AlphaCal** | Direction-Dependent Error Monitoring | TACC Frontera/Stampede3 |
| **Image Reconstruction** | Real-time Visibility Visualizer | GPU-Accelerated Clusters |
| **Anomaly Detection** | Hyperspectral Cube Event Alerts | Transfer Learning Inference |

## 4. Key Takeaways

- Transitioning from "Human-Bottleneck" to "AI-Orchestrated" workflows.
- Reproducibility through community-threaded comments and Aladin-integrated snapshots.
- Future-proofing archives for the 240 PB/year ngVLA data scale.

---
*Draft Version: 1.0 (Feb 11, 2026)*
*Affiliation: NRAO/CosmicAI Independent Project*

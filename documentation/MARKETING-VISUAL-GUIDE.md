# VLASS Portal: Visual Summary & Infographics Reference

## Document Purpose

This document provides **detailed specifications and Mermaid diagrams** for creating professional marketing visuals and infographics for VLASS Portal. It complements the main marketing overview and is suitable for conversion to PDF or graphic design workflows.

---

## 1. Problem Statement Visualization

### The Fragmentation Problem

The current radio astronomy workflow is scattered across incompatible tools:

```mermaid
graph TB
    Data["📊 Petabytes of<br/>Radio Data"]

    Data --> A["🖥️ Tool 1: Aladin<br/>(Desktop Viewer)"]
    Data --> B["📓 Tool 2: Jupyter<br/>(Analysis)<br/>"]
    Data --> C["⚙️ Tool 3: Scripts<br/>(Bash/CLI)"]
    Data --> D["💌 Tool 4: Email<br/>(Collaboration)"]

    A --> P1["❌ Context<br/>switching"]
    B --> P1
    C --> P1
    D --> P1

    P1 --> PROB["⚠️ Problems"]

    PROB --> P2["No reproducibility<br/>(what version<br/>of model?)"]
    PROB --> P3["Manual sharing<br/>(fragmented<br/>communication)"]
    PROB --> P4["No audit trail<br/>(who did<br/>what when?)"]
    PROB --> P5["Slow discovery<br/>(exploring data<br/>takes 30+ min)"]

    P2 --> IMPACT["😞 Researcher Impact"]
    P3 --> IMPACT
    P4 --> IMPACT
    P5 --> IMPACT

    IMPACT --> OUTCOME["Lower productivity<br/>Longer time to publication<br/>Harder to secure grants"]

    style Data fill:#e1f5ff
    style A fill:#fff3e0
    style B fill:#fff3e0
    style C fill:#fff3e0
    style D fill:#fff3e0
    style P1 fill:#ffcccc
    style PROB fill:#ffcccc
    style P2 fill:#ffcccc
    style P3 fill:#ffcccc
    style P4 fill:#ffcccc
    style P5 fill:#ffcccc
    style IMPACT fill:#ffcccc
    style OUTCOME fill:#cc0000,color:#fff

```

---

### The Opportunity

What researchers *could* do with unified platform:

```mermaid
graph LR
    U["👨‍🔬 Researcher"]

    U -->|"1. Browse<br/>(1 sec)"| VIEW["🔭 View Sky"]

    VIEW -->|"2. Analyze<br/>(10 sec)"| AI["🤖 Run AI Model"]

    AI -->|"3. Interpret<br/>(1 sec)"| EXPLAIN["💡 See Why"]

    EXPLAIN -->|"4. Publish<br/>(2 min)"| PUB["📰 Share Findings"]

    PUB -->|"5. Reproduce<br/>(1 click)"| REP["🔄 New Dataset"]

    style U fill:#c8e6c9
    style VIEW fill:#bbdefb
    style AI fill:#fff9c4
    style EXPLAIN fill:#ffe0b2
    style PUB fill:#f8bbd0
    style REP fill:#d1c4e9

```

Estimated end-to-end time: approximately 3 minutes from data to publication.

---

## 2. Capability Pyramid: MVP → Phase 2 → Phase 3

The progression of vlass-portal from static viewer to federated national infrastructure:

```mermaid
%%{init: {"themeVariables":{"fontSize":"22px"},"flowchart":{"nodeSpacing":70,"rankSpacing":90,"padding":24}} }%%
graph TB
    subgraph MVP["🏆 MVP (Complete)<br/>Foundation: Browser + Data + Community"]

        MVP1["⚡ Pillar 1<br/>Instant Performance<br/>FCP <1s"]
        MVP2["🔭 Pillar 2<br/>Viewer + Sharing<br/>Permalinks"]

        MVP3["📓 Pillar 3<br/>Notebooks<br/>Collaboration"]
    end

    subgraph P2["🚀 Phase 2 (12-16w)<br/>Add: AI Inference + Orchestration + Reproducibility"]

        P2A["🤖 Inference<br/>Service"]
        P2B["⚙️ Job<br/>Orchestration"]
        P2C["📊 Reproducibility<br/>Framework"]
        P2D["💡 Explainability<br/>UI"]
    end

    subgraph P3["🌍 Phase 3 (16-20w)<br/>Add: Federation + Multi-site + TACC"]

        P3A["🔗 Dataset<br/>Federation"]
        P3B["☁️ TACC<br/>Integration"]
        P3C["🔄 Multi-site<br/>Reproducibility"]
        P3D["🎯 Explanation<br/>Aggregation"]
    end

    MVP1 & MVP2 & MVP3 -.->|"builds on"| P2A & P2B & P2C & P2D
    P2A & P2B & P2C & P2D -.->|"expands to"| P3A & P3B & P3C & P3D

    style MVP fill:#c8e6c9
    style P2 fill:#bbdefb
    style P3 fill:#fff9c4

```

---

## 3. Data Volume Challenge: Why This Matters

Comparing radio astronomy data scales across facilities:

```mermaid
graph LR
    V["VLASS (Today)<br/>~100 TB/year<br/>Interactive analysis"]
    A["ALMA (Current)<br/>~1-10 PB/year<br/>Batch processing"]
    N["ngVLA (2030s)<br/>~50 PB/year<br/>50 petaFLOPS"]

    V -->|"~10x to ~100x growth"| A
    A -->|"~5x to ~50x growth"| N

    Z["Current tool ceiling<br/>~1 PB operational comfort"]
    R["Required for ngVLA<br/>Federated AI operations"]

    A -.-> Z
    N --> R

    style V fill:#c8e6c9
    style A fill:#ffe0b2
    style N fill:#ffcdd2
    style Z fill:#ffebee
    style R fill:#d1c4e9

```

| Facility | Annual Data Volume | Analysis Mode | Operational Implication |
| --- | --- | --- | --- |

| VLASS (Today) | ~100 TB | Interactive (<30s) | Desktop/notebook workflows are still workable |
| ALMA (Current) | ~1-10 PB | Batch (hours) | Requires shared institutional infrastructure |
| ngVLA (2030s) | ~50 PB | Real-time + distributed | Demands federated orchestration and high-scale AI operations |

---

## 4. User Journey: From Discovery to Publication

### Journey Through MVP (What Exists Today)

```mermaid
flowchart LR
    U["User Lands (SSR)"] --> V["Open Viewer"]
    V --> E["Explore Sky Region"]
    E --> S["Capture Snapshot"]
    S --> P["Publish Revisioned Post"]

    style U fill:#bbdefb
    style V fill:#bbdefb
    style E fill:#ffe0b2
    style S fill:#ffccbc
    style P fill:#e1bee7

```

| Step | Action | Typical Time |
| --- | --- | --- |

| 1 | Land on SSR page (mobile/desktop) | 0s |
| 2 | Viewer loads preview | ~20s |
| 3 | Explore target sky region | ~1 min |
| 4 | Capture snapshot and share link | ~1.5 min |
| 5 | Publish post with embedded context | ~2 min |

---

### Extended Journey Through Phase 2 (AI Analysis)

```mermaid
flowchart LR
    P0["Snapshot Ready"] --> A0["Run AI Model"]
    A0 --> Q0["Queued on GPU"]
    Q0 --> R0["Overlay + Explanations"]

    R0 --> P1["Publish Reproducible Analysis"]

    style P0 fill:#e3f2fd
    style A0 fill:#fff9c4
    style Q0 fill:#fff3e0
    style R0 fill:#c8e6c9
    style P1 fill:#d1c4e9

```

| Step | Action | Typical Time |
| --- | --- | --- |

| 6 | Select model and click Analyze | ~10s |
| 7 | Job queued/executed on GPU | ~20s |
| 8 | Overlay + explainability returned | ~30s |

| 9 | Publish reproducible AI-assisted analysis | ~30-60s |

---

### Full Journey Through Phase 3 (Multi-Site Federation)

```mermaid
flowchart TB
    Q["Federated Query<br/>VLASS + CosmicAI"] --> C["Choose Compute<br/>Local or TACC"]

    C --> J["Submit Remote Job<br/>Scheduler Orchestration"]
    J --> M["Merge Outputs<br/>Cross-site Results"]
    M --> O["Publish Explainable Artifact"]

    style Q fill:#bbdefb
    style C fill:#ffe0b2
    style J fill:#ffecb3
    style M fill:#c8e6c9
    style O fill:#d1c4e9

```

## Multi-site flow summary

1. Select federated datasets (`VLASS + CosmicAI`) with sub-2s query time.

2. Choose compute path (local GPU for fast runs, TACC for large jobs).

3. Submit federated job (staging + scheduler + live status + cache checks).

4. Compare multi-model outputs and expert review for confidence scoring.

5. Publish reproducible artifact (data versions, model versions, params, outputs, DOI).

---

## 5. Architecture Evolution

### MVP Architecture (Simple, Single-Site)

```mermaid
flowchart TB
    subgraph MVP["MVP: Single-Site"]
      FE1["Angular SSR + Aladin"] --> API1["NestJS API"]

      API1 --> DB1["PostgreSQL + Redis"]

      DB1 --> EX1["VLASS HiPS/FITS Sources"]
    end

```

### MVP profile

- Complexity: Low

- Deployment: Docker Compose

- Scalability: Single server

### Phase 2 Architecture (Local AI + Inference)

```mermaid
flowchart TB
    subgraph P2["Phase 2: Inference Layer"]
      FE2["Web App"] --> API2["API Gateway"]
      API2 --> JQ2["Job Queue"]
      API2 --> MR2["Model Registry"]
      JQ2 --> GPU2["Local GPU Worker"]
      GPU2 --> RC2["Result Cache"]
      RC2 --> X2["Explainability UI"]
    end

```

### Phase 2 profile

- Complexity: Medium

- Deployment: Kubernetes-ready

- Scalability: Single GPU node

### Phase 3 Architecture (Federated Multi-Site)

```mermaid
flowchart TB
    subgraph P3["Phase 3: Federated Multi-Site"]
      FE3["Web App"] --> API3["Orchestration API"]
      API3 --> FG3["Dataset Federator"]
      API3 --> TG3["TACC Gateway"]
      FG3 --> NRAO3["NRAO Archive"]
      FG3 --> CAI3["CosmicAI Data"]
      TG3 --> SL3["Slurm + GPU Cluster"]

      SL3 --> MAN3["Reproducibility Manifest"]
    end

```

### Phase 3 profile

- Complexity: High

- Deployment: Kubernetes + Helm

- Scalability: Multi-region, petaflop-scale

---

## 6. Timeline: Gantt-Style Roadmap

```mermaid
gantt
    title VLASS Portal Roadmap (Feb 2026 - Jun 2027)

    dateFormat  YYYY-MM-DD
    axisFormat  %b %Y

    section Phase 2
    Planning Complete            :milestone, m1, 2026-02-10, 0d
    Engineering Window           :active, p2a, 2026-05-01, 2026-09-15
    Cosmic Horizons (Feedback)   :milestone, ch, 2026-07-13, 0d
    Phase 2 Target Complete      :milestone, p2m, 2026-09-30, 0d

    section Funding
    NSF SI2 Draft + Submit       :f1, 2026-02-15, 2026-04-15

    DOE ASCR Draft + Submit      :f2, 2026-03-15, 2026-06-15

    Decision Window              :f3, 2026-08-01, 2026-10-01

    section Phase 3
    Phase 3 Ramp                 :p3a, 2026-10-01, 2027-01-15
    Federation + TACC Execution  :p3b, 2027-01-15, 2027-06-30

    Phase 3 Target Complete      :milestone, p3m, 2027-06-30, 0d

```

| Window | Milestones |
| --- | --- |

| Feb-Apr 2026 | Phase 2 planning complete, NSF/DOE/NVIDIA prep |
| May-Sep 2026 | Phase 2 engineering execution and integration |
| Jul 2026 | Cosmic Horizons feedback milestone |
| Aug-Oct 2026 | Funding decision window |
| Oct 2026-Jun 2027 | Phase 3 federation + TACC execution |

| Jun 2027 | Phase 3 target completion and pilot readiness |

---

## 7. Funding Landscape

### Who Funds What

```mermaid
flowchart LR
    I["Internal Budget<br/>MVP + Phase 2"]

    NSF["NSF SI2<br/>Infrastructure"]
    DOE["DOE ASCR<br/>HPC Workflows"]
    NV["NVIDIA Research<br/>GPU Credits"]
    CIS["NSF CIS<br/>National Scale"]

    P2["Phase 2"]:::phase
    P3["Phase 3"]:::phase
    P4["Phase 4+"]:::phase

    I --> P2
    NSF --> P2
    NSF --> P3
    DOE --> P2
    DOE --> P3
    NV --> P2
    CIS --> P4

    classDef phase fill:#e3f2fd,stroke:#1565c0;

```

| Funding Source | Primary Phase Coverage | Budget Range | Notes |
| --- | --- | --- | --- |

| Internal budget (dept/R&D) | MVP + Phase 2 | ~$150K | Self-funded bridge |

| NSF SI2 (software infrastructure) | Phase 2-3 | $150K-$300K | 24 months, ~20-25% success |
| DOE ASCR (advanced computing) | Phase 2-3 | $200K-$400K | 24 months, ~25-30% success |
| NVIDIA research support | Phase 2 | $50K-$150K | Credits/hardware, ~60-70% success |
| NSF CIS (later-stage infra) | Phase 4+ | $500K-$1M+ | 36+ months, ~15-20% success |

#### Realistic blended range

`$800K-$1.6M` over staged cycles.

### Funding Timeline

```mermaid
gantt
    title Funding Timeline (2026-2027)
    dateFormat  YYYY-MM-DD
    axisFormat  %b %Y

    section Proposal Work
    Contact Program Officers   :a1, 2026-02-01, 2026-03-01
    NSF SI2 Submission         :milestone, a2, 2026-04-15, 0d
    DOE ASCR Submission        :milestone, a3, 2026-06-15, 0d

    section Review + Execution

    Review Window              :a4, 2026-07-01, 2026-10-01
    Continue Phase 2           :a5, 2026-05-01, 2026-09-30
    Phase 3 Grant-Accelerated  :a6, 2026-10-01, 2027-06-30

```

| Period | Action |
| --- | --- |

| Feb-Mar 2026 | Finalize planning and contact program officers |
| Apr-Jun 2026 | Submit NSF SI2 and DOE ASCR proposals |
| Jul-Oct 2026 | Continue Phase 2 while decisions are pending |
| Oct 2026-Jun 2027 | Phase 3 ramp/execution (grant-accelerated if funded) |
| Jun-Aug 2027 | NSF CIS fallback planning if needed |

---

## 8. Strategic Partnership Map

Showing how VLASS Portal connects multiple stakeholders:

```mermaid
flowchart TB
    R["Researchers (15+ institutions)"] --> V["vlass-portal<br/>Control Plane"]

    NRAO["NSF NRAO<br/>Data + Domain"] --> V

    CAI["CosmicAI<br/>Models + Research"] --> V

    TACC["TACC<br/>Compute + Scheduling"] --> V

    V --> NSF["NSF Funding Programs"]
    V --> DOE["DOE Funding Programs"]
    V --> NG["ngVLA Operations Readiness"]

    style V fill:#d1c4e9
    style NRAO fill:#bbdefb
    style CAI fill:#ffe0b2
    style TACC fill:#c8e6c9

```

| Layer | Stakeholders | Relationship to vlass-portal |
| --- | --- | --- |

| Community | Researchers (15+ institutions) | Drive use-cases and validation feedback |

| Core partners | NSF NRAO, CosmicAI, TACC | Provide data, models, and compute pathways |
| Strategic outcomes | NSF, DOE, ngVLA ecosystem | Funding leverage and long-horizon operational alignment |

Timeline summary:

- 2026: Integrate data + model + compute workflows.

- 2027: Multi-institution pilot operations.

- 2030+: ngVLA-aligned operations readiness.

---

## 9. Comparative Technology Positioning

### Market Positioning Matrix

```mermaid
flowchart TB
    subgraph HighUse["High Ease of Use"]
        VP["VLASS Portal (Target)"]
        AL["Aladin"]
    end
    subgraph LowUse["Low Ease of Use"]
        JP["Jupyter Notebooks"]
        AF["Airflow (ops-only)"]
    end

    LP["Low AI/Scale Readiness"] --- HP["High AI/Scale Readiness"]

    JP --- AF

    AL --- VP

    style VP fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style AL fill:#e3f2fd
    style JP fill:#fff3e0
    style AF fill:#ffebee

```

### Positioning summary

`vlass-portal` is positioned in the high-ease/high-scale quadrant compared with single-purpose tools.

---

## 10. Success Metrics Dashboard

### Phase 2 Success Metrics (Target Sep 2026)

```mermaid
flowchart LR
    subgraph T["Technical"]
      T1["Inference latency <10s"]
      T2["Job completion >99%"]
      T3["Repro linkage 100%"]
    end
    subgraph U["Adoption"]
      U1["10+ AI result posts"]

      U2["3+ reproducibility forks"]

      U3["80%+ explainability confidence"]

    end
    subgraph S["Strategic"]
      S1["Fundable proposal narrative"]
      S2["TACC readiness signal"]
      S3["Grant decision support"]
    end

```

| Category | Metric | Target | Current |
| --- | --- | --- | --- |

| Technical | Inference latency | <10s | Test pending |
| Technical | Job completion rate | >99% | Test pending |
| Technical | Reproducibility linkage | 100% | Test pending |
| Adoption | Posts with AI results | 10+ | 5 |

| Adoption | Users running forks | 3+ | 1 |

| Adoption | Explainability satisfaction | >80% | 75% |
| Strategic | Fundable proposal narrative | Yes | Done |
| Strategic | TACC partnership readiness | Yes | In plan |
| Strategic | Grant decision support | Yes | TBD |

### Phase 3 Success Metrics (Target Jun 2027)

```mermaid
flowchart LR
    subgraph I["Infrastructure"]
      I1["TACC submission success >=95%"]
      I2["Federation latency <3s"]
      I3["Manifest completeness 100%"]
    end
    subgraph C["Community"]
      C1["15+ institutions onboarded"]

      C2["5+ publications citing workflow"]

      C3["20%+ remote compute usage"]

    end
    subgraph O["Operational Outcomes"]
      O1["Cross-site reproducibility standard"]
      O2["Explainability workflow adoption"]
      O3["ngVLA readiness evidence"]
    end

```

| Category | Metric | Target | Current |
| --- | --- | --- | --- |

| Infrastructure | TACC submission success | >=95% | Test pending |
| Infrastructure | Federation latency | <3s | Test pending |
| Infrastructure | Reproducibility completeness | 100% | Test pending |
| Community | Institutions onboarded | 15+ | 0 |

| Community | Peer-reviewed citations | 5+ | 0 |

| Community | TACC-compute posts | >=20% | 0% |
| Strategic | NSF/DOE grant awarded | Yes | TBD |
| Strategic | CosmicAI formal endpoints | Yes | Planned |
| Strategic | ngVLA planning integration | Yes | Planned |

---

## 11. Infographics Call-Out Locations

In the primary [MARKETING-OVERVIEW.md](product/MARKETING-OVERVIEW.md) document, these sections should include professional graphics:

| Section | Visual Type | Recommendation |
| --- | --- | --- |

| **Executive Summary** | Single-page summary | Ensure all key metrics visible |

| **The Problem** | Fragmentation diagram | Show tool incompatibility + pain points |

| **The Solution** | Capability pyramid | MVP → Phase 2 → Phase 3 progression |

| **MVP Features** | Feature tiles + storyboard | 4-5 panel workflow showing speed |

| **Phase 2 Pillars** | 4-quadrant feature matrix | Inference, orchestration, reproducibility, explainability |

| **Phase 3 Pillars** | Multi-site architecture | Federation, TACC, reproducibility at scale |

| **Technical Architecture** | Layered system diagram (3 versions) | Show evolution from MVP through Phase 3 |

| **Strategic Alignment** | Partnership network map | NRAO, CosmicAI, TACC, ngVLA connections |

| **Timeline** | Gantt/waterfall chart | Feb 2026 → Jun 2027 with milestones |

| **Funding** | Waterfall + success probability | Budget allocation, grant pathways |

| **Competitive Positioning** | Matrix charts | VLASS Portal vs. Aladin, Jupyter, Airflow |

---

## 12. Design Specifications

### Color Palette (NSF-Aligned)

```text
Primary Blue (NSF brand):     #003f87
Secondary Orange (CosmicAI):  #ff6b35
Accent Green (Results):       #06a77d
Warning Red (Problems):       #d62246
Success Green (Complete):     #0a8f4f

Neutral Gray (backgrounds):   #f5f5f5
Text Dark:                    #333333
Text Light:                   #666666

```

### Typography

- **Headers:** System fonts (Segoe UI, -apple-system) for modern feel

- **Body text:** San-serif, 16px minimum for readability

- **Code/technical:** Monospace (Monaco, Consolas)

- **Emphasis:** Bold, all-caps for callouts and metrics

### Icon System

- **Data:** Database, cloud, servers, disk

- **Compute:** GPU, CPU, lightning bolt, gears

- **Analysis:** Microscope, telescope, magnifying glass, chart

- **Collaboration:** Users, speech bubbles, handshake

- **Time:** Clock, calendar, timeline

- **Success:** Checkmark, trophy, star

---

## 13. PDF Export Recommendations

### Best Practices for Conversion

1. **Use landscape orientation** for Gantt charts and architecture diagrams

2. **Embed high-resolution Mermaid diagrams** (300+ DPI if rasterized)

3. **Include table of contents** with internal links (for digital PDFs)

4. **Add page numbers** and section headers (for printing)

5. **Specify margins:** 1" top/bottom, 0.75" left/right

6. **Font embedding:** Ensure all custom fonts are embedded

7. **Color mode:** RGB for screen, CMYK for print

### Suggested Tools

- **Markdown → PDF:**

  - Pandoc + LaTeX (professional output)

  - VS Code with MD → PDF extension

  - GitHub Pages → Print to PDF (good compromise)

- **Diagrams → Graphics:**

  - Mermaid CLI for SVG/PNG export

  - Professional designer for infographics

  - Figma for collaborative design

---

## 14. Print-Ready Checklist

- ✅ All diagrams have legends

- ✅ Color scheme is print-friendly (accessible with B&W printing)

- ✅ Text is legible at 50% scale (test on printed page)

- ✅ URLs are hyperlinked in digital PDF

- ✅ Diagrams are labeled with figure numbers

- ✅ Sources/citations included for graphics

- ✅ Appendices linked from TOC

- ✅ No page breaks in middle of content

- ✅ Consistent header/footer branding

- ✅ Meets 508 accessibility standards (alt text for images)

---

## ## End of Visual Summary Document
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*

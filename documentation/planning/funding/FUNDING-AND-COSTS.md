# Funding & Cost Strategy: Phase 2 & 3

**Status date:** 2026-02-10  
**Scope:** Financial planning and grant strategy for vlass-portal Phases 2 and 3  
**Owner:** Project planning team

---

## Executive Summary

| Phase | Timeline | Labor Cost | Compute Cost | Total Budget | Funding Status |
| --- | --- | --- | --- | --- | --- |
| **Phase 2** | 12–16 weeks | $100K–$150K | ~$5K | $100K–$200K | Self-funded or internal |
| **Phase 3** | 16–20 weeks | $150K–$300K | $15K–$25K | $200K–$400K | Grant-dependent |
| **Total** | 28–36 weeks | $250K–$450K | $20K–$30K | $300K–$600K | Mixed model |

**Key insight:** Phase 2 is bootstrap-able; Phase 3 requires external funding for scaling.

---

## Phase 2: Cost Breakdown

### Engineering Labor

**Staffing model:** 1.5–2 FTE engineers  
**Duration:** 12–16 weeks  
**Blended rate:** ~$100/hour (varies by experience; senior eng $120, junior eng $80)

| Role | Weeks | FTE | Rate | Total |
| --- | --- | --- | --- | --- |
| Senior Backend Engineer | 16 | 1 | $120/hr | $76,800 |
| Full-stack Engineer | 16 | 1 | $100/hr | $64,000 |
| **Subtotal (labor)** | | | | **$140,800** |

**Actual cost depends on:**

- Organizational rate structure (academic vs. industry)
- Overhead allocation (benefits, facilities, admin)
- Geographic location (US Northeast/West: higher; South/Midwest: lower)

**Academic institution example (lower overhead):**

- ~$100K–$120K in direct labor

**Industry or well-funded research center:**

- ~$150K–$200K (with overhead)

### Compute Costs (Development)

| Category | Cost | Notes |
| --- | --- | --- |
| GPU instances (GCP/AWS dev) | $2K–$5K | 16 weeks at ~$100/month for shared GPU |
| Local GPU (on-premises) | $15K | One-time hardware; reused in Phase 3 |
| Cloud storage (test data) | $500 | Transient artifacts, test datasets |
| **Subtotal (compute)** | **$2K–$5K** | (Hardware is capital; exclude if already owned) |

### Software & Infrastructure

| Item | Cost | Notes |
| --- | --- | --- |
| Third-party libraries/SaaS | $2K–$3K | NX CLI, monitoring tools, optional |
| CI/CD enhancements | $0 (existing) | Leverage current GitHub Actions |
| Documentation tools | $0 (open-source) | Markdown, Mermaid, no cost |
| **Subtotal (software)** | **$0–$3K** | Minimal; mostly open-source |

### Phase 2 Total Budget

**Lean (self-funded) scenario:**

- Labor: $100K (1.5 FTE, academic rates)
- Compute: $0 (use existing GPU cluster)
- Software: $0 (open-source only)
- **Total: $100K**

**Realistic (internal funding) scenario:**

- Labor: $140K (2 FTE, blended rate)
- Compute: $5K (cloud GPU dev)
- Software: $2K (optional tools)
- **Total: $147K ≈ $150K**

**Well-resourced scenario:**

- Labor: $150K–$200K (senior-heavy team)
- Compute: $5K–$10K (dedicated resources)
- Software: $3K (full tooling)
- **Total: $200K**

---

## Phase 3: Cost Breakdown

### Engineering Labor (Distributed Systems Focus)

**Staffing model:** 2–3 FTE engineers (higher complexity)  
**Duration:** 16–20 weeks  
**Blended rate:** ~$110/hour (senior roles higher for distributed systems)

| Role | Weeks | FTE | Rate | Total |
| --- | --- | --- | --- | --- |
| Senior Distributed Systems Eng | 20 | 1 | $130/hr | $104,000 |
| Backend Engineer (TACC integration) | 20 | 1 | $110/hr | $88,000 |
| DevOps/Infrastructure Eng | 20 | 0.5 | $115/hr | $46,000 |
| **Subtotal (labor)** | | | | **$238,000** |

**Academic rates:** $180K–$220K  
**Industry rates:** $250K–$300K (with overhead)

### Compute Costs (Phase 3)

**Two components:**

1. **Development/Testing:**

| Category | Cost | Notes |
| --- | --- | --- |
| Local GPU machines | $0 (shared from Phase 2) | Reuse Phase 2 hardware |
| TACC GPU allocation (dev) | $0–$5K | Often covered by NSF allocation or grant |
| Cloud data transfer | $5K–$15K | Egress from TACC, S3 operations |
| Distributed cache infrastructure | $5K–$10K | Additional storage for results |
| **Subtotal** | **$10K–$30K** | Highly variable; depends on grant status |

1. **Operational (Post-Phase 3):**

| Category | Annual Cost | Notes |
| --- | --- | --- |
| TACC GPU allocation | ~$0 (grant-funded) | Allocations provided by NSF grants |
| Cloud data federation | $5K–$10K/year | Ongoing S3, data transfer fees |
| Distributed caching (storage) | $10K–$20K/year | Multi-site cache infrastructure |
| Monitoring & observability | $2K–$5K/year | CloudWatch, DataDog, etc. |
| **Subtotal (operational)** | **$20K–$40K/year** | Ongoing costs post-launch |

### Software & Infrastructure (Phase 3)

| Item | Cost | Notes |
| --- | --- | --- |
| TACC integration library | $0 | Open-source (XSEDE client libraries) |
| Kubernetes/orchestration | $0–$3K | If self-hosted; cloud-managed would be higher |
| Advanced monitoring | $3K–$5K | Prometheus, Grafana, or managed service |
| Documentation & UI (API docs) | $0 (in-house) | |
| **Subtotal (software)** | **$0–$8K** | Much lower than Phase 2 (tools already built) |

### Phase 3 Total Budget

**Minimum (grant-supported) scenario:**

- Labor: $200K (2 FTE, academic rates, no overhead)
- Compute: $10K (minimal cloud, TACC provided by grant)
- Software: $0 (open-source)
- **Total: $210K** (but requires $200K+ grant for GPU allocation)

**Realistic (partial external funding) scenario:**

- Labor: $240K (2.5 FTE, blended rate)
- Compute: $20K (cloud + TACC test allocation)
- Software: $5K (monitoring + integration tools)
- **Total: $265K** (ideally 40–50% from grant)

**Well-resourced (full external support) scenario:**

- Labor: $300K (3 FTE, senior-heavy, with overhead)
- Compute: $30K (robust cloud infrastructure)
- Software: $10K (full observability stack)
- **Total: $340K–$400K** (50–70% from grant)

---

## When Grants Enter the Picture

### Timeline to Funding

```text
Feb 2026 (Now)
  ↓
Mar 2026: Contact NSF program officers (SI² and CIS divisions)
  ↓
Apr–May 2026: NSF SI² due (~Apr 15, May 15, depends on solicitation)
  ↓
May 2026: Begin Phase 2 (unfunded or internal)
  ↓
Jun 2026: DOE ASCR due (rolling deadline)
  ↓
Aug–Sep 2026: Grant decisions start returning
  ↓
Oct 2026: If awarded → accelerate Phase 3; if not → continue at 50% staffing
  ↓
Q1 2027: Phase 3 ramping (grant-funded or extended timeline)
```

### Realistic Success Rates

| Program | Probability | Timeline | Budget |
| --- | --- | --- | --- |
| **NSF SI²** | 20–25% | 4–6 months review | $150K–$300K |
| **DOE ASCR** | 25–30% | 4–5 months review | $200K–$400K |
| **NVIDIA GPU Research** | 60–70% | 1–2 months | $50K–$150K + GPU credits |
| **NSF CIS** (Phase 4) | 15–20% | 5–7 months review | $300K–$1M (larger, later) |

**Realistic scenario:** 1 in 3 shot at NSF/DOE funding. NVIDIA partnership much more certain.

---

## Funding Program Details

### 1. NSF SI² (Software Infrastructure for Sustained Innovation)

**Solicitation:** [NSF 24-XXX](https://nsf.gov/pubs/2024) (check current year)  
**Budget:** $150K–$300K (24 months typical)  
**Due dates:** Usually April, August (check solicitations)

**Your pitch:**
> "vlass-portal: Scientific Operations Platform for Radio Astronomy AI Workflows"
>
> **Problem:** CosmicAI has cutting-edge ML models and massive compute (TACC). Researchers still interact via Jupyter notebooks (2012-era UX). **Solution:** Web-native operations platform enabling reproducible, federated AI analysis across institutional boundaries. **Impact:** Demonstrator for ngVLA operations (2030s); aligns with NSF strategic priorities in AI + scientific computing.

**Why you're competitive:**

- Direct alignment with funded CosmicAI initiative
- Addresses reproducibility crisis (NSF priority)
- Bridge between ML research and user operations
- Transferable to ngVLA (long-term facility)

**Effort to write:** 2–3 weeks (you have Phase 2/3 docs, so mostly editing)

**Success rate:** ~20–25% (competitive, but infrastructure is fundable)

---

### 2. DOE ASCR (Advanced Scientific Computing Research)

**Solicitation:** [DOE SC-23-XXX](https://science.osti.gov/grants) (rolling)  
**Budget:** $200K–$400K (24 months typical)  
**Due dates:** Rolling submissions (no fixed deadline; best to submit by Mar–Jun)

**Your pitch:**
> "High-Performance Workflow Orchestration for Radio Astronomy: Demonstrator for ngVLA Computational Infrastructure"
>
> **Problem:** Next-gen observatories (ngVLA, 50 petaFLOPS) demand workflow orchestration across HPC centers. Current solutions (Airflow, Dask) are generic. **Solution:** Domain-specific astronomy workflow system with distributed caching, multi-site orchestration, and reproducibility. **Impact:** Reference implementation for HPC+cloud bursting; ngVLA operations planning.

**Why you're competitive:**

- HPC + workflow orchestration = DOE sweet spot
- Distributed systems problem (their expertise)
- ngVLA is decades-long facility (strategic partnership value)
- Reference architecture for 50-petaflop compute challenges

**Effort to write:** 2–3 weeks

**Success rate:** ~25–30% (slightly better than NSF for HPC angles)

---

### 3. NVIDIA GPU Research Program

**Program:** [NVIDIA Research Partnerships](https://research.nvidia.com/news/nvidia-research-partnerships)  
**Budget:** $50K–$150K + GPU credits  
**Turnaround:** 4–8 weeks (highly variable)

**Your pitch:**
> "Multi-site GPU Orchestration for Astronomy: Case Study in Distributed Inference Across HPC Centers"
>
> **Problem:** Researchers want to use GPUs efficiently across institutions. **Solution:** vlass-portal demonstrates dynamic GPU allocation, job queuing, and caching across TACC + local clusters. **Value for NVIDIA:** Reference implementation; marketing materials; research impact.

**Why you're competitive:**

- NVIDIA funds research showcasing GPU utilization
- Solves real problem: academic GPU scheduling is terrible
- You get press, NVIDIA gets case study
- Community adoption proves impact

**Effort to reach out:** 1 week (contacts via university research liaison)

**Success rate:** ~60–70% (industry more flexible than government)

---

### 4. NSF CIS (Cyberinfrastructure for Sustained Scientific Innovation)

**Solicitation:** [NSF 24-XXX](https://nsf.gov/pubs/2024)  
**Budget:** $300K–$1M+ (3–4 years)  
**Due dates:** Similar to SI² (check solicitations)

**Your pitch (post-Phase 3):**
> "vlass-portal: National-Scale Scientific Workflow Platform for Radio Astronomy"
>
> **Problem:** 50+ astronomy institutions need shared cyberinfrastructure for AI-driven data analysis. Fragmented tools, no reproducibility, no governance. **Solution:** Federally-funded shared platform with production support, training, and community governance.

**When to pursue:** **Mid-2027, after Phase 3 proves concept** (community adoption de-risks the bet)

**Success rate:** ~15–20% (very competitive; community validation helps enormously)

---

## Funding Timeline & Strategy

### Strategy A: Dual NSF/DOE (Ideal)

```test
Feb–Mar 2026: Draft both NSF SI² and DOE ASCR proposals
Apr 2026: Submit NSF SI² (due Apr 15–May 15)
May 2026: Begin Phase 2 (unfunded, 1 FTE)
Jun 2026: Submit DOE ASCR (rolling)
Aug–Sep 2026: Decisions returning
Oct 2026: If either awarded → hire 2–3 engineers, accelerate Phase 3
          If neither awarded → continue Phase 2 at 50% pace, pivot to NVIDIA
```

**Outcome probabilities:**

- Both awarded: 5–8% (rare, but possible)
- One awarded: 30–40%
- Neither: 55–60%

### Strategy B: Lean + NVIDIA (More Certain)

```test
Feb–Mar 2026: Begin Phase 2 (self-funded, 1.5 FTE)
Apr 2026: Reach out to NVIDIA via university research liaison
May–Jun 2026: NVIDIA partnership confirmed (60–70% chance)
Jul 2026: NVIDIA credits cover dev costs; ramp to Phase 3
Aug 2026: Parallel NSF/DOE submissions (stronger pitch with NVIDIA backing)
Sep–Oct 2026: Build momentum; reach out to CosmicAI formally
Nov 2026+: Phase 3 (funded by NVIDIA credits + internal budget + eventual NSF/DOE)
```

**Advantage:** Lower risk, faster start. NVIDIA partnership strengthens NSF/DOE pitches.

### Strategy C: Self-Funded + Patience (Maximum Control)

```test
Feb–Jun 2026: Phase 2 fully funded internally (1.5 FTE, $100K–$150K)
Jul–Aug 2026: Publish Phase 2 results; reach out to CosmicAI + NRAO
Sep 2026: Strong Phase 3 pitches (community validation improves odds)
Sep–Oct 2026: NSF/DOE submissions (Phase 3 scoped bigger, $300K+)
Nov 2026–Feb 2027: Decision period; meanwhile continue Phase 3 at 50% pace
Mar 2027: Check awards; if funded, accelerate; if not, seek DOE CIS (larger, $500K+)
```

**Advantage:** Most control; Phase 2 fully baked before external funding.

---

## Realistic Scenarios

### Scenario 1: Aggressive (Recommended)

**Assumption:** You have internal budget for Phase 2; dual NSF/DOE submissions land 50% success rate

| Period | Action | Cost | Outcome |
| --- | --- | --- | --- |
| Feb–May 2026 | Phase 2 full speed | $150K internal | Inference layer + job orchestration |
| Jun–Aug 2026 | NSF/DOE proposals | $5K (writing, etc.) | 1 award likely |
| Sep–Dec 2026 | Phase 3 ramp (+ grant) | $50K internal + $100K–$150K grant | TACC integration begins |
| Jan–Jun 2027 | Phase 3 full | $200K grant | Multi-site operational |
| **Total** | | **$500K–$600K** | **Ambitious, fundable** |

**Risk:** High engineering burn upfront; payoff depends on Phase 2 success.

---

### Scenario 2: Conservative (Lower Risk)

**Assumption:** Self-fund Phase 2 completely; seek external funding for Phase 3 only

| Period | Action | Cost | Outcome |
| --- | --- | --- | --- |
| Feb–Aug 2026 | Phase 2 (1 FTE, slow) | $75K internal | Inference layer (simplified) |
| May–Jun 2026 | NSF/DOE submissions | $5K | Low odds (no Phase 2 to show) |
| Jul–Sep 2026 | Wait for decisions | $0 | Likely rejection; pivot to NVIDIA |
| Sep–Dec 2026 | NVIDIA partnership (60% sure) | $0 + credits | Phase 3 proof-of-concept |
| Jan 2027+ | NSF CIS (larger grant) | $0–$100K internal | Aim for $300K–$500K multi-year |
| **Total** | | **$200K–$300K internal** | **Safer, slower** |

**Risk:** Phase 3 delayed 6–12 months; but Phase 2 deeply validated.

---

### Scenario 3: Hybrid (Balanced)

**Assumption:** Internal Phase 2 + modest NVIDIA partnership + NSF/DOE attempt

| Period | Action | Cost | Outcome |
| --- | --- | --- | --- |
| Feb–May 2026 | Phase 2 (1.5 FTE) | $120K internal | Solid inference layer |
| Apr 2026 | NVIDIA outreach | $0 | 60% success → $30K–$50K + credits |
| Jun 2026 | NSF/DOE submissions | $5K | 30% success → $150K–$200K |
| Jul–Sep 2026 | Wait; build momentum | $0 | CosmicAI endorsement, TACC allocation |
| Oct 2026–Jun 2027 | Phase 3 (grant + NVIDIA + internal) | $200K combined | Full federation + TACC ready |
| **Total** | | **$350K–$450K** | **Realistic, achievable** |

**Risk:** Moderate; multiple funding sources reduce single-point failure.

---

## Operational Costs (Post-Phase 3)

Once Phase 3 launches (mid-2027), ongoing operational expenses:

| Item | Annual Cost | Notes |
| --- | --- | --- |
| Cloud data federation | $5K–$10K | S3 egress, data transfers |
| Distributed caching | $10K–$20K | Multi-site storage |
| Monitoring & observability | $2K–$5K | CloudWatch, Prometheus |
| TACC GPU allocation | ~$0 | Covered by NSF grants (CosmicAI, ngVLA) |
| Backend hosting (vlass-portal) | $5K–$10K | If cloud-hosted; less if on-prem |
| **Total operational** | **$22K–$45K/year** | Covered by grant renewals or NSF support |

---

## Key Recommendations

### Now (Feb 2026)

1. **Finalize Phase 2/3 docs** ✓ (done)
2. **Identify 1–2 grant targets** → NSF SI² + DOE ASCR
3. **Contact NSF program officers** for feedback calls (non-binding, but valuable)
4. **Reach out to NVIDIA** via university research liaison
5. **Start Phase 2 engineering** (unfunded OK; shows commitment to reviewers)

### Apr–Jun 2026

1. **Submit NSF SI²** (if aligned with your institution's deadline)
2. **Submit DOE ASCR** (rolling deadline; no rush, but submit by Jun)
3. **Accelerate Phase 2** with best-effort internal resources
4. **Gather early user feedback** (NRAO, CosmicAI contacts)

### Jul–Sep 2026

1. **Wait for grant decisions**
2. **Continue Phase 2 engineering** (assume unfunded)
3. **If NVIDIA comes through** → celebrate, use credits
4. **Prepare Phase 3 proposal** for contingency (longer timeline)

### Oct 2026+

1. **If awarded:** Hire 2–3 engineers, accelerate Phase 3
2. **If not awarded:** Continue at 50% pace, pivot to NVIDIA + larger CIS grant (2027)
3. **Regardless:** Publish Phase 2 results, reach out to CosmicAI formally

---

## Budget Summary Table

### Phase 2

| Category | Min | Realistic | Max |
| --- | --- | --- | --- |
| Labor | $80K | $140K | $200K |
| Compute | $0 | $5K | $10K |
| Software | $0 | $2K | $5K |
| **Total** | **$80K** | **$147K** | **$215K** |

### Phase 3

| Category | Min | Realistic | Max |
| --- | --- | --- | --- |
| Labor | $180K | $240K | $300K |
| Compute | $10K | $20K | $30K |
| Software | $0 | $5K | $10K |
| **Total** | **$190K** | **$265K** | **$340K** |

### Combined (Phases 2+3)

| Category | Min | Realistic | Max |
| --- | --- | --- | --- |
| Labor | $260K | $380K | $500K |
| Compute | $10K | $25K | $40K |
| Software | $0 | $7K | $15K |
| **Total** | **$270K** | **$412K** | **$555K** |

---

## Conclusion

**Phase 2 is self-fundable.** Total cost $100K–$150K; can absorb internally.

**Phase 3 requires external funding.** Aim for NSF SI² or DOE ASCR (~$150K–$300K); feasible success rate 20–30%. Fallback to NVIDIA partnership (60–70% success) + extended timeline or NSF CIS (larger, post-2027).

**Combined cost for full (Phase 2+3) execution:** $300K–$600K over 28–36 weeks. Realistic split: 50% internal (Phase 2 + seed), 50% grant/external (Phase 3 acceleration).

**Key insight:** Start Phase 2 now with internal budget. Write grant proposals Apr–Jun. If awarded, scale Phase 3 in Oct. If not, continue on extended timeline with NVIDIA credits or CIS partnership. Either way, you'll have a working system by mid-2027.

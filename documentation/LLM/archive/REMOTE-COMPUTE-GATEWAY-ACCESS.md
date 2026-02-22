# Remote Compute Gateway Sprint: Access Research

**Abstract:** Access to TACC/ACCESS compute resources is the linchpin for
converting our Remote Compute Gateway prototype into a validated, demoable,
production-grade feature. Without legitimate credentials and an allocation we
can only build and test against mocks; obtaining live access enables end-to-end
verification, credible symposium artifacts, and confidence that the gateway
will operate correctly on the NSF’s exascale fabric. This document provides a
step-by-step plan for securing that access and continuing meaningful progress
in its absence.

Status date: 2026-02-22

This document collects notes and research pointers for obtaining legitimate
access to TACC/UT resources needed by the Remote Compute Gateway sprint. It
also outlines how developers can continue progress in the absence of credentials
by working against mock and demo adapters.

## Policy Sources (As Of 2026-02-22)

The access policy statements in this document are based on:

- TACC user policy updates for account eligibility and institutional email
  requirements.
- ACCESS allocation policy and eligibility requirements.
- TACC Stampede3 documentation indicating ACCESS allocation workflows.
- Tapis v3 authentication and jobs API documentation.

See the APA references at the bottom for exact source links.

## Sprint Background

The Remote Compute Gateway (v1.2) is an early prototype of the job orchestration
layer that will enable Cosmic Horizon to submit compute jobs to the NSF-funded
exascale infrastructure managed by the Texas Advanced Computing Center (TACC).
Initial planning assumed access to a TACC cluster (e.g. Stampede3 or newer) or a
CosmicAI sandbox API to demonstrate submission, status polling, and result
retrieval with real datasets.

### Why access matters

- **Validation** – Verify that HTTP API contracts, authentication headers, and
  parameter encodings actually match what TACC/CosmicAI expect.
- **End‑to‑end testing** – Replace simulated job IDs with real ones; observe
  progress transitions and output URLs; catch corner cases like queue limits,
  back‑pressure, and quota errors.
- **Performance profiling** – Understand latency characteristics and how quickly
  status updates propagate through the real system versus our mock.
- **Documentation & demos** – Build convincing demo material for the
  symposium. A real job submission is more compelling than a simulated log.
- **Security compliance** – Exercise credential redaction and key rotation
  workflows against a live backend, which may have additional requirements
  (e.g. IP whitelisting, OAuth scopes).

Without access, the team can still make the gateway software ready; however, a
production sign‑off will require at least one successful live submission.

## Possible access pathways

The following are avenues to explore for gaining legal, supported access to
the compute fabric. Note that "access" actually involves three distinct
gates (account, allocation, interface); see next section for details.

1. **Campus affiliation** – TACC accounts are typically issued to faculty,
   researchers, and graduate students associated with UT Austin or partner
   institutions. TACC (effective 1 Jan 2026) now prohibits generic email
   domains; you must use an approved institutional address. If you are not
   currently affiliated you might:
   - Collaborate with a UT research group (CosmicAI, Astronomy, etc.).
   - Ask a colleague with access to sponsor an account; often they can request
     a guest account for external collaborators.
   - Join a research project that already has an allocation.

2. **ACCESS Explore/Startup-style allocation** – Stampede3 and similar
   systems are now provisioned through the NSF **ACCESS** program (XSEDE has
   been retired). Submit all Stampede3 allocation requests through the
   ACCESS portal. You can apply for a small, quick on‑ramp allocation; the
   "Explore" (sometimes called "Startup") project type is intended for
   lightweight experimentation and is perfect for our prototype purposes
   (see <https://www.access-ci.org/>). **Eligibility note:** ACCESS allocations
   require PI‑eligible sponsorship or institutional affiliation; unaffiliated
   individuals (retired/self‑employed/no academic affiliation) are explicitly
   ineligible to hold or use allocations.

3. **CosmicAI partnership** – The NSF‑Simons CosmicAI initiative may have its
   own onboarding process for external developers. Reach out to the project
   mailing list or Slack workspace to ask about a test API endpoint or a shared
   collaboration account. The `AGENTS.md` and related architecture docs may
   have contact information.

4. **Public demo accounts** – Occasionally TACC maintains publicly visible
   "demo" or "education" accounts for outreach. Check their website or
   contact `user-services@tacc.utexas.edu` to ask whether a developer can be
   granted temporary credentials for evaluation.

5. **Remote compute gateways** – In some architectures, a third party can
   submit jobs on behalf of end users via a gateway service; if such a service
   already exists within CosmicAI (or the ngVLA team) we could request an
   existing API key that we operate purely over HTTPS. This option would not
   require individual TACC accounts.

6. **Containerized / emulator alternatives** – If UT access is completely
   impractical, evaluate whether TACC provides a lightweight emulation
   environment (e.g. a REST stub or Docker image) that mimics the job
   submission API. Sometimes HPC centers offer such tooling for developer
   onboarding.

7. **ACCESS allocation via a sponsoring PI** – Many HPC centers, including
   TACC, allow a Principal Investigator (PI) at a U.S. institution to request
   a project allocation and then add external collaborators. If you do not
   personally meet eligibility requirements, find a researcher who can sponsor
   you under their allocation; the PI’s institution becomes the bridge for
   your access. This "external collaborator" model is common (see TAMU HPRC
   documentation for a similar process). Note that the PI must add you as a
   member of the project and ensure the project includes the target resource
   (e.g., Stampede3) – membership without the correct resource is another
   common cause of “access but can't run” issues.

## Research action items

- [ ] Review `AGENTS.md`, architecture diagrams, and any e‑mails from CosmicAI
      partners for contact names and procedures.
- [ ] Confirm whether the gateway should integrate with **Tapis v3** (OAuth2
      token-based Jobs/Files/Systems APIs) versus a Slurm-over-SSH approach and
      document the chosen contract and endpoints.
- [ ] Identify and document the data staging approach (project storage,
      Ranch, Files API) rather than focusing solely on job submit/poll.
- [ ] Search TACC documentation (`https://www.tacc.utexas.edu/documentation`)
      for "API access", "Tapis", "external collaborator", and "ACCESS" policies.
- [ ] Send an inquiry to TACC user services or CosmicAI mailing list describing
      our project and requesting sandbox credentials.
- [ ] If in doubt, submit an ACCESS Explore/Startup allocation proposal citing
      research use of VLASS data and Cosmic Horizon's open‑source portal.
- [ ] Document any replies or account credentials in a secure location (private
      vault); reference them here only as pointers (never commit secrets).

## Developer guidance for offline progress

The codebase already includes:

- A `TaccIntegrationService` that simulates (`setTimeout`) network calls and
  returns fabricated job IDs and statuses.
- Extensive unit tests verifying behavior, credential handling, and error
  conditions.
- Frontend components and Playwright specs that exercise the fake service.

### Access is three gates

Real HPC access is not a single token; you must pass three gates:

1. **Identity / account** – you need a TACC user account tied to an approved
   institutional email address (UT, partner university, or sponsor PI). TACC
   now enforces the 1 Jan 2026 policy requiring a valid institutional email;
   free domains (gmail, yahoo, qq, etc.) are blocked. ACCESS has a matching
   requirement for PIs and users.
2. **Project allocation & membership** – a PI‑eligible researcher must request
   compute SU/credits via ACCESS and include the desired system (e.g., Stampede3)
   in the project. Once approved, the PI adds team members individually. An
   account without a project or without membership on the right resource still
   leaves you unable to run jobs. Unaffiliated individuals cannot hold or use
   ACCESS allocations.
3. **API/Interface enablement** – determine how you will talk to the system:
   - **Tapis Jobs API** (OAuth2, tenant-specific base URL, `/v3/jobs/submit`,
     `/v3/jobs/{uuid}/status`, `/v3/files`, `/v3/systems`, etc.). Document the
     tenant base URL (e.g. `https://tacc.tapis.io`), OAuth2 endpoint
     (`/v3/oauth2`), and chosen auth flow.
   - **SSH + Slurm** (via `sbatch`, `squeue`, etc.), which requires SSH keys and
     parsing command output.

### Data staging & retrieval

A gateway demo should show not only job submission but also input staging and
output collection. ACCESS and Tapis workflows typically rely on site storage
systems (home directories, project scratch, Ranch archive). Consider:

- Where job inputs are uploaded – e.g. via Tapis Files API or `scp` to project
  storage.
- How outputs are archived – you may return an "output_url" pointing to Ranch
  or provide a Files API download link.
- Whether to support both URL semantics and explicit download via the API.

A minimal live proof-of-concept should stage a small input file, run a trivial
job, and fetch a single result. A stretch goal is to stage a subset of VLASS
data, run a brief workflow, and archive the results.

### Auth modes & security details

Common gotchas you should design for:

- **OAuth2 access tokens** are short‑lived; refresh strategies or client
  credentials flows may be needed.
- **Client registration**: some Tapis endpoints require the gateway to be
  registered as a client app with client ID/secret.
- **Institutional IdP login** is required for account provisioning; approval may
  take a few days.
- **Credential storage**: use a vault, CI secrets, or local `.env` files.
  Never hard‑code real keys.
- **Token revocation / rotation**: design for periodic refresh or re‑issuance.
- **Human identity separation** – do not share personal PI/user credentials.
  Use individual user identities for access and, where policy allows, use
  managed service credentials for automation with least privilege.

Add explicit tests and abstractions early to handle these modes so the code
doesn’t bake in a single credential type.

Focus on:

- Improving the simulation so that it is indistinguishable from a real service
  (e.g. add realistic delays, failure modes, quota‑limit errors).
- Adding a feature‑flag (`TACC_LIVE=true` or similar) that swaps the mock with
  a real HTTP client configured from environment variables.
- Writing clear documentation and API contract stubs so the first live
  integration is an explicit config gate (`TACC_LIVE=true`) plus live endpoint
  configuration (`TACC_TENANT_BASE_URL`) and auth credentials (`TACC_CLIENT_ID`,
  `TACC_CLIENT_SECRET`, scopes, and system/app identifiers as applicable).
- Define the minimal proof-of-concept (trivial job submitted, polled, output
  fetched) and stretch goal (VLASS subset workflow) so access requests can be
  scoped precisely.

### Credential model

- No shared human accounts – each developer must be added individually to the
  ACCESS project.
- Gateway service uses least-privilege tokens and stores them in a secure vault
  or CI secret store; rotate periodically.
- Logging and events must redact authentication headers and token bodies.

## Notes

- Avoid committing any real API keys or secrets to source control; treat them as
  sensitive configuration. Use `.env` files or GitHub Actions secrets when
  needed for CI demos.
- The `tacc-integration.credential-security.spec.ts` already provides a model
  for the kinds of tests you should run once live access is available.
- Once credentials are obtained, update `TODO.md` and route remnant offline
  items to the backlog.

## Live Cutover Checklist

- [ ] Confirm the chosen interface (Tapis-first, SSH/Slurm fallback) via ADR.
- [ ] Set runtime gate `TACC_LIVE=true` only in approved environments.
- [ ] Configure `TACC_TENANT_BASE_URL` for the selected tenant.
- [ ] Configure auth variables (`TACC_CLIENT_ID`, `TACC_CLIENT_SECRET`,
      `TACC_SCOPES`) and execution settings (`TACC_SYSTEM_ID`, `TACC_APP_ID`,
      working/archive paths).
- [ ] Run smoke path: submit -> poll -> fetch output metadata.
- [ ] Verify redaction in logs/events and correlation IDs in audit trail.
- [ ] Validate rollback path by toggling back to demo mode.

## References (APA)

ACCESS. (n.d.). _Allocations policy_. <https://allocations.access-ci.org/allocations-policy>

Texas Advanced Computing Center. (n.d.). _Stampede3 user guide_. <https://docs.tacc.utexas.edu/hpc/stampede3/>

Texas Advanced Computing Center. (2025, December 16). _TACC user account policy updates for 2026_. <https://tacc.utexas.edu/news/user-updates/107609>

Tapis Project. (n.d.). _Authentication (Tapis v3)_. <https://tapis.readthedocs.io/en/latest/technical/authentication.html>

Tapis Project. (n.d.). _Jobs API (Tapis v3)_. <https://tapis.readthedocs.io/en/latest/technical/jobs.html>

---

_This document is intended to be living; update it with new contacts or findings
as the access effort progresses._

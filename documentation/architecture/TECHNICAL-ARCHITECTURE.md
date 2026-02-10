# VLASS Portal: Technical Architecture & Strategic Roadmap

## 1. Project Identity and Mission

The VLASS Portal is a specialized, independent public-data platform engineered to streamline the accessibility and utility of Very Large Array Sky Survey (VLASS) datasets. It is structurally and legally independent; this project maintains no affiliation with, sponsorship from, or operational ties to the National Radio Astronomy Observatory (NRAO), the Very Large Array (VLA), or the official VLASS program.

Our Minimum Viable Product (MVP) is anchored by three critical functional pillars:

- **Performance-Driven Delivery:** Implementing a high-speed Server-Side Rendering (SSR) architecture to achieve a first-paint target of <1 second on 4G connections.
- **Advanced Visualization:** Integration of the Aladin viewer, complemented by robust permalink and snapshot capabilities for precision data sharing.
- **Collaborative Documentation:** A native community notebook system supporting versioned revisions and technical posts.

---

## 2. Current Technical Architecture (The MVP Stack)

The portal is built on an Nx monorepo architecture. This centralized approach allows the engineering team to manage the entire stack in a single repository, ensuring strict contract safety between the frontend and backend through shared Data Transfer Objects (DTOs) and interfaces.

### Technology Stack

| Component | Technology | Role/Description |
| --- | --- | --- |
| **vlass-web** | Angular SSR | Performance-optimized frontend utilizing server-side pre-rendering for SEO and speed. |
| **vlass-api** | NestJS | Backend orchestration layer providing business logic and data aggregation. |
| **vlass-web-e2e** | Playwright | Frontend regression suite for UI validation and user-flow simulation. |
| **vlass-api-e2e** | Playwright | API contract testing and endpoint validation. |
| **libs/shared/models** | Nx Library (Shared Types) | Centralized TypeScript interfaces and models shared by both web and API services. |

### SSR-First Implementation

To meet our <1s first-paint performance benchmark, we utilize a NestJS-driven Angular SSR strategy. By offloading initial rendering to the server, we minimize the Time to Interactive (TTI) and reduce the client-side JavaScript execution required for the initial view, specifically targeting users on constrained mobile networks.

---

## 3. Development Operations and Quality Gates

The project adheres to a rigorous testing and deployment lifecycle governed by [TESTING-STRATEGY.md](../quality/TESTING-STRATEGY.md). Every release must pass through three distinct Quality Gates to ensure architectural integrity and performance stability.

### Release Quality Gates

1. **Documentation Compliance:** Verification of standards via `nx run docs-policy:check`
2. **Unit and Integration Testing:** A comprehensive sweep using `nx run-many --target=test --all`
3. **End-to-End Validation:** Success in the specialized `nx run mvp-gates:e2e` target

### Primary Development & Auditing Commands

We utilize `pnpm` as our primary package manager and task runner for the Nx workspace:

```bash
# Environment Initialization
pnpm start:all          # Initialize infrastructure, API, and Web services

# Focused Application Development
pnpm start:web          # Serve Angular frontend
pnpm start:api          # Serve NestJS backend

# Testing & Verification
pnpm test:api           # Execute NestJS unit tests
pnpm test:web           # Execute Angular unit tests
pnpm e2e:mvp            # Execute full Playwright E2E suite

# Performance Auditing
pnpm lighthouse:mobile  # Execute mobile performance audit
pnpm lighthouse:summary # Generate text/json summary for CI + AI consumers
```

### Testing Ecosystem

Our quality assurance stack comprises Vitest/Jest for high-speed unit testing, Playwright for cross-browser E2E validation, and Lighthouse for automated performance auditing. This multi-layered approach ensures that regressions are caught early in the development cycle.

---

## 4. Roadmap v1.1 & 2.0: Feature Evolution

The transition from MVP to subsequent versions involves shifting from a unified Node.js environment to a more polyglot, distributed architecture.

### Planned Enhancements

- **Go Microservice Integration:** We will introduce a high-concurrency Go-based service into the Nx ecosystem to handle computationally intensive backend tasks that exceed the performance profile of Node.js.

- **FITS Proxy:** Implementation of a specialized proxy to optimize the streaming and handling of Flexible Image Transport System (FITS) data.

- **Mode B Implementation:** This requires a significant extension of the data ingestion pipeline and schema support to accommodate the unique survey parameters and metadata requirements of VLASS Mode B.

- **Community Engagement Features:** Expansion of the existing notebook infrastructure to support threaded user comments and interactive feedback loops.

---

## 5. Technical Debt & Scope Management

To maintain delivery velocity and prevent feature creep, the project operates under a "hard freeze" for the MVP as defined in [SCOPE-LOCK.md](../index/SCOPE-LOCK.md). This management philosophy ensures that all non-essential enhancements are triaged into the v1.1/2.0 roadmap.

### Source of Truth Documentation

The project relies on the following canonical reference documents:

- [PRODUCT-CHARTER.md](../product/PRODUCT-CHARTER.md): Core mission, constraints, and project boundaries.
- [ARCHITECTURE.md](./ARCHITECTURE.md): Technical architectural blueprints and system design.
- [STATUS.md](../operations/STATUS.md): Real-time tracking of implementation progress against requirements.
- [SCOPE-LOCK.md](../index/SCOPE-LOCK.md): The definitive boundary between the MVP and future iterations.

---

## 6. Repository Composition & Language Distribution

The repository leverages a unified TypeScript stack to facilitate code sharing and maintainability across the monorepo:

- **TypeScript (76.5%):** Powering the logic for both NestJS and Angular.
- **SCSS (13.9%):** Modular, component-scoped styling.
- **HTML (5.7%):** Angular structural templates.
- **JavaScript (2.7%):** Build-time configuration and tooling.
- **Other (1.2%):** YAML configurations and markdown documentation.

This distribution reflects a modern, type-safe architecture designed for scalability and developer ergonomics.

---

## 7. Related Documentation

For additional architectural details and strategic planning, see:

- [MARKETING-OVERVIEW.md](../MARKETING-OVERVIEW.md) — Stakeholder-focused narrative covering MVP, Phase 2, and Phase 3
- [MARKETING-VISUAL-GUIDE.md](../MARKETING-VISUAL-GUIDE.md) — Visual specifications and infographic outlines
- [ROADMAP.md](../planning/ROADMAP.md) — Complete project timeline through Phase 4 (2027+)
- [FUNDING-AND-COSTS.md](../planning/funding/FUNDING-AND-COSTS.md) — Financial breakdown and grant strategy

---

*Last Updated: February 10, 2026*  
*Status: MVP Architecture Complete | Phase 2 Planning Underway*

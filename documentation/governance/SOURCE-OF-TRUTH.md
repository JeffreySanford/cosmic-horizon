# Source of Truth - Cosmic Horizons

**⚠️ DISCLAIMER: This project is not affiliated with VLA/NRAO and operates as an independent research portal.**

This document establishes the authoritative sources and decision-making frameworks for the Cosmic Horizons project.

## Related Governance Documents

- **[SCOPE-LOCK.md](../../SCOPE-LOCK.md)** - Project scope and boundaries
- **[PRODUCT-CHARTER.md](../../PRODUCT-CHARTER.md)** - Product vision and strategic charter

## Source of Truth Models

All shared data models and types are defined in centralized locations to ensure consistency:

- **Application Models**: `libs/shared/models/` - Nx shared library containing all TypeScript interfaces and data models
- **API Contracts**: OpenAPI specifications generated from NestJS decorators
- **Database Schema**: TypeORM entities in `apps/cosmic-horizons-api/src/app/database/entities/`

## Project Governance

### Repository Structure

- **Primary Repository**: [JeffreySanford/cosmic-horizon](https://github.com/JeffreySanford/cosmic-horizon)
- **Monorepo Layout**: Nx-based workspace containing applications and libraries
- **Deployment Target**: TACC open-source AI data platform

### Configuration Authority

| Configuration Type | Source of Truth | Location |
|---|---|---|
| **Build & Dependency** | `package.json` + `pnpm-lock.yaml` | Root directory |
| **TypeScript Settings** | `tsconfig.base.json` + project-specific configs | Root and app directories |
| **Linting Rules** | `eslint.config.mjs` | Root directory |
| **Testing Configuration** | `jest.config.ts`, `jest.preset.js`, `vitest.workspace.ts` | Root and project directories |
| **CI/CD Workflows** | `.github/workflows/` | Git Actions workflows |
| **Kubernetes/Docker** | `docker-compose.yml` | Root directory |
| **API Contracts** | OpenAPI specifications in app configs | `apps/cosmic-horizons-api` |

### Environment Configuration

**Development Environment** (`environment.ts`):

- Source: `apps/cosmic-horizons-api/src/app/config/environment.ts`
- Non-sensitive defaults available in `.env.example` files
- Tiered fallback: `process.env` → `.env.local` → `.env.example` → hardcoded defaults

**Production Environment** (`environment.prod.ts`):

- Source: `apps/cosmic-horizons-api/src/app/config/environment.prod.ts`
- Requires all secrets to be set via GitHub Actions secrets
- Fail-fast validation on startup

**Seeded Test Users** (for development):

- `test@cosmic.local` - User role (password: test)
- `admin@cosmic.local` - Admin role (password: admin)

### Testing Requirements

All code changes must pass:

- **Lint**: `pnpm nx run-many --target=lint --all --max-warnings 99999`
- **Unit Tests**: `pnpm nx run-many --target=test --all` (181+ tests)
- **E2E Tests**: `pnpm nx run mvp-gates:e2e` (26+ tests)
- **Type Checking**: `pnpm nx run-many --target=typecheck --all`

### Documentation Standards

**Architecture Decisions** (ADRs):

- Location: `documentation/adr/`
- Format: Follow ADR template
- Approval: Required before implementation

**Technical Documentation**:

- API Documentation: Swagger/OpenAPI in `apps/cosmic-horizons-api`
- Setup Guides: `documentation/setup/`
- Reference Materials: `documentation/reference/`
- Security: `documentation/security/`

### Release Process

1. **Feature Development**: Create feature branch
2. **Code Review**: Pull request to `main`
3. **Integration Tests**: CI/CD workflows must pass
4. **Deployment**: Automatic on merge to `main`
5. **Monitoring**: GitHub Actions workflows track deployment

### CosmicAI Integration Points

The codebase is designed to integrate with:

- `AlphaCal`: Autonomous interferometric calibration
- `Radio Image Reconstruction`: GPU-accelerated models
- `Anomaly Detection`: Transfer-learning models
- `CosmicAI Assistant`: TACC-hosted specialized assistant

See `AGENTS.md` for technical integration targets.

## Decision Log

| Date | Decision | Owner | Status |
|---|---|---|---|
| 2024 | Environment configuration refactored | Team | ✅ Implemented |
| 2024 | Docker-compose service naming standardized | DevOps | ✅ Implemented |
| 2024 | ESLint warnings allowed in CI (max 99999) | DevOps | ✅ Implemented |

## Contact & Questions

For questions about governance and project structure, refer to:

- `CONTRIBUTING.md` - Contribution guidelines
- `README.md` - Project overview
- `.github/` - Workflow configurations
- `documentation/` - All technical documentation

---

**Last Updated**: February 13, 2026
**Maintained By**: Cosmic Horizons Team

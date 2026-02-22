# Quick Start Guide

**⚠️ DISCLAIMER: This project is not affiliated with VLA/NRAO and operates as an independent research portal.**

Get up and running with Cosmic Horizons in minutes!

## Prerequisites

- **Node.js 20+**: [Download](https://nodejs.org/)
- **pnpm 9.8.0+**: `npm install -g pnpm`
- **Docker & Docker Compose**: [Download](https://www.docker.com/products/docker-desktop)
- **Git**: [Download](https://git-scm.com/)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/JeffreySanford/cosmic-horizon.git
cd cosmic-horizon
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment

```bash
# Copy example environment files
cp .env.example .env.local
cp apps/cosmic-horizons-api/.env.example apps/cosmic-horizons-api/.env.local
cp apps/cosmic-horizons-web/.env.example apps/cosmic-horizons-web/.env.local
```

Edit `.env.local` with your configuration (optional for local development).

### 4. Start Infrastructure

```bash
pnpm run start:infra
```

This starts infrastructure without tearing down existing containers/volumes.

### 5. Start Development Servers

**Terminal 1 - API Server:**

```bash
pnpm nx serve cosmic-horizons-api
```

**Terminal 2 - Web Application:**

```bash
pnpm nx serve cosmic-horizons-web
```

### 6. Access the Application

- **Web App**: <http://localhost:4200>
- **API Docs**: <http://localhost:3000/api/docs>
- **API**: <http://localhost:3000/api>

## Test Users (Local Development)

- **User**: `test@cosmic.local` / `test`
- **Admin**: `admin@cosmic.local` / `admin`

## Run Tests

```bash
# Unit tests
pnpm nx run-many --target=test --all

# E2E tests
pnpm nx run mvp-gates:e2e

# Lint
pnpm nx run-many --target=lint --all
```

## Key Commands

| Command                                 | Purpose                                                |
| --------------------------------------- | ------------------------------------------------------ |
| `pnpm nx serve cosmos-horizons-api`     | Start API dev server                                   |
| `pnpm nx serve cosmic-horizons-web`     | Start web dev server                                   |
| `pnpm nx run-many --target=build --all` | Build all projects                                     |
| `pnpm nx run-many --target=test --all`  | Run all unit tests                                     |
| `pnpm run start:infra`                  | Start Docker infrastructure (state-preserving)         |
| `pnpm run start:infra:reset`            | Rebuild and reset Docker infrastructure (destructive)  |
| `pnpm run start:all`                    | Start infra + web/api without resetting Docker volumes |
| `pnpm run start:all:reset`              | Reset infra, then start web/api                        |
| `pnpm run start:ports:free`             | Free up used ports                                     |
| `pnpm run llm:warmup`                   | Pull/warm local Ollama model and wait for completion   |
| `pnpm run llm:doctor`                   | Run LLM readiness suite (models + quick + full smoke)  |
| `pnpm run llm:ready`                    | One-command LLM readiness (`warmup -> doctor`)         |
| `pnpm run llm:status`                   | Show Ollama container status + port bindings           |
| `pnpm run llm:logs`                     | Tail Ollama logs (`OLLAMA_LOG_TAIL_LINES` supported)   |

## Local LLM Readiness

After infrastructure starts, verify local LLM runtime readiness:

```bash
pnpm run llm:ready
```

This command runs:

1. `llm:warmup` to ensure model availability.
2. `llm:doctor` to run consolidated readiness checks.

## Project Structure

```text
cosmic-horizons/
├── apps/
│   ├── cosmic-horizons-api/        # NestJS backend
│   ├── cosmic-horizons-api-e2e/    # API E2E tests
│   ├── cosmic-horizons-web/        # Angular frontend
│   └── cosmic-horizons-web-e2e/    # Web E2E tests
├── libs/                           # Shared libraries
├── documentation/                  # All project docs
├── scripts/                        # Utility scripts
├── docker-compose.yml              # Infrastructure
└── nx.json                         # Nx configuration
```

## Troubleshooting

### Port Already in Use

```bash
pnpm run start:ports:free
```

### Docker Issues

```bash
# Remove all containers and volumes
docker compose down -v

# Rebuild
pnpm run start:infra
```

### Expected Startup Noise (Normal)

- One-time Kafka coordinator/topic metadata messages may appear during the first few seconds of broker warm-up.
- A brief RabbitMQ management API miss can occur immediately after boot before queue metadata is available.
- These are transient during startup; persistent/repeating errors after ~15 seconds indicate a real issue.

### Clear Cache

```bash
pnpm nx reset
```

## Documentation

For more detailed information, see:

- [Architecture Guide](../architecture/ARCHITECTURE.md)
- [Environment Configuration](../setup/ENVIRONMENT-CONFIG.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)
- [GitHub Actions Monitoring](./GITHUB-ACTIONS-MONITORING.md)

## Need Help?

- Check [documentation/](../) for comprehensive guides
- Review [CONTRIBUTING.md](../../CONTRIBUTING.md) for development standards
- Check test files for usage examples

---

**Next Step**: Read the [Architecture Guide](../architecture/ARCHITECTURE.md) to understand the system design.

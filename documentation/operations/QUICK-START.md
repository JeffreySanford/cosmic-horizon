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

This starts PostgreSQL and Redis containers.

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

| Command | Purpose |
|---------|---------|
| `pnpm nx serve cosmos-horizons-api` | Start API dev server |
| `pnpm nx serve cosmic-horizons-web` | Start web dev server |
| `pnpm nx run-many --target=build --all` | Build all projects |
| `pnpm nx run-many --target=test --all` | Run all unit tests |
| `pnpm run start:infra` | Start Docker infrastructure |
| `pnpm run start:ports:free` | Free up used ports |

## Project Structure

``` text
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

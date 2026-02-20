# Gemini Project: Cosmic Horizons

This document provides instructions and context for working on the Cosmic Horizons project with an AI agent.

## Project Overview

Cosmic Horizons is a scientific operations platform for AI-driven radio astronomy. It is a monorepo built with [Nx](https://nx.dev).

- **Frontend**: Angular (`apps/cosmic-horizons-web`)
- **Backend**: NestJS (`apps/cosmic-horizons-api`)
- **Database**: PostgreSQL and Redis
- **Infrastructure**: Dockerized environment with Kafka, Pulsar, and RabbitMQ for event-driven architecture.
- **Shared Code**: Shared models and libraries are located in `libs/shared`.

## Getting Started

The project uses `pnpm` as its package manager.

### Prerequisites

- [Node.js](https://nodejs.org/) (see `.nvmrc` for version)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/)

### Installation

```bash
pnpm install
```

### Running the Application

To run the entire application stack (frontend, backend, and Docker infrastructure):

```bash
pnpm start:all
```

This command will:
1.  Ensure required ports are free.
2.  Start the Docker containers for databases and message brokers.
3.  Run database migrations.
4.  Start the Angular frontend and NestJS backend.

### Running Individual Components

- **Start the web frontend:**
  ```bash
  pnpm start:web
  ```

- **Start the API backend:**
  ```bash
  pnpm start:api
  ```

- **Start the Docker infrastructure:**
  ```bash
  pnpm start:infra
  ```

- **Stop the Docker infrastructure:**
  ```bash
  pnpm stop:infra
  ```

## Development

### Running Tests

- **Run all tests:**
  ```bash
  pnpm test
  ```

- **Run frontend tests:**
  ```bash
  pnpm test:web
  ```

- **Run backend tests:**
  ```bash
  pnpm test:api
  ```

### Linting and Formatting

- **Run linting checks:**
  ```bash
  pnpm lint
  ```

- **Format all files:**
  ```bash
  pnpm format
  ```

### Building the Project

- **Build all applications and libraries:**
  ```bash
  pnpm build
  ```

## Architecture

- **Monorepo**: This project is a Nx monorepo. Code is organized into applications (`apps`) and libraries (`libs`).
- **Shared Models**: TypeScript interfaces and data models are shared between the frontend and backend in `libs/shared/models`.
- **Event-Driven**: The backend uses an event-driven architecture with message brokers (Kafka, Pulsar, RabbitMQ) for asynchronous communication. The `docker-compose.events.yml` file defines these services.
- **API**: The NestJS backend provides a RESTful API. Refer to `documentation/backend/API-ROUTES.md` for detailed API documentation.
- **Authentication**: Authentication is handled via JWT Bearer tokens, with support for email/password and GitHub OAuth.

## Additional Documentation

- **Architecture**: `documentation/architecture/ARCHITECTURE.md`
- **API Routes**: `documentation/backend/API-ROUTES.md`

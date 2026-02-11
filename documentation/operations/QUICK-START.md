# Quick Start

Status date: 2026-02-07

## Prerequisites

- Node.js 20+

- pnpm 9+

## Install

```bash
pnpm install

```

## Run

Recommended (infra + app):

```bash
pnpm start:all

```

Split mode (two terminals, no infra automation):

Terminal 1:

```bash
pnpm start:web

```

Terminal 2:

```bash
pnpm start:api

```

## Test

```bash
pnpm test
pnpm test:web
pnpm test:api

```

## Build

```bash
pnpm build

```

## Notes

- Nx is the primary task runner.

- `pnpm` scripts are wrappers around Nx targets.

- `start:all` runs:

  1. `start:ports:free`

  2. `start:infra` (`docker compose down --volumes`, build, up `--wait`)

  3. `pnpm nx run-many --target=serve --projects=vlass-web,vlass-api`

## - Go and Mode B are deferred and not part of MVP setup
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*

---
*Independent portal using public VLASS data; not affiliated with VLA/NRAO.*

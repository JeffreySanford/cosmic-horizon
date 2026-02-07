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

Use two terminals:

Terminal 1:

```bash
pnpm dev:web
```

Terminal 2:

```bash
pnpm dev:api
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
- Go and Mode B are deferred and not part of MVP setup.

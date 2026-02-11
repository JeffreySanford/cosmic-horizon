# shared-models

Status date: 2026-02-07

This library is the source-of-truth contract model for shared API/data shapes.

## Role

- Defines shared DTO/types used across web and API layers.
- Documentation and route definitions should not diverge from these contracts.

## Precedence

If docs conflict with model contracts, update docs to match `libs/shared/models`.

## Running unit tests

Run `pnpm nx test shared-models`.

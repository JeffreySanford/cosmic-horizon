# AI Skills Setup (Nx, Angular, Material, Nest, Docker, Go)

Status date: 2026-02-21

## Goal

Define a standard skill set for Codex-assisted development in this workspace.

## Recommended Skill Pack

- [x] Nx workspace navigation/execution
- [x] Angular architecture and routing
- [x] Angular Material (MD3) component/theming patterns
- [x] NestJS module/service/controller patterns
- [x] Docker local orchestration and debugging
- [x] Go service utility patterns (when Go components are reintroduced)

## Current Session Capability

The current Codex runtime exposes these install-oriented system skills:

- [x] `skill-installer`
- [x] `skill-creator`

Curated listing check executed via `skill-installer`:

- [x] Curated skill catalog queried
- [x] Confirmed no curated Nx/Angular/Material/Nest/Docker/Go skills available at time of check

## Installation Status (Processed)

Installed local skills into Codex home (`C:/Users/Sanford/.codex/skills`):

- [x] `nx-workspace`
- [x] `angular-workspace`
- [x] `angular-material-md3`
- [x] `nest-workspace`
- [x] `docker-workspace`
- [x] `go-workspace`

Validation:

- [x] All six skills passed `quick_validate.py`

## How to Add Them

1. [x] Use `skill-installer` to install curated skills where available.
2. [x] For missing domains, use `skill-creator` to scaffold project-specific skills.
3. [x] Store project-local skill docs in a tracked folder (recommended: `documentation/guides/skills/`).
4. [x] Add short trigger rules and examples per skill.
5. [x] Keep Nx commands pnpm-prefixed in skill examples (for this repo standard).

## Suggested Initial Skill Specs

### 1) Nx Workspace Skill

- Focus: project graph discovery, target lookup, affected commands, run-many workflows.
- Must include: `pnpm nx` command patterns and common CI gates.

### 2) Angular Skill

- Focus: route/component architecture, SSR-safe patterns, reactive forms, standalone vs module strategy.
- Must include: route-group shell/header behavior conventions.

### 3) Angular Material (MD3) Skill

- Focus: token usage from `src/styles/common` and `src/styles/material`, contrast-safe component theming.
- Must include: snackbar/menu/dialog contrast checks.

### 4) Nest Skill

- Focus: module boundaries, DTO validation, interceptor/guard patterns, audit logging.
- Must include: feature-flag and mode-gated behavior conventions.

### 5) Docker Skill

- Focus: local compose workflows, reset/start semantics, service health inspection.
- Must include: event stack (`docker-compose.events.yml`) and troubleshooting commands.

### 6) Go Skill

- Focus: optional utilities/services, API contract compatibility, build/test/lint standards.
- Must include: explicit note that Go is currently deferred for MVP scope.

## Acceptance Criteria

- [x] Skill docs exist for each domain.
- [x] Each skill includes: purpose, trigger cues, command snippets, and guardrails.
- [x] Links from `README.md` are valid.

## Seeded Skill Specs In Repo

- [x] `documentation/guides/skills/NX-WORKSPACE-SKILL.md`
- [x] `documentation/guides/skills/ANGULAR-SKILL.md`
- [x] `documentation/guides/skills/MATERIAL-MD3-SKILL.md`
- [x] `documentation/guides/skills/NEST-SKILL.md`
- [x] `documentation/guides/skills/DOCKER-SKILL.md`
- [x] `documentation/guides/skills/GO-SKILL.md`

## VS Code Activation Step

- [ ] Restart VS Code/Codex session to load newly installed local skills.

---

_Independent portal using public VLASS data; not affiliated with VLA/NRAO._

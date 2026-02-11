# Marketing Workspace

Status date: 2026-02-10

This folder contains reusable conference and proposal-facing material.

## Structure

- `documentation/marketing/abstracts/` - abstract drafts and submission variants

- `documentation/marketing/letters/` - outreach/contact templates and target lists

- `documentation/marketing/letters/NRAO-HELPDESK-POLICY-REQUEST.md` - permission-first ticket template for FITS/policy boundaries

- `documentation/marketing/scope/` - proposal scope and delivery framing

- `documentation/marketing/scope/DATA-POLICY-BOUNDARIES.md` - NRAO/VLASS permission and policy guardrails

- `documentation/marketing/graphics/` - AI platform guidance and prompt packs for visuals

## Current Focus

- Cosmic Horizons Conference 2026 (July 13-16, 2026, Charlottesville, Virginia)

- Positioning vlass-portal as the web-native operational interface for AI-driven radio astronomy workflows

- Outreach to program leadership, working-group leads, and research software stakeholders

## Quick Start

1. Start with `documentation/marketing/scope/COSMIC-HORIZONS-2026-SCOPE.md`.

2. Confirm policy guardrails in `documentation/marketing/scope/DATA-POLICY-BOUNDARIES.md`.

3. Use `documentation/marketing/abstracts/COSMIC-HORIZONS-2026-ABSTRACT.md`.

4. Personalize and send `documentation/marketing/letters/OUTREACH-EMAIL-TEMPLATE.md`.

5. Send policy request via `documentation/marketing/letters/NRAO-HELPDESK-POLICY-REQUEST.md`.

6. Generate visuals using `documentation/marketing/graphics/MIRO-PROMPT-PACK.md`.

## Mermaid Visual PDF

- Source: `documentation/MARKETING-VISUAL-GUIDE.md`

- Generator: `scripts/generate-marketing-visuals-pdf.mjs`

- Outputs:

  - `documentation/marketing/vlass-marketing-visuals.html`

  - `documentation/marketing/vlass-marketing-visuals.pdf`

  - `documentation/marketing/vlass-marketing.pdf` (updated canonical copy)

Run:

```bash
node scripts/generate-marketing-visuals-pdf.mjs

```

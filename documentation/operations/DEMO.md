# Golden Path Demo (MVP)

Goal: let a reviewer validate MVP value in under 3 minutes.

Affiliation note: this demo is for an independent public-data project and is not an official VLA/NRAO demonstration.

## Start Here

1. Run `pnpm install`.
2. Run `pnpm start:all`.
3. Open `http://localhost:4200`.

## Demo Flow

1. Open landing page and confirm server-side rendered content appears immediately.
2. Navigate to Viewer.
3. Use one of the canned coordinates below.
4. Switch survey layer in Aladin.
5. Create and copy a permalink.
6. Open permalink in a new tab and verify restored state.
7. Navigate to Community Posts and open a notebook entry.

## Canned Sky Targets

- M87 core: `RA 187.7059`, `Dec 12.3911`
- Cygnus A: `RA 299.8682`, `Dec 40.7339`

## Expected Screenshots

Capture and place screenshots in `documentation/screenshots/`:

- `01-landing-ssr.png`: landing page first paint with SSR content.
- `02-viewer-target.png`: viewer centered on target coordinates.
- `03-viewer-permalink.png`: permalink/share state visible.
- `04-notebook-post.png`: community notebook post detail.

## Reviewer Pass Criteria

- SSR route loads without client-side blank state.
- Viewer renders selected sky target and survey.
- Permalink reproduces viewer state in a new tab.
- Notebook content is reachable from the app shell.

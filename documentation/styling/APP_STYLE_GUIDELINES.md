# Cosmic Horizons App Style Guidelines

This document defines the shared visual language for all pages in the application.

## Implementation Status

### Goals

- [x] Keep all pages visually consistent and clearly part of one product.
- [x] Make high-density operational data readable and scannable.
- [x] Use vivid color intentionally, not randomly.
- [x] Maintain accessibility and contrast in all themes/components.

### Design Principles

- [x] Consistency first.
- [x] Hierarchy over decoration.
- [x] Motion with purpose.
- [x] Accessibility always.

### Global Layout System

- [x] Single app shell pattern (sticky header, scrollable content surface, shared footer).
- [x] Consistent max content widths per page type.
- [x] Standard page spacing baseline applied.

### Typography

- [x] One primary app-wide font stack.
- [x] Clear type hierarchy in shared shell and key pages.
- [x] Full normalization of one-off font sizes across all feature pages.
- [x] Strong text contrast on dark backgrounds.

### Color System

- [x] Centralized vibrant token palette introduced.
- [x] Vivid accents used for CTA/status/focus states.
- [x] Final pass to reduce any remaining mixed accent usage on specific pages.

### MD3 Style Architecture

- [x] `styles.scss` is the single global style entrypoint.
- [x] MD3 theme roles/tokens are defined in `src/styles/common` and `src/styles/material`.
- [x] Shared base/reset/typography/utilities are centralized in `src/styles/common`.
- [x] Shared Angular Material MD3 component overrides are centralized in `src/styles/material`.
- [x] Feature/page styles consume shared tokens instead of redefining global primitives.

### Header System

- [x] Collapsed header is compact and focused.
- [x] Expanded header contains page insights.
- [x] Page hints removed from collapsed header.
- [x] Header defaults to collapsed.
- [x] Header supports route/page event-driven expand/collapse control.

### Components

- [x] Buttons: consistent core style and high-contrast variants.
- [x] Cards: shared border/shadow/background treatment.
- [x] Forms: shared Material field focus/outline styling.
- [x] Menus/overlays: high-contrast text/icons and consistent dark panel styling.

### Motion

- [x] Short transitions for hover/focus/expand-collapse.
- [x] Route reveal animation added.
- [x] Optional stagger utility added for progressive reveal.
- [x] Per-page motion intensity tuned by page type.

### Accessibility

- [x] Contrast improvements for header, menus, and overlays.
- [x] Contrast-safe snackbar styling for success/warning/error states.
- [x] Keyboard-reachable interactive controls maintained.
- [x] Visible focus/active behavior preserved in shared controls.
- [x] Icon-only controls use aria labels in shared header controls.

### Visual Intensity By Page Type

- [x] Dense operational pages tuned to calmer visual intensity.
- [x] User-facing pages tuned to richer visual intensity.
- [x] Shared-control baseline harmonized after intensity split.

### Governance

- [x] Root-level style guideline established.
- [x] Second-pass tuning process documented.
- [x] Exception log process populated for any page-specific deviations.

## 1. Goals

- Keep all pages visually consistent and clearly part of one product.
- Make high-density operational data readable and scannable.
- Use vivid color intentionally, not randomly.
- Maintain accessibility and contrast in all themes/components.

## 2. Design Principles

- Consistency first: same spacing, typography scale, card styles, and interaction patterns across features.
- Hierarchy over decoration: emphasize content priority with structure before adding visual effects.
- Motion with purpose: animations should support orientation and feedback, not distract.
- Accessibility always: meet contrast, keyboard navigation, and readable type requirements.

## 3. Global Layout System

- Use a single app shell pattern:
  - Sticky header
  - Scrollable content surface
  - Shared footer
- Use consistent max content widths per page type:
  - Dashboard pages: wide (`1200-1400px`)
  - Form/content pages: medium (`900-1100px`)
- Standard page spacing:
  - Desktop outer padding: `16-24px`
  - Mobile outer padding: `10-14px`
  - Section gap: `12-20px`

## 4. Typography

- Use one primary font stack app-wide.
- Use one clear type scale:
  - Page title
  - Section title
  - Body text
  - Caption/meta text
- Avoid one-off font sizes unless justified by a component pattern.
- Ensure text contrast is strong on dark backgrounds.

## 5. Color System

- Keep a centralized token palette:
  - Primary surface/background tones
  - Brand accent tones
  - Semantic colors (`success`, `warning`, `error`, `info`)
- Vivid accents should be used for:
  - Calls to action
  - Important status indicators
  - Focus and active states
- Avoid mixing too many unrelated accent colors on a single screen.

## 5A. MD3 Style Architecture

- Keep `apps/cosmic-horizons-web/src/styles.scss` as the only global style entrypoint.
- Keep `apps/cosmic-horizons-web/src/styles/global.scss` as a composition/orchestration file only.
- Place shared primitives in `apps/cosmic-horizons-web/src/styles/common`:
  - Theme roles/tokens
  - Base reset and element normalization
  - Typography and utilities
  - Motion utilities
- Place shared Angular Material overrides in `apps/cosmic-horizons-web/src/styles/material`.
- Do not duplicate global colors/typography in page styles; consume shared CSS variables.

## 6. Header System

- Collapsed header must stay compact and focused:
  - Current page identity
  - Breadcrumb context
  - Key controls (expand, user menu, mode toggle)
- Expanded header contains page hints/insights.
- Page hint content must not appear in collapsed mode.
- Header expansion defaults to collapsed and is controlled by route/page events.

## 7. Components

- Buttons:
  - Consistent radius, height, and icon alignment.
  - Clear primary/secondary/destructive variants.
- Cards:
  - Shared border, shadow, and background treatment.
  - Consistent title and content spacing.
- Forms:
  - Standard label, input, help, and error spacing.
  - Uniform field heights.
- Menus/overlays:
  - High-contrast text/icons.
  - Consistent panel background and hover states.

## 8. Motion Guidelines

- Use short, smooth transitions (`150-280ms`) for:
  - Hover/focus feedback
  - Expand/collapse
  - Route section reveals
- Avoid large or repeated motion loops in data-heavy screens.

## 9. Accessibility Standards

- Text/background contrast should meet WCAG AA at minimum.
- Text contrast must be explicitly checked for every new or modified UI state.
- Contrast checks are required for normal, hover, active, focus, disabled, and error states.
- Contrast checks are required for overlay surfaces (menus, dialogs, snackbars, tooltips).
- All interactive controls must be keyboard reachable.
- Focus states must be visible and consistent.
- Icon-only controls require `aria-label`.

## 10. Visual Intensity By Page Type

Use different visual intensity levels by page purpose.

- Dense operational pages (Operations, Logs, Alerts, Job dashboards):
  - Prefer calmer surfaces and lower saturation accents.
  - Keep animation subtle and functional.
  - Prioritize readability and scan speed over decoration.
- User-facing interaction pages (Profile, Community, Viewer, Landing):
  - Allow richer color accents and stronger visual personality.
  - Use expressive but controlled motion.
  - Emphasize discoverability and engagement.
- Shared controls (header, nav, menus, dialogs):
  - Keep one consistent baseline style across all page types.
  - Only vary accent intensity, not component behavior.

## 11. Second-Pass Tuning Process

After global styling updates:

- Run a second pass to tune intensity per page group.
- Check each page group against these criteria:
  - Data density readability
  - Contrast and focus clarity
  - Motion appropriateness
  - Brand consistency
- Capture any page-level overrides in this document before implementation.

## 12. Page Implementation Checklist

For every page/feature:

- Uses global spacing and type scale.
- Uses shared color tokens only.
- Has consistent card/button/form styles.
- Has accessible contrast and focus states.
- Avoids custom one-off UI patterns unless approved.

## 13. Governance

- Any new visual pattern must be documented here before broad adoption.
- If a page needs a justified exception, record:
  - Why default pattern fails
  - What changed
  - Where it applies

## 14. Exception Log

- `2026-02-21` | `operations/broker-comparison` | Kept stronger status semantic colors (`success/warn/error`) than baseline calm ops pages to preserve at-a-glance broker health triage. Applied with dark-surface tokens and WCAG-safe foregrounds.

## 15. Progress Updates

- `2026-02-21` Completed:
  - Added global text, semantic, and typography tokens in `global.scss`.
  - Normalized auth page typography/semantic styling (`login`, `register`) to shared tokens.
  - Restyled shared footer to match app shell tokens and contrast targets.
  - Reworked `operations/broker-comparison` to shared dark surfaces, unified accents, and contrast-safe status treatments.
- `2026-02-21` Completed:
  - Refactored global styling into MD3 layers under `src/styles/common` and `src/styles/material`.
  - Converted `src/styles/global.scss` to composition-only imports.
  - Confirmed `src/styles.scss` remains the single app-wide style entrypoint.
- `2026-02-21` Completed:
  - Normalized app feature typography to shared `--ch-font-size-*` tokens and removed hardcoded `px` font-size/line-height declarations from app component SCSS.
  - Extended shared typography tokens in `src/styles/common/_tokens.scss` to support display/title/caption scales used across route groups.

---

Suggested follow-up: convert these rules into design tokens/utilities and add screenshot-based visual regression checks for key pages.

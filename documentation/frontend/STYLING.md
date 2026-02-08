# Frontend Styling & Design System

**Date:** 2026-02-07  
**Status:** MVP - Production Ready  
**Framework:** Angular Material 3 + SCSS  
**Design System:** Material Design 3 (MD3)

---

## Table of Contents

1. [Design System Overview](#design-system-overview)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Layout & Spacing](#layout--spacing)
5. [Components & Patterns](#components--patterns)
6. [SCSS Architecture](#scss-architecture)
7. [Theme Customization](#theme-customization)
8. [Responsive Design](#responsive-design)
9. [Accessibility](#accessibility)
10. [CSS Conventions](#css-conventions)

---

## Design System Overview

The VLASS Portal frontend uses **Angular Material 3** as the design system. This provides:

- **Pre-built, accessible components:** Buttons, forms, cards, tables, dialogs
- **Consistent visual language:** Colors, typography, spacing
- **Theming engine:** Easy light/dark mode support
- **Material Design 3 spec compliance:** Modern, professional appearance

### Design Principles

1. **Scientific + Modern:** Convey expertise while remaining approachable
2. **Information-Dense Yet Clear:** Show lots of data without overwhelming users
3. **Interactive Feedback:** Immediate response to user actions
4. **Accessibility First:** WCAG 2.1 AA compliance minimum

---

## Color Palette

### Primary Colors

| Name | Hex | Use Case |
| --- | --- | --- |
| **Primary** | `#1976D2` | Main actions, links, focus states |
| **Primary Light** | `#6BA3FF` | Hover, disabled states |
| **Primary Dark** | `#004BA0` | Pressed states |

### Secondary Colors

| Name | Hex | Use Case |
| --- | --- | --- |
| **Accent** | `#FF6F00` | Highlight actions (Save, Publish) |
| **Accent Light** | `#FFA040` | Hover on accent buttons |
| **Accent Dark** | `#C41C00` | Pressed states |

### Semantic Colors

| Name | Hex | Use Case |
| --- | --- | --- |
| **Success** | `#4CAF50` | Positive actions, success messages |
| **Warning** | `#FFC107` | Caution, pending states |
| **Error** | `#F44336` | Errors, destructive actions |
| **Info** | `#2196F3` | Informational messages |

### Neutral Colors

| Name | Hex | Use Case |
| --- | --- | --- |
| **Background** | `#FAFAFA` | Page background |
| **Surface** | `#FFFFFF` | Card/panel background |
| **Surface Variant** | `#F5F5F5` | Alternate surface (disabled, hover) |
| **On Background** | `#212121` | Text on background |
| **On Surface** | `#212121` | Text on surface |
| **Border** | `#E0E0E0` | Dividers, borders |

### Sky Canvas Colors

For the Aladin viewer sky canvas:

- **Background:** `#000814` (deep space black)
- **Grid lines:** `#4ECDC4` (cyan for visibility)
- **Selection:** `#FF6B6B` (red for user-selected regions)
- **Annotations:** `#95E1D3` (mint green for labels)

---

## Typography

### Font Stack

```scss
// Primary font (UI)
$font-family-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

// Monospace font (code, coordinates)
$font-family-mono: 'Courier New', 'Monaco', 'Menlo', monospace;
```

### Type Scales

Following Material Design 3 typography:

| Name | Size | Weight | Line Height | Use Case |
| --- | --- | --- | --- | --- |
| **Display Large** | 57px | 400 | 64px | Page titles, hero |
| **Display Medium** | 45px | 400 | 52px | Major section headers |
| **Headline Small** | 24px | 500 | 32px | Feature headers |
| **Title Large** | 22px | 500 | 28px | Card titles, component headers |
| **Title Medium** | 16px | 500 | 24px | Subheadings |
| **Body Large** | 16px | 400 | 24px | Main content |
| **Body Medium** | 14px | 400 | 20px | Supporting text |
| **Label Large** | 14px | 500 | 20px | Form labels, buttons |
| **Label Small** | 12px | 500 | 16px | Badge labels, small text |

### Implementation

```typescript
// styles.scss
@import '@angular/material/typography';

$custom-typography: mat.define-typography-config(
  $font-family: $font-family-primary,
  $headline-1: mat.define-typography-level(57px, 64px, 400),
  $headline-2: mat.define-typography-level(45px, 52px, 400),
  // ... more levels
);

@include mat.core($custom-typography);
```

---

## Layout & Spacing

### Spacing Scale (Based on 8px grid)

```scss
$spacing-xs: 4px;   // Tight spacing
$spacing-sm: 8px;   // Small gap
$spacing-md: 16px;  // Standard gap
$spacing-lg: 24px;  // Large gap
$spacing-xl: 32px;  // Extra large gap
$spacing-2xl: 48px; // Huge gap
```

### Layout Patterns

#### Container Max Width

```scss
$container-max-width: 1200px;
$container-padding: $spacing-lg;

.container {
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 0 $container-padding;
}
```

#### Grid System

Using CSS Grid for layouts:

```scss
// Two-column layout (sidebar + main)
.layout-sidebar {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: $spacing-lg;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

// Card grid
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: $spacing-lg;
}
```

#### Flexbox Patterns

```scss
// Center content vertically + horizontally
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}

// Space between (header with buttons on right)
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
}

// Flex column with spacing
.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}
```

---

## Components & Patterns

### Material Buttons

```html
<!-- Primary action (blue) -->
<button mat-raised-button color="primary">Save</button>

<!-- Secondary action (outlined) -->
<button mat-stroked-button>Cancel</button>

<!-- Accent action (orange) -->
<button mat-raised-button color="accent">Publish</button>

<!-- Icon button -->
<button mat-icon-button aria-label="Menu">
  <mat-icon>menu</mat-icon>
</button>

<!-- Disabled state -->
<button mat-raised-button disabled>Loading...</button>
```

**CSS Classes Added:**

- `.mat-raised-button` — Solid background
- `.mat-stroked-button` — Outline only
- `.mat-icon-button` — Icon-only small button
- `[color="primary"]` — Apply primary color
- `[disabled]` — Disable interaction

### Form Controls

```html
<!-- Text input with label -->
<mat-form-field appearance="outline">
  <mat-label>Right Ascension</mat-label>
  <input matInput type="number" formControlName="ra" />
  <mat-error *ngIf="form.get('ra')?.hasError('required')">
    RA is required
  </mat-error>
</mat-form-field>

<!-- Select dropdown -->
<mat-form-field appearance="outline">
  <mat-label>Survey</mat-label>
  <mat-select formControlName="survey">
    <mat-option value="VLASS">VLASS</mat-option>
    <mat-option value="DSS2">DSS2</mat-option>
  </mat-select>
</mat-form-field>

<!-- Checkbox toggle -->
<mat-checkbox 
  [checked]="isEnabled" 
  (change)="onToggle($event)">
  Enable Grid
</mat-checkbox>

<!-- Slide toggle (switch) -->
<mat-slide-toggle 
  [checked]="darkMode" 
  (change)="toggleDarkMode()">
  Dark Mode
</mat-slide-toggle>
```

### Cards & Containers

```html
<!-- Material card -->
<mat-card>
  <mat-card-header>
    <div mat-card-avatar></div>
    <mat-card-title>Card Title</mat-card-title>
    <mat-card-subtitle>Subtitle</mat-card-subtitle>
  </mat-card-header>
  <mat-card-content>
    Content here
  </mat-card-content>
  <mat-card-actions>
    <button mat-button>Action</button>
  </mat-card-actions>
</mat-card>
```

### Data Tables

```html
<!-- Material DataTable for logs, posts, etc. -->
<table mat-table [dataSource]="logs">
  <!-- Type column -->
  <ng-container matColumnDef="type">
    <th mat-header-cell>Type</th>
    <td mat-cell>{{ element.type }}</td>
  </ng-container>
  
  <!-- Status column with badge -->
  <ng-container matColumnDef="status">
    <th mat-header-cell>Status</th>
    <td mat-cell>
      <span class="badge" [class]="element.status | lowercase">
        {{ element.status }}
      </span>
    </td>
  </ng-container>

  <tr mat-header-row></tr>
  <tr mat-row></tr>
</table>

<!-- Pagination -->
<mat-paginator 
  [length]="totalItems" 
  [pageSizeOptions]="[10, 25, 50]"
  (page)="onPageChange($event)">
</mat-paginator>
```

### Dialogs & Modals

```typescript
// Open dialog
const dialogRef = this.dialog.open(ConfirmDialogComponent, {
  width: '400px',
  data: {
    title: 'Confirm Action',
    message: 'Are you sure?'
  }
});

// Handle result
dialogRef.afterClosed().subscribe(result => {
  if (result) {
    // User confirmed
  }
});
```

### Toasts & Snackbars

```typescript
// Show notification
this.snackBar.open('Action successful!', 'Dismiss', {
  duration: 3000,
  horizontalPosition: 'end',
  verticalPosition: 'bottom',
  panelClass: ['success-snackbar']
});
```

---

## SCSS Architecture

### File Organization

```scss
apps/vlass-web/src/
├── styles.scss              # Global styles
├── styles/
│   ├── _variables.scss      # Colors, spacing, fonts
│   ├── _global.scss         # Base styles, resets
│   ├── _utilities.scss      # Utility classes
│   ├── _layout.scss         # Layout patterns
│   ├── _components.scss     # Component tweaks
│   └── _theme.scss          # Material theme config
└── app/
    └── features/
        └── viewer/
            ├── viewer.component.scss     # Component styles
            └── ...
```

### Global Styles Example

```scss
// styles.scss
@import './styles/variables';
@import './styles/global';
@import './styles/layout';
@import './styles/utils';
@import '@angular/material/prebuilt-themes/indigo-pink.css';

// Then import component styles (handled by Angular)
```

### Utilities

```scss
// _utilities.scss

// Text utilities
.text-center { text-align: center; }
.text-mono { font-family: $font-family-mono; }
.text-error { color: $color-error; }

// Layout utilities
.flex-center { display: flex; justify-content: center; align-items: center; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.gap-md { gap: $spacing-md; }

// Visibility utilities
.hidden { display: none; }
.invisible { visibility: hidden; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; }

// Responsive
@mixin mobile { @media (max-width: 768px) { @content; } }
@mixin tablet { @media (768px to 1024px) { @content; } }
@mixin desktop { @media (min-width: 1024px) { @content; } }
```

---

## Theme Customization

### Light Theme (Default)

```typescript
// theme.scss
@import '@angular/material/theming';

$primary: mat.define-palette($mat-blue, 500);
$accent: mat.define-palette($mat-orange, 500);
$warn: mat.define-palette($mat-red, 500);

$theme: mat.define-light-theme((
  color: (
    primary: $primary,
    accent: $accent,
    warn: $warn,
  )
));

@include mat.all-component-colors($theme);
```

### Dark Theme (Future Enhancement)

```typescript
$dark-theme: mat.define-dark-theme((
  color: (
    primary: mat.define-palette($mat-blue, 300),
    accent: mat.define-palette($mat-orange, 400),
    warn: mat.define-palette($mat-red, 400),
  )
));

// Apply dark theme when `dark-mode` class present
.dark-mode {
  @include mat.all-component-colors($dark-theme);
  
  background-color: #121212;
  color: #ffffff;
}
```

### Custom Colors in Components

```scss
// viewer.component.scss
.aladin-stage {
  background-color: #000814; // Deep space black
  border: 1px solid mat-color($accent, 500);
}

.grid-overlay {
  stroke: #4ECDC4;           // Cyan grid
  opacity: 0.8;
}

.sky-label {
  fill: #95E1D3;             // Mint green text
  font-family: $font-family-mono;
  font-size: 12px;
}
```

---

## Responsive Design

### Breakpoints

```scss
$breakpoint-mobile: 480px;
$breakpoint-tablet: 768px;
$breakpoint-desktop: 1024px;
$breakpoint-wide: 1440px;
```

### Responsive Grid

```scss
.card-grid {
  display: grid;
  gap: $spacing-lg;
  
  // Mobile: single column
  grid-template-columns: 1fr;
  
  // Tablet: 2 columns
  @media (min-width: $breakpoint-tablet) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  // Desktop: 3 columns
  @media (min-width: $breakpoint-desktop) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Touch-Friendly Interactions (Mobile)

```scss
// Increase touch target size on mobile
@media (max-width: $breakpoint-tablet) {
  button, [mat-button] {
    min-height: 48px;  // Material spec: 48x48dp minimum
    min-width: 48px;
    padding: $spacing-sm $spacing-md;
  }
  
  // Reduce padding on form fields
  mat-form-field {
    margin-bottom: $spacing-md;
  }
}
```

---

## Accessibility

### ARIA Labels

```html
<!-- Buttons without text need aria-label -->
<button mat-icon-button aria-label="Close menu">
  <mat-icon>close</mat-icon>
</button>

<!-- Form labels must have for attribute -->
<label for="ra-input">Right Ascension</label>
<input id="ra-input" type="number" />

<!-- Semantic regions -->
<nav aria-label="Main navigation">
  ...
</nav>

<main>
  ...
</main>

<footer aria-label="Site footer">
  ...
</footer>
```

### Color Contrast

All text must meet WCAG AA standards:

- **Normal text:** 4.5:1 contrast ratio (white on primary blue: ✓)
- **Large text:** 3:1 contrast ratio

Avoid:

- ❌ Light gray on white background
- ❌ Relying on color alone to convey meaning (always add icons/text)

### Focus Indicators

```scss
// Ensure visible focus for keyboard navigation
button:focus-visible,
a:focus-visible {
  outline: 2px solid #1976D2;
  outline-offset: 2px;
}
```

### Screen Reader Text

```scss
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

// Usage
<button (click)="download()">
  Download
  <span class="sr-only">(FITS format)</span>
</button>
```

---

## CSS Conventions

### Naming

- **BEM (Block Element Modifier):** `.viewer-control__button--active`
- **Utility classes:** `.flex-center`, `.gap-lg`
- **State classes:** `.is-loading`, `.is-disabled`

### Nesting Depth

Max nesting depth: 3 levels (improves readability + CSS specificity)

```scss
// ✓ Good
.viewer-control {
  display: flex;
  
  &__header {
    font-size: 18px;
    
    &--active {
      color: $color-primary;
    }
  }
}

// ✗ Bad (too deep)
.viewer-control {
  .header {
    .title {
      .inner {
        .text {
          // Too many levels!
        }
      }
    }
  }
}
```

### Variables Usage

```scss
// Use variables for repeated values
$button-height: 40px;
$button-padding: $spacing-sm $spacing-md;

button {
  height: $button-height;
  padding: $button-padding;
}

// Not magic numbers
button {
  height: 40px;    // ← Bad
  padding: 8px 16px; // ← Bad
}
```

### Media Query Organization

```scss
// Place media queries at bottom of rule block
.panel {
  width: 100%;
  padding: $spacing-md;
  
  @media (max-width: $breakpoint-tablet) {
    width: 50%;
    padding: $spacing-sm;
  }
}
```

---

## Common Patterns

### Skeleton Loading State

```html
<!-- Show skeleton while loading -->
@if (isLoading) {
  <div class="skeleton" [style.height.px]="40"></div>
} @else {
  {{ data }}
}
```

```scss
.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Badge Styles

```scss
.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  
  &.error {
    background-color: rgba($color-error, 0.2);
    color: $color-error;
  }
  
  &.warning {
    background-color: rgba($color-warning, 0.2);
    color: $color-warning;
  }
  
  &.success {
    background-color: rgba($color-success, 0.2);
    color: $color-success;
  }
}
```

### Elevation (Shadows)

Material Design 3 elevation levels:

```scss
// Slight shadow (cards at rest)
@mixin elevation-1 {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

// Medium shadow (cards on hover)
@mixin elevation-4 {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.16);
}

// High shadow (modals, popovers)
@mixin elevation-8 {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.card {
  @include elevation-1;
  transition: box-shadow 0.3s ease;
  
  &:hover {
    @include elevation-4;
  }
}
```

---

## Performance Tips

### CSS Optimization

1. **Avoid `@import`**: Use `<link>` tags for external stylesheets (parallel load)
2. **Critical CSS**: Inline above-the-fold styles in `<head>`
3. **Unused Styles:** Use PurgeCSS to remove unused Material classes
4. **Optimization:** Minify CSS in production via Webpack

### Rendering Performance

```scss
// Use will-change sparingly
.animated-element {
  will-change: transform;
  animation: slide 0.3s ease;
  
  &:not(:active) {
    will-change: auto; // Remove after animation
  }
}

// GPU acceleration for smooth animations
.viewer-canvas {
  transform: translate3d(0, 0, 0); // Hint to GPU
  backface-visibility: hidden;
}
```

---

**Last Updated:** 2026-02-07  
**Maintained By:** VLASS Portal Design Team

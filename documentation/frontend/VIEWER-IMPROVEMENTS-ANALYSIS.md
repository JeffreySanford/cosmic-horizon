# Viewer Component Improvements Analysis

**Date:** 2026-02-11
**Component:** `ViewerComponent` (`apps/vlass-web/src/app/features/viewer/`)
**Status:** MVP Ready, Polish Phase Recommendations
**Scope:** UX/polish improvements for frontend pre-deploy (no breaking changes to data model)

---

## Executive Summary

The ViewerComponent is production-ready with comprehensive functionality: Aladin integration, multi-survey support, label management, permalink/snapshot/cutout workflows, and telemetry. This analysis identifies low-risk frontend polish improvements that enhance UX without architectural changes.

**Priority:** Polish is **optional** for MVP public launch; all recommendations are post-MVP enhancements suitable for v1.1.

---

## Current Feature Inventory ✅

### Overlay Controls

- [x] **Grid Toggle** – Coordinate grid on/off (off by default)

- [x] **Labels Toggle** – Catalog labels on/off (on by default)

- [x] **Survey Selection** – VLASS / DSS2 Variants / 2MASS / PanSTARRS (select via dropdown)

- [x] **Color Mode** – P/DSS2 Color vs Grayscale (toggle available)

### Navigation & State

- [x] **Target Search** – Search by object name (Aladin → SkyBot → VizieR → Fallback)

- [x] **RA/Dec/FOV Form** – Direct coordinate input with validators

- [x] **Permalink Creation** – Save/load/share viewer state via short ID

- [x] **State Encoding** – URL-based state persistence (no server storage needed)

- [x] **Local Storage Fallback** – Persist labels + default state locally

### Annotations & Data Export

- [x] **Label Management** – Add/remove manual labels, nearby catalog auto-labels

- [x] **Center Label** – Tag nearest object at viewport center

- [x] **Snapshot Export** – PNG export with full state metadata (1024px default)

- [x] **FITS Cutout Download** – Science data export (standard/high/max detail)

- [x] **Resolution Hints** – "Near native resolution" message when zoomed past survey native res

### Telemetry & Reliability

- [x] **Cutout Telemetry** – Success rate, provider details, recent failures tracking

- [x] **Provider Fallback** – Automatic retry with alternative survey fallbacks

- [x] **Debouncing** – Label lookup (1s), viewport sync (1s) for bandwidth efficiency

- [x] **Error Recovery** – Graceful handling of resolver failures, HTTP errors

---

## Recommended Improvements (Polish Phase)

### Tier 1: High-Value, Low-Risk (Recommended for v1.1)

#### 1.1 Search History / Recent Searches

**Current State:** Search input has no history. User must retype targets.

**Improvement:** Add autocomplete with recently searched targets.

**Scope:** Frontend only (localStorage-based)

- Store up to 10 most recent searches in localStorage

- Display dropdown on focus with recents

- Clear button to reset history

- Keyboard Navigation (↑/↓ to select)

**Implementation Sketch:**

```typescript
// Add to ViewerComponent
private searchHistory: string[] = [];
private readonly maxSearchHistory = 10;
private readonly searchHistoryKey = 'vlass_viewer_search_history';

ngOnInit(): void {
  // Load from localStorage
  const stored = localStorage.getItem(this.searchHistoryKey);
  this.searchHistory = stored ? JSON.parse(stored) : [];
}

searchTarget(): void {
  const target = this.stateForm.get('targetName')?.value?.trim();
  if (target) {
    // Add to history if not already at top
    this.searchHistory = [
      target,
      ...this.searchHistory.filter(t => t !== target)
    ].slice(0, this.maxSearchHistory);
    localStorage.setItem(this.searchHistoryKey, JSON.stringify(this.searchHistory));
  }
  // ... existing search logic
}

```

**UI Changes:**

- Add `<mat-autocomplete>` with search history suggestions

- Show icons: clock (recent) + X (delete from history)

- Filter by typed substring

**Benefits:**

- Reduces friction for repeated observations (e.g., monitoring a region)

- Familiar UX pattern (Google, GitHub)

- Zero API impact

---

**Current State:** All actions require mouse clicks.

**Improvement:** Add optional keyboard shortcuts for power users.

**Suggested Shortcuts:**

```text
G     → Toggle Grid overlay
L     → Toggle Labels overlay
C     → Center label (add label at center)
S     → Save snapshot
F     → Download FITS cutout
P     → Copy permalink to clipboard
?     → Show help/keybinds overlay

```

**Scope:** Frontend only (hotkeys library or native)

- Conditional on viewer component focus

- Overlay help shows active shortcuts

- No conflicts with browser/OS shortcuts (avoid Ctrl+*, Cmd+*, etc.)

**Implementation Sketch:**

**Implementation Sketch:**

```typescript
// Add @HostListener
@HostListener('window:keydown', ['$event'])
onKeyboardEvent(event: KeyboardEvent): void {
  if (!this.aladinView || !this.stateForm.valid) return;

  const key = event.key.toLowerCase();

  switch (key) {
    case 'g':
      this.toggleGridOverlay(!this.gridOverlayEnabled);
      event.preventDefault();
      break;
    case 'l':
      this.toggleLabelsOverlay(!this.labelsOverlayEnabled);
      event.preventDefault();
      break;
    case 'c':
      this.addCenterLabel();
      event.preventDefault();
      break;
    case 's':
      this.saveSnapshot();
      event.preventDefault();
      break;
    case 'f':
      this.downloadScienceData();
      event.preventDefault();
      break;
    case 'p':
      this.copyPermalinkToClipboard();
      event.preventDefault();
      break;
    case '?':
      this.showKeybindsHelp = true;
      event.preventDefault();
      break;

  }
}

```

**UI Changes:**

- Add keyboard shortcut legend in viewer header (collapsible or help icon)

- Show `(G)` hints next to toggle buttons

- Accessible help overlay

**Benefits:**

- Faster workflow for frequent users

**Current State:** Labels display object name only.

**Improvement:** Add small icons indicating object type.

**Examples:**

```text
⭐ Star (bright)
🌀 Galaxy
☁️  Nebula
🪨 Asteroid
🟠 Planet/Solar System object
?  Unknown type

```

**Scope:** Frontend parsing of SIMBAD object types

- Extract objecttype from VizieR/SIMBAD response

- Map common types to icon set (Material Icons)

- Show icon prefix in label: `⭐ Betelgeuse`

**Implementation Sketch:**

**Scope:** Frontend parsing of SIMBAD object types

- Extract objecttype from VizieR/SIMBAD response

- Map common types to icon set (Material Icons)

- Show icon prefix in label: `⭐ Betelgeuse`

**Implementation Sketch:**

```typescript
// In viewer-api.service.ts or component
private getObjectTypeIcon(objectType: string): string {
  const lowerType = (objectType || '').toLowerCase();
  if (lowerType.includes('star')) return 'star';
  if (lowerType.includes('galaxy')) return 'public';
  if (lowerType.includes('nebula')) return 'cloud';
  if (lowerType.includes('asteroid')) return 'travelexplore';
  if (lowerType.includes('planet')) return 'brightness_1';

  return 'help';
}

// Use in template:
// <mat-icon class="label-icon">{{ getObjectTypeIcon(label.objectType) }}</mat-icon>
// <span>{{ label.name }}</span>

```

**UI Changes:**

- Icon + label rendering (similar to Gmail labels)

- Color-code by type (star=yellow, galaxy=purple, etc.)

**Current State:** Snapshot always 1024px (fixed).

**Improvement:** Add user-selectable resolution in snapshot dialog.

**Options:**

- 1024px (standard, ~2 min)

- 2048px (high, ~4 min)

- 3072px (max, ~8 min)

- Show estimated generation time

**Scope:** Frontend dialog + minor API parameter change

- Add dialog with radio buttons before snap save

- Send `width` param to existing `getViewDataURL()` Aladin method

- Track telemetry (which resolution selected)

**Implementation Sketch:**
)

- 2048px (high, ~4 min)

- 3072px (max, ~8 min)

- Show estimated generation time

**Scope:** Frontend dialog + minor API parameter change

- Add dialog with radio buttons before snap save

- Send `width` param to existing `getViewDataURL()` Aladin method

- Track telemetry (which resolution selected)

**Implementation Sketch:**

```typescript
// Add component properties
snapshotResolutionOptions = [

  { label: '1024px (Standard)', value: 1024, estimatedMs: 2000 },
  { label: '2048px (High)', value: 2048, estimatedMs: 4000 },
  { label: '3072px (Max)', value: 3072, estimatedMs: 8000 },
];
selectedSnapshotResolution = 1024;

// In saveSnapshot():
from(this.aladinView.getViewDataURL({
  format: 'image/png',
  width: this.selectedSnapshotResolution,
})).pipe(...)

```

**UI Changes:**

- Radio button group in snapshot save dialog

- Estimated time label updates with selection

- "Generating..." progress during save

**Benefits:**

- Flexibility for science use cases (higher res = better detail)

- Users control quality vs. wait-time tradeoff

- No server changes (Aladin native capability)

---

---#### 2.1 Smart Survey Selection

**Current State:** User manually selects survey from dropdown.

**Improvement:** Auto-suggest higher-resolution surveys when zoomed deep.

**Logic:**

- When FOV < 5 arcminutes AND NOT surveyed at that res by VLASS

- Suggest "Switch to PanSTARRS (higher res)" button

- When FOV < 1 arcminute, suggest HST if available at that position

**Scope:** Frontend heuristic + API enhancement

- Calculate survey native resolution from metadata

- Show optional suggestion banner (non-modal)

**Benefits:**

- Reduces dead-zoom (no new detail when zoomed past native res)

- Guided navigation to better surveys

- Data-driven recommendation

---

#### 2.2 Pan/Zoom Undo/Redo

**Current State:** No undo/redo for pan/zoom operations.

**Improvement:** Maintain history stack of viewport states.

**Scope:** Frontend state management

- Store [RA, Dec, FOV] tuples in history

- Buttons/keys (Ctrl+Z, Ctrl+Y) or menu

- Limit to last 20 states

**Benefits:**

- Familiar UX pattern

- Useful for exploration workflows

- Low complexity (just state array tracking)

---

---
**Improvement:** Let power users adjust debounce (settings panel).

**Targets:**

- Label lookup debounce (300–2000ms)

- Viewport sync debounce (500–2000ms)

**Benefits:**

- Bandwidth optimization for slow connections

- Latency optimization for fast connections

- Advanced users only (settings icon)

---

### Tier 3: Low-Value or High-Risk (Not Recommended)

---

#### 3.2 Custom Overlays / GeoJSON Import

**Status:** Deferred to Phase 2 / v2. Requires backend data model changes.

#### 3.3 Poll-Based Label Updates

**Status:** Current debounced lookup is sufficient. Real-time is unnecessary.

---

## Implementation Priority (v1.1 Timeline)

### Sprint 1 (Weeks 1-2)

## 1. **Search History** (1 day) – High ROI, low risk

### Sprint 2 (Weeks 3-4)

4. **Label Icons** (1.5 days) – Visual polish

5. **Snapshot Resolution** (0.5 day) – Minor param addition

6. Integration tests (0.5 day)

### Sprint 3 (Weeks 5-6)

- QA + Polish pass

- Batch with Phase 2 other fixes

---

## Code Organization

**Files to Modify:**

- `apps/vlass-web/src/app/features/viewer/viewer.component.ts` – Core logic

- `apps/vlass-web/src/app/features/viewer/viewer.component.html` – Template

- `apps/vlass-web/src/app/features/viewer/viewer.component.scss` – Styles
---**New Files (Optional):**

- `apps/vlass-web/src/app/features/viewer/viewer-help.component.ts` – Keybinds overlay

- `apps/vlass-web/src/app/features/viewer/object-type.pipe.ts` – Icon mapping

---

## Testing Strategy

- **Unit Tests:** Search history localStorage, keyboard event binding

- **E2E Tests:** Keyboard shortcuts in viewer workflow, search history persistence

- **Manual QA:** Label icon rendering, snapshot dialog resolution selection

- **A/B Metrics:** Measure keybind adoption, snapshot resolution usage

---

## Risk Assessment

| Improvement | Risk | Mitigation |
|-------------|------|-----------|
| Search History | Medium (localStorage edge cases) | Use JSON.stringify with fallback |
| Keyboard Shortcuts | Low (event listeners only) | Test hotkey conflicts, provide help overlay |
| Label Icons | Low (visual only) | Icon set from Material, fallback to text |
| Snapshot Resolution | Low (Aladin API param) | Test resolutions in e2e, set reasonable limits |

---

## Non-Blocking Notes

- All improvements are **additive** (no breaking changes)

- Each can be implemented/shipped independently

- ----------- | ---- | ---------- |

| Search History | Medium (localStorage edge cases) | Use JSON.stringify with fallback |
| Keyboard Shortcuts | Low (event listeners only) | Test hotkey conflicts, provide help overlay |
| Label Icons | Low (visual only) | Icon set from Material, fallback to text |
| Snapshot Resolution | Low (Aladin API param) | Test resolutions in e2e, set reasonable limits |

---

- `VIEWER-CONTROLS.md` – Current feature reference

- `architecture/TECHNICAL-ARCHITECTURE.md` – Frontend architecture

## - `PRODUCT-CHARTER.md` – MVP scope definition
---
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*

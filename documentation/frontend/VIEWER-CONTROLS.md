# Mode A Viewer Controls & Operations

**Date:** 2026-02-07  
**Status:** MVP - Production Ready  
**Component:** `ViewerComponent` (`apps/vlass-web/src/app/features/viewer/`)  
**Framework:** Angular 18 + Aladin Lite (ESA Aladin Sky Atlas)

---

## Table of Contents

1. [Viewer Overview](#viewer-overview)
2. [Overlay Controls](#overlay-controls)
3. [Control Deck (State Form)](#control-deck-state-form)
4. [Action Buttons](#action-buttons)
5. [Sky Canvas & Interactions](#sky-canvas--interactions)
6. [State Encoding & Permalinks](#state-encoding--permalinks)
7. [Annotations & Labels](#annotations--labels)
8. [Survey Selection](#survey-selection)
9. [Telemetry & Logging](#telemetry--logging)
10. [User Workflows](#user-workflows)

---

## Viewer Overview

The VLASS Portal Mode A Viewer is a **web-based astronomical sky explorer** powered by Aladin Lite. It provides:

- **Interactive HiPS-based sky map:** Pan, zoom, inspect
- **Coordinate exploration:** Input RA/Dec to jump to locations
- **Multi-survey support:** VLASS, DSS2, 2MASS, PanSTARRS
- **Catalog overlays:** Query nearby astronomical objects
- **State persistence:** Save/load/share viewer configurations
- **Science data export:** Download FITS cutouts, PNG snapshots
- **Community integration:** Embed viewer state in markdown posts

### Architecture

```text
┌─────────────────────────────────────────┐
│   Angular ViewerComponent               │
├─────────────────────────────────────────┤
│                                         │
│  1. Aladin Canvas (HiPS tiles)         │
│  2. Overlay Controls (checkboxes)      │
│  3. Control Deck (coordinate form)     │
│  4. Detail Panels (annotations, etc.)  │
│                                         │
└──────────────┬──────────────────────────┘
               │
         ┌─────▼──────┐
         │ Aladin Lite │ (ESA CDN)
         │   Library   │ https://aladin.cds.unistra.fr/
         └─────┬───────┘
               │
         ┌─────▼──────────────────┐
         │ HiPS Survey Servers    │
         │ ├─ CDS (VLASS, etc.)   │
         │ ├─ ESA (DSS2, etc.)    │
         │ └─ Multiple providers  │
         └────────────────────────┘
```

---

## Overlay Controls

These are the **on/off toggles** displayed over the sky canvas in the top-left corner. They control what visual overlays are rendered on top of the HiPS tiles.

### Grid Toggle

**Label:** Grid  
**Default:** OFF (`gridOverlayEnabled = false`)  
**Type:** Checkbox toggle  
**Location:** Overlay controls panel (on canvas)

#### Grid Toggle: Behavior

When **enabled:**

- Shows colored coordinate grid lines on sky (RA/Dec mesh)
- Displays grid labels for major axis markers
- Helpful for coordinate verification and alignment

When **disabled:**

- Clean sky view with no grid overlay
- Improves visual clarity of deeper surveys

#### Grid Toggle: Implementation

```typescript
// Component property
gridOverlayEnabled = false;

// Toggle handler
toggleGridOverlay(enabled: boolean): void {
  const previous = this.gridOverlayEnabled;
  this.gridOverlayEnabled = enabled;
  
  this.logViewerEvent('grid_toggle_requested', {
    previous_enabled: previous,
    next_enabled: enabled,
  });
  
  void this.reinitializeAladinView(); // Re-render with grid state
}

// HTML
<label class="viewer-toggle" for="grid-overlay-toggle">
  <input
    id="grid-overlay-toggle"
    type="checkbox"
    [checked]="gridOverlayEnabled"
    (change)="onGridOverlayToggle($event)"
  />
  <span>Grid</span>
</label>
```

---

### Labels Toggle

**Label:** Labels  
**Default:** ON (`labelsOverlayEnabled = true`)  
**Type:** Checkbox toggle  
**Location:** Overlay controls panel (on canvas)

#### Labels Toggle: Behavior

When **enabled:**

- Queries nearby catalog (e.g., SIMBAD) for astronomical objects
- Displays object names + types at their sky coordinates
- Dynamically updates when you pan/zoom (300km radius lookup)
- Shows `centerCatalogLabel` (nearest object to center of view)

When **disabled:**

- Hides all catalog labels
- Reduces visual clutter
- Clears cached nearby lookups

#### Labels Toggle: Implementation

```typescript
// Component property
labelsOverlayEnabled = true;

// Toggle handler
toggleLabelsOverlay(enabled: boolean): void {
  const previous = this.labelsOverlayEnabled;
  this.labelsOverlayEnabled = enabled;
  
  this.logViewerEvent('labels_toggle_requested', {
    previous_enabled: previous,
    next_enabled: enabled,
  });

  if (!enabled) {
    this.catalogLabels = [];
    this.lastNearbyLookupKey = '';
    return; // Early return to prevent lookup
  }

  // If enabling, schedule immediate lookup
  this.scheduleNearbyLabelLookup(this.currentState(), { force: true });
}

// HTML
<label class="viewer-toggle" for="labels-overlay-toggle">
  <input
    id="labels-overlay-toggle"
    type="checkbox"
    [checked]="labelsOverlayEnabled"
    (change)="onLabelsOverlayToggle($event)"
  />
  <span>Labels</span>
</label>
```

#### Nearby Catalog Lookup (Real-Time)

When Labels are enabled, the viewer automatically queries the backend for nearby objects:

```typescript
private scheduleNearbyLabelLookup(state: ViewerStateModel, options?: { force?: boolean }): void {
  // Debounce: only query once per second (avoid spam on pan/zoom)
  clearTimeout(this.nearbyLookupTimer);
  
  this.nearbyLookupTimer = setTimeout(async () => {
    const lookupKey = `${state.ra.toFixed(2)}-${state.dec.toFixed(2)}`;
    
    if (!this.labelsOverlayEnabled) return;
    if (!options?.force && lookupKey === this.lastNearbyLookupKey) return; // Skip if already queried
    
    // API call to backend
    const nearby = await this.viewerApi.getNearby(state, lookupRadius)
      .toPromise();
    
    this.catalogLabels = nearby.labels;
    this.centerCatalogLabel = nearby.centerMatch;
    this.lastNearbyLookupKey = lookupKey;
    
  }, 1000); // 1 second debounce
}
```

**API Endpoint:**

```json
GET /api/viewer/nearby?ra=<degrees>&dec=<degrees>&radius=<km>
Response:
{
  labels: [
    { name: "Andromeda", ra: 10.68, dec: 41.27, object_type: "Galaxy", ... },
    { name: "M31", ra: 10.68, dec: 41.27, object_type: "Galaxy", ... }
  ],
  centerMatch: { name: "M31", ... }
}
```

---

### P/DSS2/color Toggle (NEW)

**Label:** P/DSS2/color  
**Default:** OFF (`pdssColorEnabled = false`)  
**Type:** Checkbox toggle (ON/OFF switch)  
**Location:** Overlay controls panel (on canvas)

#### P/DSS2/color Toggle: Behavior

When **enabled:**

- Switches active survey to **P/DSS2/color** (Palomar Digitized Sky Survey, 2nd edition, color)
- Provides deep-sky RGB color imagery
- Better for detecting faint objects and nebulae
- Warning: Slower load times than VLASS (different provider, different resolution)

When **disabled:**

- Survey reverts to previously selected option (from Control Deck dropdown)
- No state change persists unless you manually use Control Deck dropdown

#### P/DSS2/color Toggle: Purpose & Use Case

The P/DSS2/color toggle is a **quick-access survey switch** for astronomers wanting to:

- Quickly inspect color imagery at current coordinates
- Verify object detection across different wavelengths
- Compare VLASS radio data against optical DSS data

#### P/DSS2/color Toggle: Implementation

```typescript
// Component property
pdssColorEnabled = false;

// Toggle handler
togglePdssColor(enabled: boolean): void {
  const previous = this.pdssColorEnabled;
  this.pdssColorEnabled = enabled;
  
  if (enabled) {
    // When enabling P/DSS, switch survey to DSS2
    this.stateForm.patchValue({ survey: 'DSS2' }, { emitEvent: true });
    this.logViewerEvent('pdss_toggle_requested', {
      previous_enabled: previous,
      next_enabled: enabled,
    });
  }
}

// Sync state: when form survey changes, update toggle
this.stateForm.valueChanges
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((value) => {
    if (value.survey === 'DSS2') {
      this.pdssColorEnabled = true;
    } else if (this.pdssColorEnabled && value.survey !== 'DSS2') {
      this.pdssColorEnabled = false;
    }
  });

// HTML
<label class="viewer-toggle" for="pdss-color-toggle">
  <input
    id="pdss-color-toggle"
    type="checkbox"
    [checked]="pdssColorEnabled"
    (change)="onPdssColorToggle($event)"
  />
  <span>P/DSS2/color</span>
</label>
```

#### Survey Mapping

Internally, the viewer maps survey names to Aladin Lite HiPS URLs:

```typescript
private surveyHipsUrl(normalized: string): string {
  switch (normalized) {
    case 'VLASS':
      return 'https://hips.cds.unistra.fr/hipstile/VLASS/color';
    case 'DSS2':
      return 'https://skies.esac.esa.int/DSSColor'; // P/DSS2/color
    case '2MASS':
      return 'https://hips.cds.unistra.fr/hipstile/2MASS/color';
    case 'P/PanSTARRS/DR1/color-z-zg-g':
      return 'https://hips.cds.unistra.fr/hipstile/PanSTARRS/DR1/color-z-zg-g';
    default:
      return this.lastAppliedSurvey || 'https://hips.cds.unistra.fr/hipstile/VLASS/color';
  }
}
```

---

## Control Deck (State Form)

The **Control Deck** is the right-side panel containing the state form and action buttons. It allows precise control over viewer coordinates and survey selection.

### State Form Fields

#### Right Ascension (RA)

**Label:** "Right Ascension"  
**Type:** Numeric input  
**Units:** Degrees (0.0 - 360.0)  
**Validation:** Required, min 0, max 360

Purpose: Specify the horizontal celestial coordinate (longitude on sky).

#### Declination (Dec)

**Label:** "Declination"  
**Type:** Numeric input  
**Units:** Degrees (-90.0 to +90.0)  
**Validation:** Required, min -90, max 90

Purpose: Specify the vertical celestial coordinate (latitude on sky).

#### Field of View (FoV)

**Label:** "Field of View"  
**Type:** Numeric input  
**Units:** Degrees (angular size of visible sky)  
**Typical Range:** 0.1° (zoomed in) to 180° (full sky)  
**Validation:** Required, min 0.1, max 180

Purpose: Control zoom level. Smaller = more zoomed in, larger = zoomed out.

#### Survey

**Label:** "Survey"  
**Type:** Dropdown select  
**Options:**

- VLASS (default, radio 3 GHz)
- DSS2 (optical, color imagery)
- 2MASS (infrared, near-IR)
- PanSTARRS (optical, deep survey)

Purpose: Select which HiPS survey to display.

### Form Reactivity

```typescript
stateForm = this.fb.group({
  ra: [0, [Validators.required, Validators.min(0), Validators.max(360)]],
  dec: [0, [Validators.required, Validators.min(-90), Validators.max(90)]],
  fov: [1, [Validators.required, Validators.min(0.1), Validators.max(180)]],
  survey: ['VLASS', Validators.required],
});

// On form value change, update Aladin view in real-time
this.stateForm.valueChanges
  .pipe(takeUntilDestroyed(this.destroyRef), debounceTime(200))
  .subscribe(() => {
    if (this.stateForm.valid) {
      this.syncAladinFromForm(); // Push form state to viewer
    }
  });
```

**Behavior:** Type a new RA/Dec or select a different survey → View updates in real-time without clicking a button.

---

## Action Buttons

Located below the state form in the Control Deck.

### Update URL State

**Label:** "Update URL State"  
**Type:** Regular button  
**Action:** Encodes current form state into URL query parameter

#### Update URL State: Purpose

Allows users to generate a **sharable URL** that preserves viewer state:

- Copy the URL from address bar
- Share with colleagues
- Recipients can click link → viewer loads at exact same RA/Dec/FoV/survey

#### Update URL State: Implementation

```typescript
applyStateToUrl(): void {
  const currentState = this.currentState();
  const encoded = this.encodeState(currentState);
  const url = `${window.location.origin}/view?state=${encoded}`;
  
  window.history.replaceState(null, '', url);
  this.statusMessage = `URL updated: ${url}`;
  this.logViewerEvent('state_applied_to_url', { url });
}

private encodeState(state: ViewerStateModel): string {
  return btoa(JSON.stringify(state))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, ''); // URL-safe base64
}
```

**Example URL:**

```text
https://vlass-portal.com/view?state=eyJyYSI6MTAuNjgsImRlYyI6NDEuMjcsImZvdiI6MiwiY3V2ZXkiOiJWTEFTUyJ9
```

---

### Download FITS Cutout

**Label:** "Download FITS Cutout"  
**Type:** Regular button  
**Action:** Generates and downloads FITS image file

#### Download FITS Cutout: Purpose

Allows users to **export science data** from current viewer state:

- FITS format for data analysis in IRAF, Python, etc.
- Respects current RA/Dec/FoV/survey selection
- Cutout detail level configurable (standard 1024px, high 2048px, max 3072px)

#### Download FITS Cutout: Implementation

```typescript
downloadScienceData(): void {
  const state = this.currentState();
  const detail = this.cutoutDetail; // 'standard', 'high', or 'max'
  
  const url = this.viewerApi.scienceDataUrl(state, undefined, detail);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vlass_cutout_${Date.now()}.fits`;
  link.click();
  link.remove();
  
  this.logViewerEvent('science_data_downloaded', { detail, survey: state.survey });
}
```

**API Call:**

```json
GET /api/viewer/cutout?ra=10.68&dec=41.27&fov=2&survey=VLASS&detail=high
Response: FITS binary file (image/fits)
```

---

### Create Permalink

**Label:** "Create Permalink"  
**Disabled When:** `loadingPermalink = true`  
**Type:** Regular button  
**Action:** Saves state and generates short ID

#### Create Permalink: Purpose

Creates a **permanent, short URL** for sharing:

- State saved to database with generated short ID
- URL format: `https://vlass-portal.com/view/<shortid>`
- Shorter than encoded state URLs; survives link shortening
- Persists even if original viewer state changes

#### Create Permalink: Implementation

```typescript
async createPermalink(): Promise<void> {
  this.loadingPermalink = true;
  try {
    const state = this.currentState();
    const response = await this.viewerApi.createState(state).toPromise();
    
    const shortUrl = `${window.location.origin}/view/${response.state.short_id}`;
    this.shortId = response.state.short_id;
    this.permalink = shortUrl;
    
    // Copy to clipboard
    await navigator.clipboard.writeText(shortUrl);
    this.statusMessage = 'Permalink copied to clipboard!';
    
  } catch (error) {
    this.statusMessage = 'Failed to create permalink.';
  } finally {
    this.loadingPermalink = false;
  }
}
```

**API Call:**

```json
POST /api/viewer/state
{
  ra: 10.68,
  dec: 41.27,
  fov: 2,
  survey: "VLASS"
}
Response:
{
  state: {
    id: "uuid-...",
    short_id: "abc123d",
    ra: 10.68,
    dec: 41.27,
    fov: 2,
    survey: "VLASS",
    created_at: "2026-02-07T..."
  }
}
```

---

### Save PNG Snapshot

**Label:** "Save PNG Snapshot"  
**Disabled When:** `savingSnapshot = true`  
**Type:** Accent button (highlighted)  
**Action:** Captures canvas and downloads PNG

#### Save PNG Snapshot: Purpose

Exports **static image** of current sky view:

- PNG format suitable for presentations, papers, blog posts
- Includes grid/labels if enabled
- Retains current zoom level + survey coloring
- Useful for embedding results in community posts

#### Save PNG Snapshot: Implementation

```typescript
async saveSnapshot(): Promise<void> {
  this.savingSnapshot = true;
  try {
    const canvas = this.aladinHost?.nativeElement?.querySelector('canvas');
    if (!canvas) throw new Error('Aladin canvas not found');
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vlass_snapshot_${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
      link.remove();
    });
    
    this.logViewerEvent('snapshot_saved', { survey: this.stateForm.value.survey });
  } catch (error) {
    this.statusMessage = 'Failed to save snapshot.';
  } finally {
    this.savingSnapshot = false;
  }
}
```

---

## Sky Canvas & Interactions

### Direct Canvas Interactions (Mouse/Touch)

The Aladin Lite viewer supports native astronomical interactions:

| Interaction | Action |
| --- | --- |
| **Click** | Center view on clicked coordinates |
| **Click + Drag** | Pan around sky |
| **Mouse Wheel** | Zoom in/out (scroll up = zoom in) |
| **Right-click** | Context menu (survey info, etc.) |
| **Touch (mobile)** | Two-finger pinch = zoom; drag = pan |

### Crosshair & Center Indicator

A **crosshair reticle** at the center of the canvas marks:

- Current center coordinates (RA, Dec)
- Reference point for nearby catalog lookup (if Labels enabled)
- Target for manual label placement

When hovering over a catalog label, the nearest label name displays above the crosshair.

### Resolution Hint & Fallback

Below the canvas, a **resolution hint** may appear:

```typescript
// Example
nativeResolutionHint = "VLASS resolution (3 arcsec) is lower than ideal for this zoom level.";
suggestedSharperSurvey = "2MASS"; // Suggestion

// User can click "Use 2MASS" to switch survey
applySuggestedSurvey(): void {
  this.stateForm.patchValue({ survey: this.suggestedSharperSurvey });
  this.statusMessage = `Switched to ${this.suggestedSharperSurvey} for sharper detail.`;
}
```

This helps users understand when switching to a higher-resolution survey would be beneficial.

---

## State Encoding & Permalinks

### ViewerStateModel

Core data structure representing complete viewer state:

```typescript
export interface ViewerStateModel {
  ra: number;           // Right Ascension (degrees)
  dec: number;          // Declination (degrees)
  fov: number;          // Field of view (degrees)
  survey: string;       // Selected survey ('VLASS', 'DSS2', etc.)
  labels?: ViewerLabelModel[]; // (Optional) user-added annotations
}

export interface ViewerLabelModel {
  name: string;         // Label text
  ra: number;           // RA of label
  dec: number;          // Dec of label
  created_at: string;   // Timestamp
}
```

### Encoding Strategy

**URL-safe Base64 encoding** preserves state in query parameter:

```typescript
private encodeState(state: ViewerStateModel): string {
  // Serialize to JSON
  const json = JSON.stringify(state);
  
  // Encode to Base64
  let encoded = btoa(json);
  
  // Replace URL-unsafe chars
  encoded = encoded
    .replace(/\+/g, '-')    // + → -
    .replace(/\//g, '_')    // / → _
    .replace(/=+$/g, '');   // Remove padding
  
  return encoded;
}

// Reverse process
private decodeState(encoded: string): ViewerStateModel {
  // Add back padding if needed
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = normalized + (padding === 0 ? '' : '='.repeat(4 - padding));
  
  // Decode from Base64
  const json = atob(padded);
  
  // Parse JSON
  return JSON.parse(json) as ViewerStateModel;
}
```

### State Persistence

States are persisted in three ways:

1. **URL Query Parameter:** `?state=<encoded>` (immediate, temporary)
2. **Permalink (Database):** Saved state with short ID `/view/<id>` (permanent)
3. **localStorage:** For draft viewer state within session (non-standard)

### Route Resolution

When user navigates to `/view`:

```typescript
// Route parameter resolution
private hydrateStateFromRoute(): void {
  const shortId = this.route.snapshot.paramMap.get('shortId');
  if (shortId) {
    // Fetch from database using short ID
    this.resolveFromShortId(shortId);
    return;
  }

  const encoded = this.route.snapshot.queryParamMap.get('state');
  if (encoded) {
    // Decode from URL
    const state = this.decodeState(encoded);
    this.stateForm.patchValue(state);
    return;
  }

  // Default state
  this.loadLocalLabels();
  this.syncAladinFromForm();
}
```

---

## Annotations & Labels

### Manual Label Placement

Users can **label points on the sky**:

1. Enter text in "Center Label" input field
2. Click "Label Center" → Creates label at current RA/Dec
3. Label appears both on canvas and in "Manual Annotations" list
4. Click "Remove" to delete

#### Manual Label Placement: Implementation

```typescript
labelDraft = '';
labels: ViewerLabelModel[] = [];

addCenterLabel(): void {
  if (!this.labelDraft.trim()) return;
  
  const label: ViewerLabelModel = {
    name: this.labelDraft,
    ra: this.stateForm.value.ra,
    dec: this.stateForm.value.dec,
    created_at: new Date().toISOString(),
  };
  
  this.labels.push(label);
  this.labelDraft = '';
  
  // Persist to localStorage
  this.storageService.setLabels(this.labels);
  this.logViewerEvent('label_added', { name: label.name, ra: label.ra, dec: label.dec });
}

removeLabel(label: ViewerLabelModel): void {
  this.labels = this.labels.filter(l => l !== label);
  this.storageService.setLabels(this.labels);
}
```

### Catalog Label Annotations

When **Labels overlay enabled**, users can also **annotate catalog objects**:

```typescript
// Nearby catalog lookup (automatic)
catalogLabels: NearbyCatalogLabelModel[] = [];
centerCatalogLabel: NearbyCatalogLabelModel | null = null;

// User clicks "Annotate Center Match" or "Annotate" on specific label
addCenterCatalogLabelAsAnnotation(): void {
  if (!this.centerCatalogLabel) return;
  
  const label: ViewerLabelModel = {
    name: this.centerCatalogLabel.name,
    ra: this.centerCatalogLabel.ra,
    dec: this.centerCatalogLabel.dec,
    created_at: new Date().toISOString(),
  };
  
  this.labels.push(label);
  this.storageService.setLabels(this.labels);
  this.logViewerEvent('catalog_label_annotated', { name: label.name });
}
```

---

## Survey Selection

### Available Surveys

| Survey | Wavelength | Provider | Resolution | Use Case |
| --- | --- | --- | --- | --- |
| **VLASS** (default) | Radio (3 GHz) | NRAO | ~3 arcsec | Radio source detection, faint sources |
| **DSS2** (P/DSS2/color) | Optical (RGB) | ESA/Palomar | ~1 arcsec | Deep optical surveys, color imagery |
| **2MASS** | Infrared (JHK) | 2MASS/IPAC | ~2 arcsec | Infrared sources, dust penetration |
| **PanSTARRS** | Optical (grizy) | Pan-STARRS/MAST | ~1.4 arcsec | Deep optical, high-resolution |

### Dynamic Resolution Suggestions

Component automatically suggests higher-resolution surveys:

```typescript
// Detect when zoom level exceeds native resolution
const resolutionQuotient = this.stateForm.value.fov / nativeResolutionArcsec;

if (resolutionQuotient < 10) { // User is zoomed in past native resolution
  this.nativeResolutionHint = `${currentSurvey} resolution is lower than ideal.`;
  
  // Suggest higher-res alternative
  if (currentSurvey === 'VLASS') {
    this.suggestedSharperSurvey = '2MASS'; // Or DSS2
  }
}
```

---

## Telemetry & Logging

### Events Logged

The viewer logs user interactions for analytics + debugging:

```typescript
// Logged events (non-exhaustive)
logViewerEvent('viewer_load_complete', { duration_ms, grid_enabled, pdss_enabled });
logViewerEvent('grid_toggle_requested', { previous_enabled, next_enabled });
logViewerEvent('labels_toggle_requested', { previous_enabled, next_enabled });
logViewerEvent('pdss_toggle_requested', { previous_enabled, next_enabled });
logViewerEvent('survey_quick_set', { survey: 'P/DSS2/color' });
logViewerEvent('survey_changed', { previous_survey, new_survey });
logViewerEvent('state_applied_to_url', { url });
logViewerEvent('science_data_downloaded', { detail, survey });
logViewerEvent('snapshot_saved', { survey });
logViewerEvent('permalink_created', { short_id });
logViewerEvent('label_added', { name, ra, dec });
logViewerEvent('catalog_label_annotated', { name });
```

**Logging Framework:** See [LOGGING-SYSTEM-DESIGN.md](../backend/LOGGING-SYSTEM-DESIGN.md)

---

## Target Search & Resolution

### Search Bar Overview

**Location:** Top toolbar (next to brand name)  
**Input Field:** "Search target" placeholder text  
**Trigger:** Enter key or click search icon button  
**Component Method:** `searchTarget()`

The target search field accepts:

- **Astronomical object names:** M31, Messier 1, Andromeda, Whirlpool, etc.
- **Coordinates in decimal degrees:** RA Dec (space-separated)
- **Known planets and solar system objects:** Mars, Venus, Jupiter, Saturn, etc.

### Resolution Strategy

The viewer uses a **multi-layered resolver chain** to find target coordinates:

#### Layer 1: Aladin gotoObject (via Sesame)

- **Purpose:** Resolve named astronomical objects
- **Service:** CDS Sesame name resolver
- **Supports:** galaxies, stars, nebulae, Messier objects, named sources
- **Failure Mode:** Silent failure for planets (Sesame doesn't support ephemeris)

#### Layer 2: SkyBot Ephemeris API

- **Purpose:** Resolve planets and solar system objects
- **Service:** IMCCE SkyBot `http://vo.imcce.fr/webservices/skybot/api/ephem`
- **Supports:** Mars, Venus, Jupiter, Saturn, Uranus, Neptune, asteroids, comets
- **Failure Mode:** Falls back if service is unavailable

#### Layer 3: CDS VizieR Aliases

- **Purpose:** Broader object name resolution
- **Service:** CDS VizieR catalog service
- **Supports:** Extended object list including minor planets
- **Failure Mode:** Falls back if service is unavailable

#### Layer 4: Hardcoded Planet Coordinates (Fallback)

- **Purpose:** Ensure planets are always resolvable
- **Data:** Approximate RA/Dec for major planets (epoch ~2026)
- **Caveat:** ⚠️ **APPROXIMATE ONLY** — Use for visual centering only, NOT for scientific analysis
- **Example Coordinates:**
  - Mars: RA 142.8°, Dec -15.2°
  - Venus: RA 65.2°, Dec 18.9°
  - Jupiter: RA 285.6°, Dec 8.1°
  - Saturn: RA 306.4°, Dec 12.2°

### Example Searches

<!-- markdownlint-disable MD060 -->
| Search Query    | Resolver Used      | Result                                |
| :-------------- | :----------------- | :------------------------------------ |
| `M31`           | Aladin/Sesame      | Andromeda Galaxy (RA 10.68, Dec 41.27) |
| `Whirlpool`     | Aladin/Sesame      | Messier 51 (RA 202.47, Dec 47.19)      |
| `Mars`          | SkyBot → Fallback  | Mars (RA 142.8, Dec -15.2, approx.)    |
| `Venus`         | SkyBot → Fallback  | Venus (RA 65.2, Dec 18.9, approx.)     |
| `Jupiter`       | SkyBot → Fallback  | Jupiter (RA 285.6, Dec 8.1, approx.)   |
| `10.68 41.27`   | No resolution      | Direct RA/Dec parse (Andromeda)        |
<!-- markdownlint-enable MD060 -->

### Scientific Analysis & Technical Details

**For detailed technical analysis, resolver architecture, and ephemeris implementation notes:**  
See [→ TARGET-RESOLUTION-EPHEMERIS.md](../architecture/TARGET-RESOLUTION-EPHEMERIS.md)

**Topics covered:**

- Root cause analysis of planet resolution failures
- Multi-layered fallback architecture
- Coordinate accuracy limitations and caveats
- Recommended production improvements (JPL Horizons, Astropy backend service)
- Testing strategy and validation approach

---

## User Workflows

### Workflow 1: Explore a Target

1. User navigates to `/view`
2. Enters RA/Dec of target (e.g., "10.68" / "41.27")
3. Form updates viewer → sky shows target
4. User zooms (adjusts FoV) or pans (clicks on sky)
5. Toggles Grid overlay to verify coordinates
6. Toggles Labels to see nearby catalog objects

### Workflow 2: Compare Multi-Wavelength Data

1. User is viewing VLASS survey
2. Clicks P/DSS2/color toggle → Survey switches to optical
3. Can now compare radio (VLASS) context with optical (DSS2) imagery
4. If optical resolution insufficient, toggles to 2MASS (infrared)
5. Cycles through surveys to understand multi-wavelength context

### Workflow 3: Share Analysis

1. User has found interesting sky region at RA/Dec with specific survey + zoom
2. Clicks "Update URL State" → Encodes into query parameter
3. Copies URL and shares with colleague
4. Colleague clicks link → Viewer loads at exact same coordinates
5. Both can discuss same region in sync

### Workflow 4: Export Science Data

1. User is exploring region of interest
2. Clicks "Download FITS Cutout" → FITS file downloaded
3. Imports into Python (Astropy) or IRAF for analysis
4. Performs photometry, source detection, etc.
5. Can return to viewer permalink to track source history

### Workflow 5: Document Discovery in Community Post

1. User discovers interesting object in viewer
2. Takes PNG snapshot (Save Snapshot button)
3. Navigates to `/posts/new` (post editor)
4. Embeds markdown viewer block with current state
5. Adds description text + screenshot
6. Publishes to community feed
7. Others can click embedded viewer link to explore

---

## API Reference

### GET /api/viewer/state/:shortid

Resolve short ID to full viewer state.

**Response:**

```typescript
{
  state: ViewerStateModel;
  created_at: string;
  view_count: number;
}
```

### POST /api/viewer/state

Create new persistent state, return short ID.

**Request:**

```typescript
ViewerStateModel
```

**Response:**

```typescript
{
  state: {
    id: string;
    short_id: string;
    ...ViewerStateModel;
    created_at: string;
  }
}
```

### GET /api/viewer/nearby

Query nearby catalog objects.

**Query Params:**

- `ra`: float (degrees)
- `dec`: float (degrees)
- `radius`: float (km, default 300)

**Response:**

```typescript
{
  labels: NearbyCatalogLabelModel[];
  centerMatch: NearbyCatalogLabelModel | null;
}
```

### GET /api/viewer/cutout

Generate FITS cutout image.

**Query Params:**

- `ra`: float
- `dec`: float
- `fov`: float
- `survey`: string
- `detail`: 'standard' | 'high' | 'max'

**Response:** Binary FITS file

---

## Performance Considerations

### HiPS Tile Caching

- **Client-side cache:** ~100 HiPS tiles max in memory
- **TTL:** Window-scoped (cleared on page reload)
- **Purpose:** Avoid re-downloading tiles when panning back
- **Trade-off:** Low memory footprint vs. repeated requests for distant regions

### Zoom Boundaries

- **Minimum FoV:** 0.1° (very zoomed in)
- **Maximum FoV:** 180° (full sky)
- **Optimal Range:** 0.5° - 60° (sweet spot for HiPS resolution)

### Network Debouncing

- Form changes debounced by 200ms before pushing to Aladin
- Prevents excessive re-renders during rapid coordinate entry
- Nearby catalog lookups debounced by 1s (avoid query spam while panning)

---

**Last Updated:** 2026-02-07  
**Maintained By:** VLASS Portal Frontend Team

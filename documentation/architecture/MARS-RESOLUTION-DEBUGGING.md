# Mars Resolution Debugging Guide

**Issue**: "Nothing shows up for mars" - the target search for planets isn't working as expected

---

## Diagnostics Checklist

### 1. Check Browser Console for Resolver Warnings

**Steps**:

1. Open browser DevTools (F12 or Cmd+Shift+K)

2. Go to **Console** tab

3. Type in search bar: `mars`

4. Press Enter to search

5. Look for logs containing:

   - `planet_resolution_fallback` (indicates fallback was used)

   - `target_search_resolved_skybot` (indicates SkyBot succeeded)

   - Any HTTP errors (404, 503, etc.)

**Expected Output for Mars**:

```javascript
[WARN] viewer planet_resolution_fallback
  planet: "mars"
  ra: 142.8
  dec: -15.2
  note: "Using approximate coordinates; planet positions change continuously"

```

If you see this, the resolver is working. If you don't see ANY logs, the `searchTarget()` method might not be triggering.

### 2. Check Network Requests

**Steps**:

1. Open DevTools > **Network** tab

2. Clear all requests (reload page)

3. Type "mars" in search bar

4. Look for HTTP requests to:

   - `vo.imcce.fr` (SkyBot endpoint) → should be **404** (expected, we fallback)

   - `vizier.cds.unistra.fr` (VizieR endpoint) → check status code

**Interpretation**:

- ✅ SkyBot 404 → Falls through to next resolver (expected)

- ✅ VizieR fails → Falls through to hardcoded (expected)

- ❌ No network requests at all → searchTarget() not being called

- ❌ Unhandled errors in console → Code error, not resolver issue

### 3. Check Form State

**Steps**:

1. Search for "mars"

2. Open DevTools > **Console** tab

3. Run:

```javascript
// Check component form values
const form = document.querySelector('[formGroup]');
const raInput = form.querySelector('input[formControlName="ra"]');
const decInput = form.querySelector('input[formControlName="dec"]');
console.log("RA:", raInput.value);
console.log("Dec:", decInput.value);

```

**Expected**:

- RA: `142.8` (or thereabouts)

- Dec: `-15.2` (or thereabouts)

**If Values Are Different**:

- Indicate a resolver is running but returning wrong coordinates

- Check Network tab for what API responses look like

### 4. Manual Form Update Test

**Steps**:

1. Manually enter RA: `142.8` and Dec: `-15.2` in Control Deck

2. Press Enter or click away

3. Does the viewer center on that location?

**Expected**: ✅ Yes, viewer updates immediately

**If No**: The Aladin viewer initialization is broken (separate issue from resolver)

---

## Possible Root Causes

### Root Cause A: Resolver Chain Not Executing

**Symptoms**:

- No network requests in Network tab

- No logs in console

- Form values don't change

**Solution**:

```typescript
// Add debugging to searchTarget() method
// In viewer.component.ts, line 432:
searchTarget(): void {
  const query = this.targetQuery.trim();
  if (!query) {
    this.statusMessage = 'Enter a target name to center the view.';
    return;
  }

  // ADD THIS DEBUG LINE:
  console.log('DEBUG: searchTarget called with query:', query);  // <-- ADD

  if (!isPlatformBrowser(this.platformId)) {
    return;
  }
  // ... rest of method
}

```

Reload, search for "mars", and check if "DEBUG: searchTarget called" appears.

### Root Cause B: gotoObject Returning True (Short-circuiting Fallback)

**Symptoms**:

- Mars resolves to wrong coordinates (not 142.8, -15.2)

- No fallback logs appear

- Viewer centers on some other location

**Diagnosis**:
Aladin's `gotoObject("mars")` might be:

1. Finding a different astronomical object called "mars"

2. Defaulting to some location

3. Silently failing but returning success

**Workaround**:
In `searchTarget()`, modify the condition to **always** try fallback:

```typescript
// Current behavior (suspicious):
switchMap((aladinSuccess) =>
  aladinSuccess
    ? of<'aladin'>('aladin')
    : this.resolveWithSkybot$(query),
),

// Proposed fix:
switchMap((aladinSuccesss) => {
  // Always try SkyBot for known planets
  const knownPlanets = ['mars', 'venus', 'jupiter', 'saturn', 'uranus', 'neptune', 'mercury'];
  const isKnownPlanet = knownPlanets.includes(query.toLowerCase());

  if (isKnownPlanet) {
    // Force SkyBot resolver for planets
    return this.resolveWithSkybot$(query);
  }

  // For other objects, use existing logic
  return aladinSuccess
    ? of<'aladin'>('aladin')
    : this.resolveWithSkybot$(query);
}),

```

### Root Cause C: HTTP Requests Timing Out / CORS Issues

**Symptoms**:

- Network requests visible but marked as failed

- CORS error in console

- Requests timeout

**Check**:

1. Open Network tab

2. Click on failed request (e.g., SkyBot 404)

3. Check **Response** tab for error details

4. Check **Headers** tab for CORS headers

**If CORS Error**:

- The external API doesn't allow requests from your domain

- Fallback should still work (hardcoded coordinates)

- If fallback doesn't appear, see Root Cause A

---

## Quick Test Script

**Paste this in browser console to test manually:**

```javascript
// Test planet collection
const testPlanets = {
  'mars': { ra: 142.8, dec: -15.2 },
  'venus': { ra: 65.2, dec: 18.9 },
  'jupiter': { ra: 285.6, dec: 8.1 },
};

// Test if Aladin gotoRaDec works
if (window.A && window.A.aladin) {
  const aladin = window.A.aladin;
  console.log('Aladin initialized:', !!aladin);

  // Test Mars coordinates
  console.log('Moving to Mars coordinates...');
  aladin.gotoRaDec(142.8, -15.2);

  // Check current position
  setTimeout(() => {
    const [ra, dec] = aladin.getRaDec();
    console.log('Current view RA/Dec:', ra, dec);
  }, 500);
} else {
  console.error('Aladin not loaded');
}

```

---

## If Issue Persists

**Recommended Next Steps**:

1. **Check Component Initialization**

   - Is `aladinView` null or undefined?

   - Is the Aladin script loading from CDN?

   - Check if there are any initialization errors in console

2. **Add Explicit Logging**

   ```typescript
   // In getKnownPlanetCoordinates, add:
   console.log('getKnownPlanetCoordinates called with:', name);
   const coords = knownPlanets[name];
   console.log('Found coordinates:', coords);
   ```

3. **Check Form State Flow**

   - Form updates from resolver

   - Form emits change event (`emitEvent: true`)

   - Syncs to Aladin view via existing sync mechanism

4. **Verify Observable Chain**

   - Add `.pipe(tap(x => console.log('Resolver returned:', x)))` at each stage

   - Verify each resolver is actually being called

---

## Coordinate Verification

If you do get coordinates, verify they're reasonable:

| Planet  | Expected RA (°) | Expected Dec (°) | Tolerance |
| :------ | :-------------- | :--------------- | :-------- |

| Mars    | ~140-145        | ~-15 to -10      | ±5°       |
| Venus   | ~60-70          | ~15-20           | ±5°       |
| Jupiter | ~280-290        | ~5-10            | ±5°       |

If you're getting coordinates outside these ranges, the resolver is picking up a different object or there's a parsing error.

---

## Questions for Debugging

When reporting the issue, please include:

1. ✅ Does manual RA/Dec input work? (Test with `142.8 -15.2`)

2. ✅ What appears in browser console? (Paste any error messages)

3. ✅ What appears in Network tab? (Are SkyBot/VizieR requests attempted?)

4. ✅ What's the status message that appears? (e.g., "Could not resolve" vs centered message)

5. ✅ Does M31 work? (Test with "M31" to isolate planet-specific issue)

---

**Status**: Debugging guide ready
## **For**: Scientific accuracy & debugging protocols (v1.1 planning)
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*

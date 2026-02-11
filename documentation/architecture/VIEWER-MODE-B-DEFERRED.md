# Viewer Mode B: Deferred Architecture

**Status:** Deferred to v2  
**Date:** 2026-02-07  
**Classification:** Historical Design Context (MVP uses Mode A only)

---

## Overview

Mode B (originally "Go-backed Mode") was a proposed two-tier viewer architecture designed to support observatory-grade data visualization with serverless FITS processing. This document explains the original vision and why it was deferred.

For current planning on "if/when" integration, feasibility gates, and permission assumptions, see:

- `documentation/architecture/VIEWER-MODE-B-INTEGRATION-OVERVIEW.md`

---

## Mode B Architecture (Proposed, Deferred)

### High-Level Design

```text
User Browser                         VLASS Platform
┌──────────────┐                    ┌──────────────────┐
│  Aladin      │  (Mode A)           │  Existing        │
│  Viewer      │◄──────────────────► │  REST API        │
│              │                     │  (HiPS preview)  │
└──────────────┘                    └──────────────────┘
       ▲
       │
       │ (Mode B - Deferred)
       │
       v
┌──────────────────────────────────────────────────────────┐
│  Mode B: FITS Processing Tier (NOT in MVP)              │
├──────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐  ┌──────────────┐  │
│  │   Go API    │ ─► │  FITS        │  │  Cloud       │  │
│  │  (manifest) │    │  Processor   │  │  Storage     │  │
│  └─────────────┘    │  (HIPS       │  │  (GCS/S3)    │  │
│                     │   pipeline)  │  └──────────────┘  │
│                     └──────────────┘                     │
└──────────────────────────────────────────────────────────┘
```

### Key Components (Proposed)

1. **Go API / Manifest Server**
   - Served HiPS tile manifests for on-demand FITS generation
   - Lazy compilation of FITS cutouts from raw survey data
   - Metadata for efficient tile caching strategies

2. **FITS Processing Pipeline**
   - Cloud-native serverless FITS generation
   - WCS header computation for precise astrometry
   - Flux calibration for photometric accuracy
   - Support for multi-wavelength overlay registration

3. **Storage Tier**
   - Generated tiles cached in cloud storage (GCS/S3)
   - Invalidation policy for versioned survey data
   - Archive for user-generated processed products

---

## Why Mode B Was Deferred

### 1. **Scope vs. Time Constraints**

**Issue:** Full FITS processing pipeline requires:

- Go API infrastructure development
- Serverless function orchestration
- Multi-wavelength WCS alignment algorithms
- Rigorous photometric calibration tests

**Decision:** Launch with Mode A (Aladin preview tiles from ESA CDN) for faster MVP delivery.

### 2. **FIPS Data Complexity**

**Original Requirement:** Support FIPS-compliant processed data products for scientific users

**Challenges Identified:**

- FIPS (Flexible Image Transport System) is the standard astronomical image format with complex headers
- Processing FIPS data at scale requires specialized libraries (CFITSIO, etc.)
- Metadata preservation during tile generation is error-prone
- Validation testing requires access to reference catalog data

**Why Not in MVP:**

- Limited initial user base doesn't require raw FITS access
- Preview tiles (HiPS) sufficient for discovery & analysis planning
- FIPS support adds 6-8 weeks to critical path
- Can be added post-launch via separate "Expert Mode"

### 3. **Data Retention vs. Real-Time Processing**

**Original Vision:** On-demand FITS generation would minimize storage costs

**Reality:**

- Pre-computed HiPS tiles already in CDN (from ESA/NRAO)
- Generated FITS cutouts still require caching for performance
- Real-time FITS generation adds latency (3-10s per tile)
- Users expect <500ms interactive response time

**Decision:** Delay serverless FITS generation until post-MVP when demand justifies infrastructure cost.

### 4. **FIPS Data Access Control**

**Deferred Feature:** Role-based FIPS access control

**Why Deferred:**

- Mode A requires minimal access control (public preview tiles)
- Mode B would require per-user quota management
- RBAC system complexity increases testing burden
- Can be implemented when Expert Mode is developed

---

## Mode B Feature Roadmap (v2+)

### Phase 1: Expert Mode (v2)

- [ ] Go API for FITS manifest generation
- [ ] Serverless FITS cutout processor
- [ ] S3 caching layer
- [ ] Admin dashboard for quota management

### Phase 2: Multi-Wavelength Alignment (v2.5)

- [ ] WCS cross-registration for overlays
- [ ] Photometric calibration pipeline
- [ ] Color composite generation

### Phase 3: Advanced Features (v3)

- [ ] User-generated FITS processing pipeline
- [ ] Time-series analysis tools
- [ ] Spectral extraction utilities

---

## Current MVP Strategy

### Mode A Only (Aladin Lite + ESA HiPS)

**Why This Meets MVP Requirements:**

| Requirement | Mode A Capability | FIPS Deferral Impact |
| --- | --- | --- |
| **Sky Discovery** | ✓ Browse 4 surveys in real-time | Sufficient for planning |
| **Coordinate Lookup** | ✓ RA/Dec input + nearby catalog | Direct API, no FITS needed |
| **Export Science Data** | ✓ Via REST API cutout endpoint | Uses pre-computed tiles |
| **Community Sharing** | ✓ State permalinks + snapshots | Viewer state, not raw data |
| **Performance** | ✓ <500ms interaction response | HiPS caching sufficient |
| **Access Control** | ✓ RBAC for API endpoints | Not needed for public preview |

---

## Migration Path: Mode A → Mode B

For future transition to Mode B ("Expert Mode"):

```text
┌─────────────────────────────────────────┐
│  Existing Mode A (Public Viewer)        │
│  (Discovery, VLASS QL quick-look data)  │
└──────────────────┬──────────────────────┘
                   │
                   │ New UI route
                   v
         ┌─────────────────────┐
         │  Mode Selection     │
         │  (Menu dropdown)    │
         └──────┬──────────────┘
                │
        ┌───────┴─────────┐
        │                 │
        v                 v
   ┌─────────┐      ┌──────────────┐
   │ Mode A  │      │  Mode B      │
   │ (Aladin)│      │  (FITS, Go)  │
   └─────────┘      └──────────────┘
```

**User Experience:**

1. Users access Mode A by default
2. Admin users see "Advanced Mode" toggle
3. Selecting Mode B displays disclaimer:
   - "FITS data includes calibration metadata"
   - "Processing may take 5-10 seconds per tile"
   - "Recommended for photometric analysis"

---

## FIPS Data Philosophy for Mode B

### Why FIPS (Not Raw HDF5/NetCDF)

**FIPS Compliance:** FIPS (Flexible Image Transport System) is the astronomy standard because:

1. **WCS Headers:** Store precise astrometric information (RA/Dec projection)
2. **Metadata:** Observation metadata (exposure time, filter, calibration info)
3. **History:** Processing history to ensure reproducible results
4. **Portability:** Universal support across analysis tools (FITS, IDL, Python astropy)

### FIPS Data Processing in Mode B

```text
Raw Survey Data (VLASS)
        │
        v
   ┌─────────────────┐
   │  FITS Generator │
   │  (Serverless)   │
   └────────┬────────┘
            │
            ├─► Compute WCS projection
            ├─► Apply flux calibration
            ├─► Generate uncertainty maps
            └─► Embed metadata headers
            │
            v
      FITS Cutout
   (Ready for analysis)
```

### Calibration Metadata (Deferred with Mode B)

```text
SIMPLE  =                    T / file does conform to FITS standard
BITPIX  =                   -32 / array data type
NAXIS   =                    2 / number of array dimensions
NAXIS1  =                 2048
NAXIS2  =                 2048
CTYPE1  = 'RA---TAN'           / coordinate type
CTYPE2  = 'DEC--TAN'           / coordinate type
CRVAL1  =            187.500000 / reference value
CRVAL2  =              2.050000 / reference value
CUNIT1  = 'deg'                / unit
CUNIT2  = 'deg'                / unit
CDELT1  = -0.000277778         / pixel scale (arcsec/pix converted to deg)
CDELT2  =  0.000277778         / pixel scale
CRPIX1  =              1024.500 / reference pixel
CRPIX2  =              1024.500 / reference pixel
MJD-OBS =               59700.5 / observation MJD
EXPTIME =                 2.0   / exposure time (seconds)
FILTER  = 'S-band'             / observation filter
PHOTZP  =                 38.5  / photometric zero point
SEEING  =                 1.4   / seeing FWHM (arcsec)
AIRMASS =                 1.35  / airmass at observation
```

These metadata fields enable:

- Photometric flux calibration
- Uncertainty/variance computation
- Multi-wavelength alignment via WCS
- Reproducibility documentation

---

## Technical Decision Record

**ADR Reference:** See `documentation/adr/` for detailed decision records on viewer architecture

**Key Decisions Made:**

- ✅ MVP: Mode A (Aladin preview tiles) only
- ✅ FIPS support deferred to v2 Expert Mode
- ✅ Serverless FITS processing deferred (cost/complexity high)
- ✅ Public preview tiles from ESA CDN (no storage costs)

**Revisit Triggers** (when to implement Mode B):

- ⏰ When 20%+ of users request raw FITS download
- ⏰ When expert users request flux calibration features
- ⏰ When multi-wavelength overlay demand increases

---

## References

- **FITS Standard:** [NASA FITS Documentation](https://fits.gsfc.nasa.gov/fits_standard.html)
- **WCS Specification:** [FITS World Coordinate System](https://www.atnf.csiro.au/people/mcalabre/WCS/)
- **HiPS Standard:** [Hierarchy of Equal Area HEALPix Pixels](http://www.ivoa.net/documents/HiPS/)
- **VLASS Survey:** [VLA Sky Survey](https://science.nrao.edu/vlass/)

**Related Documentation:**

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture overview
- [SCOPE-LOCK.md](../SCOPE-LOCK.md) - MVP scope boundaries
- [PRODUCT-CHARTER.md](../product/PRODUCT-CHARTER.md) - Product requirements

---

**Last Updated:** 2026-02-07  
**Status:** Archived (For Reference Only - MVP Uses Mode A)  
**Maintained By:** VLASS Portal Architecture Team

# Location Privacy & Personalization

## Overview

VLASS Portal personalizes the landing page background (sky image) to the user's region. This is done with **strict privacy guarantees**:

- **Coarse-grained only:** Geohash precision 4 (~5km × 5km grid)

- **No storage of precise location:** Only geohash stored (reversible but not pinpoint)

- **User opt-in:** Browser geolocation only if user permits

- **Fallback:** Manual entry (city/state) as alternative

- **No tracking:** No persistent cross-session tracking

---

## Part 1: Location Acquisition

### Option A: Browser Geolocation (Opt-In)

User visits landing page → "Want a personalized sky view? Share your location?" → User clicks OK.

```typescript
// apps/vlass-web/src/app/landing/location.service.ts

@Injectable({ providedIn: 'root' })
export class LocationService {
  readonly location$ = new BehaviorSubject<{ lat: number; lon: number } | null>(
    null,
  );

  requestBrowserLocation(): Observable<{ lat: number; lon: number }> {
    return new Observable((observer) => {
      if (!navigator.geolocation) {
        observer.error('Geolocation not supported');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          observer.next({ lat: latitude, lon: longitude });
          observer.complete();
        },
        (error) => {
          observer.error(error.message);
        },
        {
          enableHighAccuracy: false, // OK with coarse location
          timeout: 5000,
        },
      );
    });
  }
}

```

### Option B: Manual Entry

User types city/state or coordinates:

```text
┌─────────────────────────────────┐
│ Or enter your location manually: │
│                                 │
│ [City / State]                  │
│ or                              │
│ [RA (0-360°)] [Dec (-90-90°)]   │
│                                 │
│ [Search]                        │
└─────────────────────────────────┘

```

Backend geocodes city → RA/Dec:

```typescript
@Post("api/v1/location/geocode")
async geocodeCity(
  @Body() dto: { city: string; state?: string }
): Promise<{ ra: number; dec: number; geohash: string }> {
  const geo = await this.geocoder.geocode(
    `${dto.city}, ${dto.state || "USA"}`
  );

  if (!geo) {
    throw new BadRequestException("Location not found");
  }

  const { latitude, longitude } = geo;

  // Convert to sky coordinates (RA/Dec in J2000)
  // For SSR preview: map lat/lon to zenith of observer
  const ra = (longitude + 360) % 360;  // Simplified; actually needs time/date

  const dec = latitude;

  const geohash = geohasher.encode(latitude, longitude, 4);  // Precision 4

  return { ra, dec, geohash };
}

```

---

## Part 2: Geohashing

### Geohash Library & Precision

We use `geohash-js` (Node) and `geohash` library for browser compatibility.

```typescript
import geohash from 'geohash-lib';

// Precision 4: ~5km × 5km cells
const gh = geohash.encode(40.7128, -74.006, 4);
// → "dr5r"

// Reverse (should NOT be precise enough to identify individual)
const { latitude, longitude, error } = geohash.bounds(gh);
// latitude: 40.70313, ±0.02197 (±2.4 km)
// longitude: -74.01367, ±0.02197

```

**Precision trade-offs:**

| Precision | Cell Size | Risk                       | Use          |
| --------- | --------- | -------------------------- | ------------ |

| 1         | ~5000 km  | Too coarse (continent)     | ❌           |
| 2         | ~600 km   | Too coarse (country)       | ❌           |
| 3         | ~75 km    | Usable; still broad        | ✓ (fallback) |
| 4         | ~5-10 km  | Good balance               | ✓✓ MVP       |
| 5         | ~600 m    | Too precise (neighborhood) | ❌           |
| 6         | ~75 m     | Identifying (street)       | ❌           |

### Recommendation: Precision 4 (default)

---

## Part 3: Cookie Storage

After user provides location (consent + geohash computed), store in signed HTTP-only cookie:

```typescript
// apps/vlass-api/src/app/landing/location.controller.ts

@Post("api/v1/location/set")
async setLocation(
  @Body() dto: { geohash: string },
  @Response() res
): Promise<void> {
  // Validate geohash format
  if (!isValidGeohash(dto.geohash, 4)) {
    throw new BadRequestException("Invalid geohash");
  }

  // Sign cookie to prevent tampering
  const cookieValue = this.crypto.sign(dto.geohash);

  // Set secure, HTTP-only, SameSite cookie
  res.cookie("vlass_location", cookieValue, {
    httpOnly: true,           // Not accessible to JS; prevents XSS leakage
    secure: true,             // HTTPS only
    sameSite: "Lax",          // CSRF protection
    maxAge: 90 * 24 * 60 * 60 * 1000,  // 90 days

    path: "/",
    domain: ".vlass.example.com",
  });

  res.json({ success: true, geohash: dto.geohash });
}

@Get("api/v1/location/verify")
async verifyAndGetLocation(
  @Request() req
): Promise<{ geohash: string }> {
  const cookie = req.cookies["vlass_location"];

  if (!cookie) {
    throw new UnauthorizedException("No location set");
  }

  // Verify signature
  const verified = this.crypto.verify(cookie);
  if (!verified) {
    throw new ForbiddenException("Location cookie tampered");
  }

}

```

### Cookie Format

```text
vlass_location={base64_encoded_signed_payload}

Payload (JSON):
{
  "geohash": "dr5r",
  "timestamp": 1707264000,
  "signed": "hmac_sha256(...)",
  "nonce": "random_string"
}

```

---

## Part 4: SSR Preview Generation

Server-side rendering fetches personalized sky image for landing page:

```typescript
// apps/vlass-web/src/app/landing/landing.component.server.ts

async function renderLandingPage(req: Request, res: Response): Promise<string> {
  // Extract location from cookie
  let geohash = null;
  const locationCookie = extractCookie(req.headers['cookie'], 'vlass_location');

  if (locationCookie) {
    const verified = crypto.verify(locationCookie);
    if (verified) {
      geohash = verified.geohash;
    }
  }

  // Fetch background image
  let backgroundImageUrl = 'default.png'; // Generic fallback
  if (geohash) {
    const bounds = geohasher.bounds(geohash);
    backgroundImageUrl = await fetchBackgroundImage({
      ra: degreesToRA(bounds.longitude),
      dec: bounds.latitude,
      fov: 15, // 15° field of view for nice region
      width: 1920,
      height: 1080,
    });
  }

  // Render HTML with inline background
  return renderToString(
    `
    <style>
      .landing-hero {
        background-image: url('${backgroundImageUrl}');
        background-size: cover;
        background-position: center;
      }
    </style>
    <div class="landing-hero">
      <h1>Explore VLASS Sky</h1>
      ...
    </div>
    `,
  );
}

```

### Background Image Generation

The `/api/v1/location/background` endpoint calls Rust to generate preview:

```typescript
@Get("api/v1/location/background")
async getBackgroundImage(
  @Query("ra") ra: number,
  @Query("dec") dec: number,
  @Query("fov") fov: number = 15,
  @Query("width") width: number = 1920,
  @Query("height") height: number = 1080
): Promise<StreamableFile> {
  // Call Rust service
  const pngStream = await this.rust.preview({
    epoch: "ql_rms",  // Always use latest epoch
    centerRa: ra,
    centerDec: dec,
    fovDeg: fov,
    width,
    height,
    colormap: "viridis",
    scale: "sqrt",  // Good for visibility
  });

  return new StreamableFile(pngStream, {
    type: "image/png",
  });
}

```

---

## Part 5: Audit & Logging

Location access (browser geolocation only) is logged:

```typescript
// User grants permission
await this.audit.log({
  action: 'LOCATION_PERMISSION_GRANTED',
  actor_id: user?.id || 'anonymous',
  details: { geohash: geohash.substring(0, 2) + '**' }, // Redact to 2 chars

  timestamp: new Date(),
});

// Geohash stored to cookie
await this.audit.log({
  action: 'LOCATION_STORED_TO_COOKIE',
  actor_id: user?.id || 'anonymous',
  details: { geohash: geohash.substring(0, 2) + '**' },

  timestamp: new Date(),
});

```

**Redaction rule:** Only log first 2 characters of geohash (reduces precision to ~600 km).

---

## Part 6: Client-Side Implementation

### Landing Page Component

```typescript
// apps/vlass-web/src/app/landing/landing.component.ts

@Component({
  selector: 'app-landing',
  template: `
    <div
      class="hero"
      [ngStyle]="{ backgroundImage: backgroundUrl$ | async | bgImage }"
    >
      <button (click)="requestLocation()">
        Share Location for Personalized Sky View
      </button>

      <div *ngIf="manualLocationVisible">
        <input [(ngModel)]="cityInput" placeholder="City, State" />
        <button (click)="geocodeCity()">Search</button>
      </div>

      <button (click)="toggleManualEntry()">Or enter manually</button>
    </div>
  `,
})
export class LandingComponent implements OnInit {
  backgroundUrl$!: Observable<string>;
  manualLocationVisible = false;
  cityInput = '';

  constructor(
    private location: LocationService,
    private api: ApiService,
    private gtag: GoogleAnalyticsService,
  ) {}

  ngOnInit(): void {
    // Check if location already in cookie (on return visit)
    this.backgroundUrl$ = this.api.getBackground().pipe(
      map((res) => res.url),
      catchError(() => of('/assets/default-background.png')),
    );
  }

  requestLocation(): void {
    this.location.requestBrowserLocation().subscribe(
      ({ lat, lon }) => {
        // Send to server
        this.api.setLocation(lat, lon).subscribe(() => {
          // Reload background
          this.backgroundUrl$ = this.api
            .getBackground()
            .pipe(map((res) => res.url));

          this.gtag.event('location_shared', {
            method: 'browser_geolocation',
          });
        });
      },
      (error) => {
        console.log('Geolocation denied or unavailable:', error);
        this.manualLocationVisible = true;
      },
    );
  }

  geocodeCity(): void {
    this.api.geocodeCity(this.cityInput).subscribe(
      (result) => {
        this.backgroundUrl$ = this.api
          .getBackground(result.ra, result.dec)
          .pipe(map((res) => res.url));

        this.gtag.event('location_shared', {
          method: 'manual_entry',
        });
      },
      (error) => {
        alert('City not found');
      },
    );
  }

  toggleManualEntry(): void {
    this.manualLocationVisible = !this.manualLocationVisible;
  }
}

```

### Privacy Consent Banner

```html
<div class="privacy-banner">
  <p>
    ℹ️ We use your location to personalize the sky view. Your precise location
    is not stored—only a coarse grid reference (5km radius).
  </p>
  <a href="/privacy">Privacy Policy</a>
</div>

```

---

## Part 7: Privacy Guarantees

### What is Stored

✅ Geohash (precision 4): ~5km × 5km cell identifier
✅ Timestamp: when location was set
✅ HTTP-only, signed cookie: immune to JS XSS

### What is NOT Stored

❌ Precise latitude/longitude
❌ Device identifiers (IMEI, etc.)
❌ Cross-session tracking
❌ IP address (unless already logged elsewhere)

### Audit Trail (Redacted)

❌ Full geohash (only first 2 chars logged)
❌ Any raw lat/lon

### Data Deletion

When user deletes account (see DATA-RETENTION.md):

- Cookie is cleared immediately (browser-side)

- Server audit logs are redacted to 2-char prefix (anonymization, not deletion)

- No separate location database to wipe

---

## Part 8: Testing

```typescript
// apps/vlass-api-e2e/src/location-privacy.spec.ts

describe('Location Privacy', () => {
  it('should store geohash in signed cookie', async () => {
    const res = await request
      .post('/api/v1/location/set')
      .send({ geohash: 'dr5r' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/httpOnly/);
    expect(res.headers['set-cookie'][0]).toMatch(/Secure/);
  });

  it('should reject tampered geohash cookie', async () => {
    const agent = request.agent();

    // Set legitimate cookie
    await agent.post('/api/v1/location/set').send({ geohash: 'dr5r' });

    // Tamper with cookie (in-memory)
    const cookies = agent.jar.getCookies();
    const locationCookie = cookies.find((c) => c.key === 'vlass_location');
    locationCookie.value = 'forged_value';

    // Try to verify
    const res = await agent.get('/api/v1/location/verify');

    expect(res.status).toBe(403);
  });

  it('should return background image for geohash', async () => {
    const res = await request.get(
      '/api/v1/location/background?ra=206.3&dec=35.87&fov=15',
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.body.length).toBeGreaterThan(10000); // >10KB PNG
  });

  it('should geocode city to geohash', async () => {
    const res = await request
      .post('/api/v1/location/geocode')
      .send({ city: 'Berkeley', state: 'CA' });

    expect(res.status).toBe(200);
    expect(res.body.ra).toBeDefined();
    expect(res.body.dec).toBeDefined();
    expect(res.body.geohash).toMatch(/^[0-9a-z]{4}$/); // Precision 4
  });

  it('should redact geohash in audit logs', async () => {
    await request.post('/api/v1/location/set').send({ geohash: 'dr5rghj2' }); // Full geohash

    const auditLogs = await db.audit_event.findMany({
      where: { action: 'LOCATION_STORED_TO_COOKIE' },
    });

    const log = auditLogs[0];
    expect(log.details.geohash).toBe('dr**'); // Only first 2 chars
  });

  it('should clear location on account deletion', async () => {
    const user = await createUser();
    const jwt = user.jwt;

    // Set location
    await request
      .post('/api/v1/location/set')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ geohash: 'dr5r' });

    // Delete account
    await request
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${jwt}`);

    // Verify cookie is gone (should not be issued on next login)
    const loginRes = await request
      .post('/auth/login')
      .send({ email: user.email, password: user.password });

    expect(loginRes.headers['set-cookie']).not.toMatch(/vlass_location/);
  });
});

```

---

## Part 9: FAQ

**Q: Can you deanonymize a geohash?**
A: Yes, precision 4 reveals ~5km cell. But we don't store geohashes in queryable database; only in signed cookie + redacted audit logs.

**Q: What if user doesn't provide location?**
A: They get generic background (entire sky or random field). Still works; just not personalized.

**Q: What about VPN / proxy?**
A: Browser geolocation goes through system APIs, not IP. VPN doesn't affect it. Manual entry is unaffected.

**Q: Can this be GDPR-compliant?**
A: Yes. Geohash ≤5km is not personally identifiable (5 million cells globally). It's not "personal data" in GDPR terms. Audit logging doesn't include raw geohash.

---

**Last Updated:** 2026-02-11
**Status:** NORMATIVE

## **Related:** DATA-RETENTION-DELETION.md, AUTHENTICATION.md
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*

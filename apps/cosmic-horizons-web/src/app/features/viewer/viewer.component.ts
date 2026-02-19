import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  isDevMode,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  NgZone,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Observable,
  catchError,
  defer,
  from,
  fromEvent,
  interval,
  map,
  merge,
  of,
  startWith,
  switchMap,
  take,
  tap,
  throwError,
} from 'rxjs';
import {
  CutoutTelemetryModel,
  NearbyCatalogLabelModel,
  ViewerApiService,
  ViewerLabelModel,
  ViewerStateModel,
} from './viewer-api.service';
import { HipsTilePrefetchService } from './hips-tile-prefetch.service';
import { AppLoggerService } from '../../services/app-logger.service';
import { AuthSessionService } from '../../services/auth-session.service';

type AladinEvent = 'positionChanged' | 'zoomChanged';

interface AladinOptions {
  target?: string;
  fov?: number;
  survey?: string;
  // When true/false toggles Aladin's remote logging (AladinLiteLogger)
  log?: boolean;
  showCooGrid?: boolean;
  showFullscreenControl?: boolean;
  showLayersControl?: boolean;
}

interface AladinListenerPayload {
  ra?: number;
  dec?: number;
}

interface AladinView {
  gotoRaDec(ra: number, dec: number): void;
  gotoObject?(objectName: string): Promise<void> | void;
  setFoV(fov: number): void;
  setImageSurvey?(survey: string): void;
  setBaseImageLayer?(survey: string): void;
  setCooGrid?(enabled: boolean): void;
  showCooGrid?(enabled: boolean): void;
  getFov(): number | [number, number];
  getRaDec(): [number, number];
  getViewDataURL(options?: {
    format?: 'image/png';
    width?: number;
    height?: number;
    logo?: boolean;
  }): Promise<string>;
  on(
    event: AladinEvent,
    callback: (payload: AladinListenerPayload | number) => void,
  ): void;
  pix2world?(x: number, y: number): [number, number] | null;
}

interface AladinFactory {
  init: Promise<void>;
  aladin(container: HTMLElement, options: AladinOptions): AladinView;
}

const DSS_COLOR_HIPS_URL = 'https://skies.esac.esa.int/DSSColor';

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss'],
  standalone: false,
})
export class ViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('aladinHost')
  aladinHost?: ElementRef<HTMLElement>;

  readonly stateForm: FormGroup;
  shortId = '';
  permalink = '';
  statusMessage = '';
  targetQuery = '';
  loadingPermalink = false;
  savingSnapshot = false;
  labelDraft = '';
  labels: ViewerLabelModel[] = [];
  catalogLabels: NearbyCatalogLabelModel[] = [];
  cutoutTelemetry: CutoutTelemetryModel | null = null;
  cutoutDetail: 'standard' | 'high' | 'max' = 'max';
  gridOverlayEnabled = false;
  labelsOverlayEnabled = true;
  pdssColorEnabled = false;
  controlPanelCollapsed = false;
  keyboardHelpVisible = false;
  private previousSurvey = 'VLASS'; // Track survey when disabling P/DSS
  readonly surveyOptions = [
    { label: 'VLASS', value: 'VLASS' },
    { label: 'DSS2 Color', value: 'DSS2' },
    { label: 'DSS2 Red', value: 'P/DSS2/red' },
    { label: 'DSS2 Blue', value: 'P/DSS2/blue' },
    { label: '2MASS', value: '2MASS' },
    { label: 'PanSTARRS Color', value: 'P/PanSTARRS/DR1/color-z-zg-g' },
    { label: 'HST (optical)', value: 'P/HST/color' },
  ];

  private aladinView: AladinView | null = null;
  private syncingFromViewer = false;
  private syncingFromForm = false;
  private lastAppliedSurvey = '';
  private nearbyLookupTimer: ReturnType<typeof setTimeout> | null = null;
  private cursorLookupTimer: ReturnType<typeof setTimeout> | null = null;
  private viewerSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private lastNearbyLookupKey = '';
  private initialFovForLabels: number | null = null;
  private hasUserZoomedIn = false;
  private zoomEventCount = 0;
  private gridToggleStartedAt: number | null = null;
  private readonly viewerSyncDebounceMs = 250;
  private readonly nearbyLookupDebounceMs = 400;
  private readonly cursorLookupDebounceMs = 150;
  private readonly supportedAladinSurveys = new Set<string>([
    'P/VLASS/QL',
    'P/DSS2/color',
    'P/DSS2/red',
    'P/DSS2/blue',
    DSS_COLOR_HIPS_URL,
    'P/2MASS/color',
    'P/PanSTARRS/DR1/color-z-zg-g',
    'P/HST/color',
  ]);

  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewerApi = inject(ViewerApiService);
  private readonly tilePrefetch = inject(HipsTilePrefetchService);
  private readonly appLogger = inject(AppLoggerService);
  private readonly authSessionService = inject(AuthSessionService);
  private readonly http = inject(HttpClient);
  private readonly ngZone = inject(NgZone);
  private readonly labelsStorageKey = 'vlass.viewer.labels.v1';

  constructor() {
    this.stateForm = this.fb.group({
      ra: [
        187.25,
        [Validators.required, Validators.min(-360), Validators.max(360)],
      ],
      dec: [
        2.05,
        [Validators.required, Validators.min(-90), Validators.max(90)],
      ],
      fov: [
        1.5,
        [Validators.required, Validators.min(0.001), Validators.max(180)],
      ],
      survey: ['VLASS', [Validators.required, Validators.minLength(2)]],
    });
  }

  get encodedState(): string {
    if (!this.stateForm.valid) {
      return '';
    }

    return this.encodeState(this.currentState());
  }

  get nativeResolutionHint(): string {
    if (!this.stateForm.valid) {
      return '';
    }

    const state = this.currentState();
    const effectiveSurvey = this.resolveEffectiveSurvey(state);
    const minFov = this.minNativeFovForSurvey(effectiveSurvey);

    if (state.fov <= minFov) {
      return `Near native resolution for ${effectiveSurvey}. Further zoom mostly enlarges pixels.`;
    }

    if (
      state.survey.toUpperCase() === 'VLASS' &&
      effectiveSurvey !== 'P/VLASS/QL'
    ) {
      return `Auto-switched to ${effectiveSurvey} for sharper deep-zoom detail.`;
    }

    return '';
  }

  get suggestedSharperSurvey(): string | null {
    if (!this.stateForm.valid) {
      return null;
    }

    const state = this.currentState();
    const selectedSurvey = this.resolveSurvey(state.survey);
    if (selectedSurvey !== 'P/VLASS/QL') {
      return null;
    }

    if (state.fov <= 0.85) {
      return 'P/PanSTARRS/DR1/color-z-zg-g';
    }

    if (state.fov <= 2.2) {
      return 'P/DSS2/color';
    }

    return null;
  }

  get centerCatalogLabel(): NearbyCatalogLabelModel | null {
    if (
      !this.labelsOverlayEnabled ||
      this.catalogLabels.length === 0 ||
      !this.stateForm.valid
    ) {
      return null;
    }

    const nearest = [...this.catalogLabels].sort(
      (a, b) => a.angular_distance_deg - b.angular_distance_deg,
    )[0];
    const state = this.currentState();
    const matchThresholdDeg = Math.max(
      0.0015,
      Math.min(0.03, state.fov * 0.06),
    );

    if (nearest.angular_distance_deg > matchThresholdDeg) {
      return null;
    }

    return nearest;
  }

  get cutoutSuccessRate(): string {
    if (!this.cutoutTelemetry || this.cutoutTelemetry.requests_total === 0) {
      return 'n/a';
    }

    const rate =
      (this.cutoutTelemetry.success_total /
        this.cutoutTelemetry.requests_total) *
      100;
    return `${rate.toFixed(1)}%`;
  }

  ngOnInit(): void {
    this.loadLocalLabels();
    this.gridOverlayEnabled = false;
    this.resetLabelLookupGate();
    this.startCutoutTelemetryStream();

    merge(this.route.paramMap, this.route.queryParamMap)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.hydrateStateFromRoute();
      });

    this.stateForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (this.stateForm.valid) {
          this.syncAladinFromForm();
        }
        // Sync P/DSS toggle with survey selection
        if (value.survey === 'DSS2') {
          this.pdssColorEnabled = true;
        } else if (this.pdssColorEnabled && value.survey !== 'DSS2') {
          this.pdssColorEnabled = false;
        }
      });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const startAt = performance.now();
    this.initializeAladin$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.logViewerEvent('viewer_load_complete', {
            duration_ms: Math.round(performance.now() - startAt),
            grid_enabled: this.gridOverlayEnabled,
            pdss_enabled: this.pdssColorEnabled,
          });

          // Set up mouse interaction outside Angular zone to avoid excessive change detection
          this.ngZone.runOutsideAngular(() => {
            const host = this.aladinHost?.nativeElement;
            if (host) {
              fromEvent<MouseEvent>(host, 'mousemove')
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe((e) => this.onCanvasMouseMove(e));

              fromEvent(host, 'mouseleave')
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe(() => this.onCanvasMouseLeave());
            }
          });

          this.schedulePrefetchActivation();
          this.scheduleNearbyLabelLookup(this.currentState());
        },
        error: () => {
          this.logViewerEvent('viewer_load_failed', {
            duration_ms: Math.round(performance.now() - startAt),
          });
          this.statusMessage = 'Failed to initialize sky viewer.';
        },
      });
  }

  ngOnDestroy(): void {
    if (this.nearbyLookupTimer) {
      clearTimeout(this.nearbyLookupTimer);
      this.nearbyLookupTimer = null;
    }

    if (this.cursorLookupTimer) {
      clearTimeout(this.cursorLookupTimer);
      this.cursorLookupTimer = null;
    }

    if (this.viewerSyncTimer) {
      clearTimeout(this.viewerSyncTimer);
      this.viewerSyncTimer = null;
    }

    this.tilePrefetch.deactivate();
  }

  applyStateToUrl(): void {
    if (!this.stateForm.valid) {
      this.statusMessage = 'Fix invalid fields before generating URL state.';
      return;
    }

    const encodedState = this.encodeState(this.currentState());
    this.router.navigate(['/view'], {
      queryParams: { state: encodedState },
      replaceUrl: true,
    });
    this.statusMessage = 'URL state updated.';
  }

  createPermalink(): void {
    if (!this.stateForm.valid) {
      this.statusMessage = 'Fix invalid fields before creating permalink.';
      return;
    }

    this.loadingPermalink = true;
    this.statusMessage = '';

    this.viewerApi.createState(this.currentState()).subscribe({
      next: (response) => {
        this.loadingPermalink = false;
        this.shortId = response.short_id;
        this.permalink = `${this.originPrefix()}${response.permalink_path}`;
        this.router.navigate(['/view', response.short_id], {
          replaceUrl: true,
        });
        this.statusMessage = `Permalink created: ${response.short_id}`;
      },
      error: (error: HttpErrorResponse) => {
        this.loadingPermalink = false;
        this.statusMessage =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'Failed to create permalink.';
      },
    });
  }

  saveSnapshot(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!this.aladinView || !this.stateForm.valid) {
      this.statusMessage = 'Snapshot unavailable until viewer state is valid.';
      return;
    }

    this.savingSnapshot = true;

    from(this.aladinView.getViewDataURL({ format: 'image/png' }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (imageDataUrl) => {
          this.viewerApi
            .createSnapshot({
              image_data_url: imageDataUrl,
              short_id: this.shortId || undefined,
              state: this.currentState(),
            })
            .subscribe({
              next: (response) => {
                this.savingSnapshot = false;
                this.downloadSnapshot(imageDataUrl, response.id);
                this.statusMessage = `Snapshot stored (${Math.round(response.size_bytes / 1024)} KB).`;
              },
              error: (error: HttpErrorResponse) => {
                this.savingSnapshot = false;
                this.statusMessage =
                  typeof error.error?.message === 'string'
                    ? error.error.message
                    : 'Failed to store snapshot.';
              },
            });
        },
        error: () => {
          this.savingSnapshot = false;
          this.statusMessage = 'Snapshot generation failed.';
        },
      });
  }

  addCenterLabel(): void {
    const name = this.labelDraft.trim();
    if (!name || !this.stateForm.valid) {
      this.statusMessage =
        'Enter a label name before tagging the centered item.';
      return;
    }

    const state = this.currentState();
    const label: ViewerLabelModel = {
      name,
      ra: Number(state.ra.toFixed(5)),
      dec: Number(state.dec.toFixed(5)),
      created_at: new Date().toISOString(),
    };

    this.labels = [label, ...this.labels].slice(0, 100);
    this.saveLocalLabels();
    this.labelDraft = '';
    this.statusMessage = `Labeled center as "${label.name}".`;
  }

  addCatalogLabelAsAnnotation(label: NearbyCatalogLabelModel): void {
    const annotation: ViewerLabelModel = {
      name: label.name,
      ra: Number(label.ra.toFixed(5)),
      dec: Number(label.dec.toFixed(5)),
      created_at: new Date().toISOString(),
    };

    const existing = this.labels.find(
      (entry) =>
        entry.name === annotation.name &&
        Math.abs(entry.ra - annotation.ra) < 1e-5 &&
        Math.abs(entry.dec - annotation.dec) < 1e-5,
    );
    if (existing) {
      this.statusMessage = `Annotation "${annotation.name}" already exists.`;
      return;
    }

    this.labels = [annotation, ...this.labels].slice(0, 100);
    this.saveLocalLabels();
    this.statusMessage = `Added catalog label "${annotation.name}" as annotation.`;
  }

  addCenterCatalogLabelAsAnnotation(): void {
    const centerLabel = this.centerCatalogLabel;
    if (!centerLabel) {
      this.statusMessage = 'No close catalog match at the current center.';
      return;
    }

    this.addCatalogLabelAsAnnotation(centerLabel);
  }

  searchTarget(): void {
    const query = this.targetQuery.trim();
    if (!query) {
      this.statusMessage = 'Enter a target name to center the view.';
      return;
    }

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.statusMessage = `Resolving "${query}"...`;
    this.appLogger.info('viewer', 'target_search_requested', { query });

    of(query)
      .pipe(
        switchMap((target) => this.tryGotoWithAladin$(target)),
        switchMap((aladinSuccess) => {
          if (aladinSuccess) {
            return of<'aladin' | { ra: number; dec: number }>('aladin');
          }
          // Try scientific ephemeris backend (Phase 2)
          return this.viewerApi.resolveEphemeris(query).pipe(
            catchError(() => {
              this.appLogger.info('viewer', 'ephemeris_failed_trying_legacy', {
                query,
              });
              return this.resolveWithSkybot$(query);
            }),
          );
        }),
        tap((result) => {
          if (result === 'aladin') {
            this.statusMessage = `Centered on "${query}".`;
            this.appLogger.info('viewer', 'target_search_resolved_aladin', {
              query,
            });
          } else if (result && typeof result === 'object' && 'ra' in result) {
            this.stateForm.patchValue(
              {
                ra: Number(result.ra.toFixed(4)),
                dec: Number(result.dec.toFixed(4)),
              },
              { emitEvent: true },
            );
            this.statusMessage = `Centered on "${query}" via Scientific Ephemeris.`;
            this.appLogger.info('viewer', 'target_search_resolved_ephem', {
              query,
              ...result,
            });
          } else {
            this.statusMessage = `Could not resolve "${query}".`;
            this.appLogger.warn('viewer', 'target_search_failed', { query });
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private tryGotoWithAladin$(query: string) {
    if (!this.aladinView || typeof this.aladinView.gotoObject !== 'function') {
      return of(false);
    }

    return defer(() => {
      try {
        const maybe = this.aladinView?.gotoObject?.(query);
        const finish = () => {
          const aladin = this.aladinView;
          if (!aladin) {
            return false;
          }
          const [ra, dec] = aladin.getRaDec();
          this.stateForm.patchValue(
            { ra: Number(ra.toFixed(4)), dec: Number(dec.toFixed(4)) },
            { emitEvent: true },
          );
          return true;
        };
        if (this.isPromiseLike(maybe)) {
          return from(maybe).pipe(
            map(() => finish()),
            catchError(() => of(false)),
          );
        }
        return of(finish());
      } catch {
        return of(false);
      }
    });
  }

  private resolveWithSkybot$(name: string) {
    // Try alternative ephemeris endpoints for planets and solar system objects
    return this.tryAlternativeEphemerisApis$(name);
  }

  private tryAlternativeEphemerisApis$(name: string) {
    // First, try the corrected SkyBot endpoint
    const correctedSkyBotUrl = `http://vo.imcce.fr/webservices/skybot/api/ephem?name=${encodeURIComponent(
      name,
    )}&type=EQ&epoch=now&output=json`;

    return this.http.get(correctedSkyBotUrl).pipe(
      map((response: unknown) => this.parseSkyBotResponse(response)),
      catchError(() => {
        // If SkyBot fails, try IMCCE's VizieR-based service
        return this.tryVizierEphemerisService$(name);
      }),
    );
  }

  private tryVizierEphemerisService$(name: string) {
    // Fallback: Use CDS VizieR service for object name resolution
    // This can sometimes resolve planets and other solar system objects
    const vizierUrl = `https://vizier.cds.unistra.fr/viz-bin/votable?-source=yCat/aliases&Name=${encodeURIComponent(
      name,
    )}&-out=RA,DEC&-style=tab`;

    return this.http.get(vizierUrl).pipe(
      map((response: unknown) => this.parseVizierResponse(response)),
      catchError(() => this.tryBasicAstroAlgorithm(name)),
    );
  }

  private tryBasicAstroAlgorithm(name: string) {
    // As a final fallback, try to resolve using basic algorithms for major planets
    const planetCoordsFallback = this.getKnownPlanetCoordinates(
      name.toLowerCase().trim(),
    );
    return of(planetCoordsFallback);
  }

  private parseSkyBotResponse(
    response: unknown,
  ): { ra: number; dec: number } | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = response as any;
    const ra = Number(resp.result?.ra ?? resp.result?.RA ?? resp.ra ?? resp.RA);
    const dec = Number(
      resp.result?.dec ?? resp.result?.DEC ?? resp.dec ?? resp.DEC,
    );

    if (Number.isFinite(ra) && Number.isFinite(dec)) {
      if (this.aladinView?.gotoRaDec) {
        this.aladinView.gotoRaDec(ra, dec);
      }
      return { ra, dec };
    }
    return null;
  }

  private parseVizierResponse(
    response: unknown,
  ): { ra: number; dec: number } | null {
    // VizieR returns various formats, attempt to extract coordinates
    if (!response || typeof response !== 'object') {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = response as any;
    const ra = Number(resp.RA ?? resp.ra);
    const dec = Number(resp.DEC ?? resp.dec);

    if (Number.isFinite(ra) && Number.isFinite(dec)) {
      if (this.aladinView?.gotoRaDec) {
        this.aladinView.gotoRaDec(ra, dec);
      }
      return { ra, dec };
    }
    return null;
  }

  private getKnownPlanetCoordinates(
    name: string,
  ): { ra: number; dec: number } | null {
    // Hardcoded approximate coordinates for major planets (updated for current epoch ~2026)
    // These are approximate because planets move; for precise positions, use proper ephemeris services
    // WARNING: These coordinates are approximate and should not be used for scientific purposes
    const knownPlanets: Record<string, { ra: number; dec: number }> = {
      mercury: { ra: 45.5, dec: 12.3 }, // Approximate, moves rapidly
      venus: { ra: 65.2, dec: 18.9 }, // Approximate, moves rapidly
      mars: { ra: 142.8, dec: -15.2 }, // Approximate
      jupiter: { ra: 285.6, dec: 8.1 }, // Approximate
      saturn: { ra: 306.4, dec: 12.2 }, // Approximate
      uranus: { ra: 31.2, dec: 5.1 }, // Approximate
      neptune: { ra: 348.9, dec: -2.3 }, // Approximate
      sun: { ra: 180.0, dec: 0.0 }, // Ecliptic
      moon: { ra: 180.0, dec: 0.0 }, // Approximate (highly variable)
    };

    const coords = knownPlanets[name];
    if (coords) {
      this.appLogger.warn('viewer', 'planet_resolution_fallback', {
        planet: name,
        ra: coords.ra,
        dec: coords.dec,
        note: 'Using approximate coordinates; planet positions change continuously',
      });
      if (this.aladinView?.gotoRaDec) {
        this.aladinView.gotoRaDec(coords.ra, coords.dec);
      }
      return coords;
    }

    // Not a known planet
    return null;
  }

  logCatalogHover(label: NearbyCatalogLabelModel): void {
    if (!isDevMode()) {
      return;
    }

    this.appLogger.debug('viewer', 'catalog_label_hover', {
      name: label.name,
      objectType: label.object_type,
      ra: label.ra,
      dec: label.dec,
      angularDistanceDeg: label.angular_distance_deg,
      confidence: label.confidence,
    });
  }

  removeLabel(label: ViewerLabelModel): void {
    this.labels = this.labels.filter((entry) => entry !== label);
    this.saveLocalLabels();
  }

  downloadScienceData(): void {
    if (!isPlatformBrowser(this.platformId) || !this.stateForm.valid) {
      return;
    }

    const state = this.currentState();
    const centerLabel = this.labels[0]?.name;
    const cutoutUrl = this.viewerApi.scienceDataUrl(
      state,
      centerLabel,
      this.cutoutDetail,
    );
    window.open(cutoutUrl, '_blank', 'noopener');
  }

  applySuggestedSurvey(): void {
    const survey = this.suggestedSharperSurvey;
    if (!survey) {
      return;
    }

    this.stateForm.patchValue({ survey }, { emitEvent: true });
    this.statusMessage = `Switched to ${survey} for sharper detail at this zoom.`;
  }

  toggleGridOverlay(enabled: boolean): void {
    const previous = this.gridOverlayEnabled;
    this.gridOverlayEnabled = enabled;
    this.gridToggleStartedAt = isPlatformBrowser(this.platformId)
      ? performance.now()
      : null;
    this.logViewerEvent('grid_toggle_requested', {
      previous_enabled: previous,
      next_enabled: enabled,
    });
    this.reinitializeAladinView$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => {
          this.statusMessage = 'Failed to reinitialize sky viewer.';
          if (
            this.gridToggleStartedAt !== null &&
            isPlatformBrowser(this.platformId)
          ) {
            this.logViewerEvent('grid_toggle_failed', {
              enabled: this.gridOverlayEnabled,
              reinit_duration_ms: Math.round(
                performance.now() - this.gridToggleStartedAt,
              ),
            });
            this.gridToggleStartedAt = null;
          }
        },
      });
  }

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
      return;
    }

    this.scheduleNearbyLabelLookup(this.currentState(), { force: true });
  }

  togglePdssColor(enabled: boolean): void {
    const previous = this.pdssColorEnabled;
    this.pdssColorEnabled = enabled;

    if (enabled) {
      // Save current survey before switching to DSS2
      this.previousSurvey = this.stateForm.value.survey || 'VLASS';
      this.stateForm.patchValue({ survey: 'DSS2' }, { emitEvent: true });
    } else {
      // Switch back to previous survey when disabling P/DSS
      this.stateForm.patchValue(
        { survey: this.previousSurvey },
        { emitEvent: true },
      );
    }

    this.logViewerEvent('pdss_toggle_requested', {
      previous_enabled: previous,
      next_enabled: enabled,
      target_survey: enabled ? 'DSS2' : this.previousSurvey,
    });
  }

  toggleControlPanel(): void {
    this.controlPanelCollapsed = !this.controlPanelCollapsed;
  }

  toggleKeyboardHelp(): void {
    this.keyboardHelpVisible = !this.keyboardHelpVisible;
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (
      !this.labelsOverlayEnabled ||
      !this.aladinView ||
      !this.stateForm.valid
    ) {
      return;
    }

    const canvas = event.currentTarget as HTMLElement;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const pix2world =
      this.aladinView.pix2world ??
      (
        window as unknown as {
          A?: { pix2world?: (x: number, y: number) => [number, number] };
        }
      ).A?.pix2world;

    if (!pix2world) {
      return;
    }

    try {
      const skyCoords = pix2world(x, y);
      if (!skyCoords || skyCoords.length < 2) {
        return;
      }

      const ra = skyCoords[0];
      const dec = skyCoords[1];

      // Trigger label lookup at cursor position

      // Create a state with the cursor's coordinates
      const state = this.currentState();
      const cursorState: ViewerStateModel = {
        ra,
        dec,
        fov: state.fov,
        survey: state.survey,
      };

      // Schedule a nearby lookup at the cursor position
      this.scheduleNearbyLabelLookupAtCursor(cursorState);
    } catch {
      // Silently ignore conversion errors
    }
  }

  onCanvasMouseLeave(): void {
    this.ngZone.run(() => {
      // Clear labels and cancel pending lookups when cursor leaves canvas
      if (this.cursorLookupTimer) {
        clearTimeout(this.cursorLookupTimer);
        this.cursorLookupTimer = null;
      }
      // Immediately clear catalog labels for responsive UX
      this.catalogLabels = [];
    });
  }

  private scheduleNearbyLabelLookupAtCursor(state: ViewerStateModel): void {
    if (
      !isPlatformBrowser(this.platformId) ||
      !this.stateForm.valid ||
      !this.labelsOverlayEnabled
    ) {
      return;
    }

    // Debounce cursor lookups with a shorter timer
    if (this.cursorLookupTimer) {
      clearTimeout(this.cursorLookupTimer);
    }

    this.cursorLookupTimer = setTimeout(() => {
      const radius = this.lookupRadiusForState(state);
      this.viewerApi
        .getNearbyLabels(state.ra, state.dec, radius, 16)
        .subscribe({
          next: (labels) => {
            this.ngZone.run(() => {
              this.catalogLabels = this.selectNearbyLabels(labels);
            });
          },
          error: () => {
            this.ngZone.run(() => {
              // Silently ignore errors for cursor lookups
              this.catalogLabels = [];
            });
          },
        });
    }, this.cursorLookupDebounceMs); // 1-second debounce for cursor label lookups
  }

  private hydrateStateFromRoute(): void {
    const shortId = this.route.snapshot.paramMap.get('shortId');
    if (shortId) {
      this.resolveFromShortId(shortId);
      return;
    }

    const encoded = this.route.snapshot.queryParamMap.get('state');
    if (!encoded) {
      if (this.labels.length === 0) {
        this.loadLocalLabels();
      }
      this.syncAladinFromForm();
      return;
    }

    try {
      const decoded = this.decodeState(encoded);
      this.stateForm.patchValue(decoded, { emitEvent: false });
      this.labels = decoded.labels ?? [];
      this.saveLocalLabels();
      this.shortId = '';
      this.permalink = '';
      this.resetLabelLookupGate();
      this.syncAladinFromForm();
    } catch {
      this.statusMessage = 'Invalid `state` query param. Using defaults.';
      this.router.navigate(['/view'], { replaceUrl: true });
    }
  }

  private resolveFromShortId(shortId: string): void {
    this.viewerApi.resolveState(shortId).subscribe({
      next: (response) => {
        this.stateForm.patchValue(response.state, { emitEvent: false });
        this.labels = response.state.labels ?? [];
        this.saveLocalLabels();
        this.shortId = response.short_id;
        this.permalink = `${this.originPrefix()}/view/${response.short_id}`;
        this.statusMessage = `Loaded permalink ${response.short_id}.`;
        this.resetLabelLookupGate();
        this.syncAladinFromForm();
      },
      error: () => {
        this.statusMessage = 'Permalink was not found.';
        this.router.navigate(['/view'], { replaceUrl: true });
      },
    });
  }

  private currentState(): ViewerStateModel {
    return {
      ra: Number(this.stateForm.value.ra),
      dec: Number(this.stateForm.value.dec),
      fov: Number(this.stateForm.value.fov),
      survey: String(this.stateForm.value.survey),
      labels: this.labels,
    };
  }

  private loadLocalLabels(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const raw = window.localStorage.getItem(this.labelsStorageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ViewerLabelModel[];
      if (Array.isArray(parsed)) {
        this.labels = parsed.filter(
          (label) =>
            typeof label?.name === 'string' &&
            Number.isFinite(label?.ra) &&
            Number.isFinite(label?.dec) &&
            typeof label?.created_at === 'string',
        );
      }
    } catch {
      this.labels = [];
    }
  }

  private saveLocalLabels(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    window.localStorage.setItem(
      this.labelsStorageKey,
      JSON.stringify(this.labels.slice(0, 100)),
    );
  }

  private encodeState(state: ViewerStateModel): string {
    return btoa(JSON.stringify(state))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private decodeState(encoded: string): ViewerStateModel {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    const padded = normalized + (padding === 0 ? '' : '='.repeat(4 - padding));
    return JSON.parse(atob(padded)) as ViewerStateModel;
  }

  private initializeAladin$(): Observable<void> {
    const startedAt = isPlatformBrowser(this.platformId)
      ? performance.now()
      : 0;
    const host = this.aladinHost?.nativeElement;
    if (!host) {
      return of(void 0);
    }

    return this.loadAladinFactory$().pipe(
      switchMap((aladinFactory) => {
        if (!aladinFactory) {
          return throwError(() => new Error('Aladin factory missing'));
        }

        this.ngZone.runOutsideAngular(() => {
          try {
            this.aladinView = aladinFactory.aladin(host, {
              target: `${this.stateForm.value.ra} ${this.stateForm.value.dec}`,
              fov: Number(this.stateForm.value.fov),
              survey: this.resolveEffectiveSurvey(this.currentState()),
              // Disable Aladin's remote-logger at initialization (prevents noisy fetch failures)
              log: false,
              showCooGrid: this.gridOverlayEnabled,
              showFullscreenControl: false,
              showLayersControl: false,
            });

            this.aladinView.on('positionChanged', () => {
              this.scheduleFormSyncFromAladin();
            });
            this.aladinView.on('zoomChanged', () => {
              this.zoomEventCount += 1;
              this.scheduleFormSyncFromAladin();
            });
          } catch (err) {
            // Defensive: external Aladin API may throw synchronously in edge cases.
            this.appLogger.error('viewer', 'aladin_instantiate_failed', {
              message: (err as Error)?.message ?? String(err),
            });
            this.ngZone.run(() => {
              this.statusMessage = 'Failed to initialize sky viewer.';
            });
            this.aladinView = null;
          }
        });

        this.applySurveyToAladin(
          this.resolveEffectiveSurvey(this.currentState()),
        );
        if (this.initialFovForLabels === null) {
          this.initialFovForLabels = Number(this.stateForm.value.fov);
        }
        if (isPlatformBrowser(this.platformId)) {
          this.logViewerEvent('aladin_initialized', {
            duration_ms: Math.round(performance.now() - startedAt),
            grid_enabled: this.gridOverlayEnabled,
            pdss_enabled: this.pdssColorEnabled,
          });
        }

        return of(void 0);
      }),
    );
  }

  private loadAladinFactory$(): Observable<AladinFactory | null> {
    if (!isPlatformBrowser(this.platformId)) {
      return of(null);
    }

    const getFactory = (): AladinFactory | undefined =>
      (window as unknown as { A?: AladinFactory }).A;

    const cachedFactory = getFactory();
    if (cachedFactory) {
      return from(cachedFactory.init).pipe(map(() => cachedFactory));
    }

    const existingScript = document.querySelector(
      'script[data-cosmic-aladin="true"]',
    ) as HTMLScriptElement | null;

    // Aladin's remote-logger is disabled via the `log: false` init option above —
    // no global `fetch` interception is necessary. Keeping initialization simple
    // reduces risk of interfering with other page fetch behavior.

    const scriptReady$ =
      existingScript && getFactory()
        ? of(void 0)
        : existingScript
          ? this.waitForScriptLoad$(existingScript)
          : defer(() => {
              const script = document.createElement('script');
              script.src =
                'https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js';
              script.async = true;
              script.defer = true;
              script.dataset['cosmicAladin'] = 'true';
              document.body.appendChild(script);
              return this.waitForScriptLoad$(script);
            });

    return scriptReady$.pipe(
      switchMap(() => {
        const factory = getFactory();
        if (!factory) {
          return of(null);
        }

        return from(factory.init).pipe(map(() => factory));
      }),
    );
  }

  private waitForScriptLoad$(script: HTMLScriptElement): Observable<void> {
    return merge(
      fromEvent(script, 'load').pipe(map(() => void 0)),
      fromEvent(script, 'error').pipe(
        switchMap(() =>
          throwError(() => new Error('Unable to load Aladin Lite')),
        ),
      ),
    ).pipe(take(1));
  }

  private syncAladinFromForm(): void {
    if (
      !isPlatformBrowser(this.platformId) ||
      !this.aladinView ||
      !this.stateForm.valid ||
      this.syncingFromViewer
    ) {
      return;
    }

    this.syncingFromForm = true;
    const state = this.currentState();
    this.aladinView.gotoRaDec(state.ra, state.dec);
    this.aladinView.setFoV(state.fov);
    this.applySurveyToAladin(this.resolveEffectiveSurvey(state));
    this.scheduleNearbyLabelLookup(state);
    this.syncingFromForm = false;
  }

  private syncFormFromAladin(): void {
    if (!this.aladinView || this.syncingFromForm) {
      return;
    }

    const [ra, dec] = this.aladinView.getRaDec();
    const rawFov = this.aladinView.getFov();
    const fov = Array.isArray(rawFov) ? rawFov[0] : rawFov;
    const current = this.currentState();
    const patchState: Partial<ViewerStateModel> = {};

    if (Math.abs(current.ra - ra) > 1e-4) {
      patchState.ra = Number(ra.toFixed(4));
    }
    if (Math.abs(current.dec - dec) > 1e-4) {
      patchState.dec = Number(dec.toFixed(4));
    }
    if (Math.abs(current.fov - fov) > 1e-4) {
      patchState.fov = Number(fov.toFixed(4));
    }

    if (
      this.initialFovForLabels !== null &&
      fov <= this.initialFovForLabels * 0.98 &&
      this.initialFovForLabels - fov > 0
    ) {
      this.hasUserZoomedIn = true;
    }

    const hasChanges = Object.keys(patchState).length > 0;
    const nextState = { ...current, ...patchState };
    const radius = this.lookupRadiusForState(nextState);
    const lookupKey = `${nextState.ra.toFixed(4)}|${nextState.dec.toFixed(4)}|${radius.toFixed(4)}`;
    const needsLookup =
      this.labelsOverlayEnabled && lookupKey !== this.lastNearbyLookupKey;

    if (!hasChanges && !needsLookup) {
      return;
    }

    this.ngZone.run(() => {
      this.syncingFromViewer = true;
      if (hasChanges) {
        this.stateForm.patchValue(patchState, { emitEvent: false });
      }
      this.scheduleNearbyLabelLookup(this.currentState());
      this.syncingFromViewer = false;
    });
  }

  private scheduleFormSyncFromAladin(): void {
    if (this.viewerSyncTimer) {
      clearTimeout(this.viewerSyncTimer);
    }

    this.viewerSyncTimer = setTimeout(() => {
      this.viewerSyncTimer = null;
      this.syncFormFromAladin();
    }, this.viewerSyncDebounceMs);
  }

  private scheduleNearbyLabelLookup(
    state: ViewerStateModel,
    options?: { force?: boolean },
  ): void {
    if (!isPlatformBrowser(this.platformId) || !this.stateForm.valid) {
      return;
    }

    if (!this.labelsOverlayEnabled) {
      this.catalogLabels = [];
      this.lastNearbyLookupKey = '';
      return;
    }

    const radius = this.lookupRadiusForState(state);
    const lookupKey = `${state.ra.toFixed(4)}|${state.dec.toFixed(4)}|${radius.toFixed(4)}`;
    if (!options?.force && lookupKey === this.lastNearbyLookupKey) {
      return;
    }

    // Clear transient catalog matches immediately when the view moves,
    // so stale labels do not linger while the debounced lookup runs.
    this.catalogLabels = [];

    // Show labels whenever the Labels overlay is enabled — do not require an
    // explicit user zoom to populate catalog matches. This makes the UI
    // behave intuitively when users toggle Labels on/off.

    if (this.nearbyLookupTimer) {
      clearTimeout(this.nearbyLookupTimer);
    }

    this.nearbyLookupTimer = setTimeout(() => {
      this.viewerApi
        .getNearbyLabels(state.ra, state.dec, radius, 16)
        .subscribe({
          next: (labels) => {
            this.ngZone.run(() => {
              this.lastNearbyLookupKey = lookupKey;
              this.catalogLabels = this.selectNearbyLabels(labels);
            });
          },
          error: () => {
            this.ngZone.run(() => {
              // Keep retries available when provider/network is temporarily unavailable.
              this.lastNearbyLookupKey = '';
              this.catalogLabels = [];
            });
          },
        });
    }, this.nearbyLookupDebounceMs);
  }

  private lookupRadiusForState(state: ViewerStateModel): number {
    return Number(Math.max(0.02, Math.min(0.2, state.fov * 0.15)).toFixed(4));
  }

  private selectNearbyLabels(
    labels:
      | NearbyCatalogLabelModel[]
      | { data?: NearbyCatalogLabelModel[] }
      | null
      | undefined,
  ): NearbyCatalogLabelModel[] {
    // Ensure labels is an array (API may return {data: [...]} or direct array)
    const labelsArray = Array.isArray(labels) ? labels : (labels?.data ?? []);

    if (!Array.isArray(labelsArray)) {
      return [];
    }

    const highConfidence = labelsArray
      .filter(
        (label) =>
          label.confidence >= 0.5 &&
          Number.isFinite(label.angular_distance_deg),
      )
      .sort((a, b) => a.angular_distance_deg - b.angular_distance_deg);

    if (highConfidence.length >= 3) {
      return highConfidence.slice(0, 8);
    }

    return labelsArray
      .filter((label) => Number.isFinite(label.angular_distance_deg))
      .sort((a, b) => a.angular_distance_deg - b.angular_distance_deg)
      .slice(0, 5);
  }

  private resolveSurvey(surveyValue: unknown): string {
    const survey = typeof surveyValue === 'string' ? surveyValue.trim() : '';
    if (!survey) {
      return 'P/DSS2/color';
    }

    const normalized = survey.toUpperCase();
    if (normalized === 'VLASS') {
      return 'P/VLASS/QL';
    }
    if (normalized === 'DSS2') {
      return DSS_COLOR_HIPS_URL;
    }
    if (normalized === '2MASS') {
      return 'P/2MASS/color';
    }

    // Avoid pushing partially typed aliases (e.g. "VL") into Aladin.
    if (!survey.includes('/')) {
      return this.lastAppliedSurvey || DSS_COLOR_HIPS_URL;
    }

    return survey;
  }

  private resolveEffectiveSurvey(state: ViewerStateModel): string {
    const selectedSurvey = this.resolveSurvey(state.survey);

    if (selectedSurvey === 'P/VLASS/QL') {
      if (state.fov <= 0.85) {
        return 'P/PanSTARRS/DR1/color-z-zg-g';
      }

      if (this.lastAppliedSurvey === 'P/PanSTARRS/DR1/color-z-zg-g') {
        if (state.fov <= 1.05) {
          return 'P/PanSTARRS/DR1/color-z-zg-g';
        }
      }

      if (this.lastAppliedSurvey === DSS_COLOR_HIPS_URL) {
        if (state.fov <= 2.2) {
          return DSS_COLOR_HIPS_URL;
        }
      }

      // Keep VLASS as the state/cutout survey, but render with stable
      // optical fallback layers in Aladin to avoid invalid HiPS metadata.
      return DSS_COLOR_HIPS_URL;
    }

    return selectedSurvey;
  }

  private minNativeFovForSurvey(survey: string): number {
    if (survey.includes('PanSTARRS')) {
      return 0.01;
    }
    if (survey.includes('DSS2') || survey.includes('DSSColor')) {
      return 0.03;
    }
    if (survey.includes('VLASS')) {
      return 0.07;
    }

    return 0.05;
  }

  private applySurveyToAladin(survey: string): void {
    if (!this.aladinView || !survey || this.lastAppliedSurvey === survey) {
      return;
    }

    if (!this.supportedAladinSurveys.has(survey)) {
      return;
    }

    if (typeof this.aladinView.setImageSurvey === 'function') {
      this.aladinView.setImageSurvey(survey);
      this.lastAppliedSurvey = survey;
      return;
    }

    if (typeof this.aladinView.setBaseImageLayer === 'function') {
      this.aladinView.setBaseImageLayer(survey);
      this.lastAppliedSurvey = survey;
    }
  }

  private reinitializeAladinView$(): Observable<void> {
    const host = this.aladinHost?.nativeElement;
    if (!host) {
      return of(void 0);
    }

    host.innerHTML = '';
    this.aladinView = null;
    this.lastAppliedSurvey = '';
    this.zoomEventCount = 0;
    return this.initializeAladin$().pipe(
      tap(() => {
        this.syncAladinFromForm();
        this.scheduleNearbyLabelLookup(this.currentState(), { force: true });
        if (
          this.gridToggleStartedAt !== null &&
          isPlatformBrowser(this.platformId)
        ) {
          this.logViewerEvent('grid_toggle_applied', {
            enabled: this.gridOverlayEnabled,
            reinit_duration_ms: Math.round(
              performance.now() - this.gridToggleStartedAt,
            ),
          });
          this.gridToggleStartedAt = null;
        }
      }),
    );
  }

  private isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'then' in value &&
      typeof value.then === 'function'
    );
  }

  private resetLabelLookupGate(): void {
    // Preserve zoom flag if it's already been set (don't reset on toolbar actions)
    const preserveZoom = this.hasUserZoomedIn;
    this.hasUserZoomedIn = preserveZoom;
    // Only reset initialFov if we're not preserving zoom state
    if (!preserveZoom) {
      this.initialFovForLabels = Number(this.stateForm.value.fov);
    }
    this.catalogLabels = [];
    this.lastNearbyLookupKey = '';
    this.zoomEventCount = 0;
  }

  private downloadSnapshot(dataUrl: string, id: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `cosmic-snapshot-${id}.png`;
    anchor.click();
  }

  private originPrefix(): string {
    return isPlatformBrowser(this.platformId) ? window.location.origin : '';
  }

  private startCutoutTelemetryStream(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.authSessionService.getRole() !== 'admin') {
      return;
    }

    interval(30_000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.viewerApi.getCutoutTelemetry().pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((telemetry) => {
        if (!telemetry) {
          return;
        }
        this.cutoutTelemetry = telemetry;
      });
  }

  private schedulePrefetchActivation(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const windowWithIdle = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
    };
    if (typeof windowWithIdle.requestIdleCallback === 'function') {
      windowWithIdle.requestIdleCallback(() => this.tilePrefetch.activate(), {
        timeout: 1200,
      });
      return;
    }

    window.setTimeout(() => this.tilePrefetch.activate(), 350);
  }

  private logViewerEvent(
    event: string,
    details: Record<string, boolean | number | string>,
  ): void {
    if (!isPlatformBrowser(this.platformId) || !isDevMode()) {
      return;
    }

    const userAgent =
      typeof navigator === 'undefined' ? '' : navigator.userAgent;
    if (userAgent.toLowerCase().includes('jsdom')) {
      return;
    }

    this.appLogger.info('viewer', event, details);
  }
}

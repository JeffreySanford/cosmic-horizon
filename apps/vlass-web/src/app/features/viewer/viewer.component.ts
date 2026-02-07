import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from, merge } from 'rxjs';
import { ViewerApiService, ViewerStateModel } from './viewer-api.service';

type AladinEvent = 'positionChanged' | 'zoomChanged';

interface AladinOptions {
  target?: string;
  fov?: number;
  survey?: string;
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
  setFoV(fov: number): void;
  setImageSurvey?(survey: string): void;
  setBaseImageLayer?(survey: string): void;
  getFov(): number | [number, number];
  getRaDec(): [number, number];
  getViewDataURL(options?: { format?: 'image/png'; width?: number; height?: number; logo?: boolean }): Promise<string>;
  on(event: AladinEvent, callback: (payload: AladinListenerPayload | number) => void): void;
}

interface AladinFactory {
  init: Promise<void>;
  aladin(container: HTMLElement, options: AladinOptions): AladinView;
}

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrl: './viewer.component.scss',
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class ViewerComponent implements OnInit, AfterViewInit {
  @ViewChild('aladinHost')
  aladinHost?: ElementRef<HTMLElement>;

  readonly stateForm: FormGroup;
  shortId = '';
  permalink = '';
  statusMessage = '';
  loadingPermalink = false;
  savingSnapshot = false;

  private aladinView: AladinView | null = null;
  private syncingFromViewer = false;
  private syncingFromForm = false;
  private lastAppliedSurvey = '';

  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewerApi = inject(ViewerApiService);

  constructor() {
    this.stateForm = this.fb.group({
      ra: [187.25, [Validators.required, Validators.min(-360), Validators.max(360)]],
      dec: [2.05, [Validators.required, Validators.min(-90), Validators.max(90)]],
      fov: [1.5, [Validators.required, Validators.min(0.1), Validators.max(180)]],
      survey: ['VLASS', [Validators.required, Validators.minLength(2)]],
    });
  }

  get encodedState(): string {
    if (!this.stateForm.valid) {
      return '';
    }

    return this.encodeState(this.currentState());
  }

  ngOnInit(): void {
    merge(this.route.paramMap, this.route.queryParamMap)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.hydrateStateFromRoute();
      });

    this.stateForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.stateForm.valid) {
          this.syncAladinFromForm();
        }
      });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    from(this.initializeAladin())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.syncAladinFromForm();
        },
        error: () => {
          this.statusMessage = 'Failed to initialize sky viewer.';
        },
      });
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
        this.router.navigate(['/view', response.short_id], { replaceUrl: true });
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

  private hydrateStateFromRoute(): void {
    const shortId = this.route.snapshot.paramMap.get('shortId');
    if (shortId) {
      this.resolveFromShortId(shortId);
      return;
    }

    const encoded = this.route.snapshot.queryParamMap.get('state');
    if (!encoded) {
      this.syncAladinFromForm();
      return;
    }

    try {
      const decoded = this.decodeState(encoded);
      this.stateForm.patchValue(decoded, { emitEvent: false });
      this.shortId = '';
      this.permalink = '';
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
        this.shortId = response.short_id;
        this.permalink = `${this.originPrefix()}/view/${response.short_id}`;
        this.statusMessage = `Loaded permalink ${response.short_id}.`;
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
    };
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

  private async initializeAladin(): Promise<void> {
    const host = this.aladinHost?.nativeElement;
    if (!host) {
      return;
    }

    const aladinFactory = await this.loadAladinFactory();
    if (!aladinFactory) {
      throw new Error('Aladin factory missing');
    }

    this.aladinView = aladinFactory.aladin(host, {
      target: `${this.stateForm.value.ra} ${this.stateForm.value.dec}`,
      fov: Number(this.stateForm.value.fov),
      survey: this.resolveSurvey(this.stateForm.value.survey),
      showCooGrid: true,
      showFullscreenControl: false,
      showLayersControl: true,
    });

    this.aladinView.on('positionChanged', () => {
      this.syncFormFromAladin();
    });
    this.aladinView.on('zoomChanged', () => {
      this.syncFormFromAladin();
    });

    this.applySurveyToAladin(this.resolveSurvey(this.stateForm.value.survey));
  }

  private async loadAladinFactory(): Promise<AladinFactory | null> {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const getFactory = (): AladinFactory | undefined => (window as unknown as { A?: AladinFactory }).A;

    const cachedFactory = getFactory();
    if (cachedFactory) {
      await cachedFactory.init;
      return cachedFactory;
    }

    const existingScript = document.querySelector(
      'script[data-vlass-aladin="true"]',
    ) as HTMLScriptElement | null;
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js';
      script.async = true;
      script.defer = true;
      script.dataset['vlassAladin'] = 'true';

      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Unable to load Aladin Lite'));
        document.body.appendChild(script);
      });
    } else if (!getFactory()) {
      await new Promise<void>((resolve, reject) => {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Unable to load Aladin Lite')), {
          once: true,
        });
      });
    }

    const factory = getFactory();
    if (!factory) {
      return null;
    }

    await factory.init;
    return factory;
  }

  private syncAladinFromForm(): void {
    if (!isPlatformBrowser(this.platformId) || !this.aladinView || !this.stateForm.valid || this.syncingFromViewer) {
      return;
    }

    this.syncingFromForm = true;
    const state = this.currentState();
    this.aladinView.gotoRaDec(state.ra, state.dec);
    this.aladinView.setFoV(state.fov);
    this.applySurveyToAladin(this.resolveSurvey(state.survey));
    this.syncingFromForm = false;
  }

  private syncFormFromAladin(): void {
    if (!this.aladinView || this.syncingFromForm) {
      return;
    }

    this.syncingFromViewer = true;

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

    if (Object.keys(patchState).length > 0) {
      this.stateForm.patchValue(patchState, { emitEvent: false });
    }

    this.syncingFromViewer = false;
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
      return 'P/DSS2/color';
    }
    if (normalized === '2MASS') {
      return 'P/2MASS/color';
    }

    return survey;
  }

  private applySurveyToAladin(survey: string): void {
    if (!this.aladinView || !survey || this.lastAppliedSurvey === survey) {
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

  private downloadSnapshot(dataUrl: string, id: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `vlass-snapshot-${id}.png`;
    anchor.click();
  }

  private originPrefix(): string {
    return isPlatformBrowser(this.platformId) ? window.location.origin : '';
  }
}

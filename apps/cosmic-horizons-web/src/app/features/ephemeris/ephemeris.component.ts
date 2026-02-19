import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EphemerisApiService, EphemerisResult } from './ephemeris-api.service';
import { AppLoggerService } from '../../services/app-logger.service';
import { AuthSessionService } from '../../services/auth-session.service';

@Component({
  selector: 'app-ephemeris',
  templateUrl: './ephemeris.component.html',
  styleUrls: ['./ephemeris.component.scss'],
  standalone: false,
})
export class EphemerisComponent implements OnInit, OnDestroy {
  searchForm: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  noResultsMessage = '';
  result: EphemerisResult | null = null;
  previewImageUrl = '';

  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly ephemerisApiService = inject(EphemerisApiService);
  private readonly authSessionService = inject(AuthSessionService);
  private readonly logger = inject(AppLoggerService);
  private readonly destroy$ = new Subject<void>();

  get user() {
    return (
      this.authSessionService.getUser() || {
        username: '',
        email: '',
        id: '',
        display_name: '',
        role: 'user' as const,
        created_at: '',
      }
    );
  }

  get f() {
    return this.searchForm.controls;
  }

  constructor() {
    this.searchForm = this.formBuilder.group({
      target: ['', [Validators.required, Validators.minLength(2)]],
      epoch: [''],
    });
  }

  ngOnInit(): void {
    this.logger.info('ephemeris', 'page_loaded');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';
    this.noResultsMessage = '';
    this.result = null;
    this.previewImageUrl = '';

    if (this.searchForm.invalid) {
      return;
    }

    const target = this.normalizeTarget(
      this.searchForm.get('target')?.value as string,
    );
    if (target.length < 2) {
      this.error = 'Target name is required (minimum 2 characters).';
      return;
    }

    const epochRaw = this.searchForm.get('epoch')?.value as string | undefined;
    const epoch = this.normalizeEpoch(epochRaw);

    this.loading = true;
    this.logger.info('ephemeris', 'search_submit', {
      target,
      epoch: epoch ?? 'now',
    });

    this.ephemerisApiService
      .search({ target, epoch })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;

          if (!this.isValidResult(response)) {
            this.noResultsMessage = `No valid coordinates were returned for "${target}".`;
            this.logger.warn('ephemeris', 'search_invalid_payload', {
              target,
              response,
            });
            return;
          }

          this.result = {
            ...response,
            target: this.normalizeTarget(response.target || target),
          };
          this.previewImageUrl =
            response.sky_preview_url ||
            this.buildSkyPreviewUrl(response.ra, response.dec);

          this.logger.info('ephemeris', 'search_success', {
            target: this.result.target,
            ra: this.result.ra,
            dec: this.result.dec,
            source: this.result.source,
          });
        },
        error: (httpError: HttpErrorResponse) => {
          this.loading = false;
          this.error = this.formatErrorMessage(httpError, target);
          this.logger.error('ephemeris', 'search_failed', {
            target,
            status_code: httpError.status,
            error: httpError.error?.message || httpError.statusText,
          });
        },
      });
  }

  clearSearch(): void {
    this.searchForm.reset();
    this.submitted = false;
    this.loading = false;
    this.error = '';
    this.noResultsMessage = '';
    this.result = null;
    this.previewImageUrl = '';
  }

  logout(): void {
    this.authSessionService.clearSession();
    this.logger.info('ephemeris', 'logout_success');
    this.router.navigate(['/auth/login']);
  }

  openInViewer(): void {
    if (!this.result) {
      return;
    }

    const query = new URLSearchParams({
      ra: this.result.ra.toFixed(6),
      dec: this.result.dec.toFixed(6),
      fov: '1.2',
      survey: 'DSS2 Color',
    });

    window.open(`/viewer?${query.toString()}`, '_blank', 'noopener,noreferrer');
  }

  private normalizeTarget(input: string): string {
    return (input || '').trim();
  }

  private normalizeEpoch(epoch: string | undefined): string | undefined {
    const value = (epoch || '').trim();
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  private isValidResult(
    payload: EphemerisResult | null | undefined,
  ): payload is EphemerisResult {
    return (
      !!payload && Number.isFinite(payload.ra) && Number.isFinite(payload.dec)
    );
  }

  private formatErrorMessage(error: HttpErrorResponse, target: string): string {
    if (error.status === 404) {
      return `Object "${target}" was not found. Try a canonical name like "mars", "jupiter", or "moon".`;
    }

    if (error.status === 400) {
      return (
        error.error?.message ||
        'Invalid search parameters. Check target and epoch values.'
      );
    }

    if (error.status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    return error.error?.message || 'Search failed. Please try again.';
  }

  private buildSkyPreviewUrl(ra: number, dec: number): string {
    const params = new URLSearchParams();
    params.set('hips', 'CDS/P/DSS2/color');
    params.set('format', 'jpg');
    params.set('projection', 'TAN');
    params.set('ra', ra.toFixed(6));
    params.set('dec', dec.toFixed(6));
    params.set('fov', ((2 * Math.PI) / 180).toString());
    params.set('width', '512');
    params.set('height', '512');
    return `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?${params.toString()}`;
  }
}

import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import {
  inject,
  makeStateKey,
  PLATFORM_ID,
  TransferState,
} from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, Observable, of, switchMap, tap } from 'rxjs';
import {
  NearbyCatalogLabelModel,
  ViewerApiService,
  ViewerStateModel,
} from './viewer-api.service';
import { ViewerSsrTelemetryService } from './viewer-ssr-telemetry.service';

export interface ViewerBootstrapData {
  state?: ViewerStateModel;
  shortId?: string;
  permalinkPath?: string;
  labels?: NearbyCatalogLabelModel[];
  notFound?: boolean;
}

function decodeState(encoded: string): ViewerStateModel | null {
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    const padded = normalized + (padding === 0 ? '' : '='.repeat(4 - padding));

    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf-8');

    return JSON.parse(json) as ViewerStateModel;
  } catch {
    return null;
  }
}

interface PreloadPlan {
  radius: number;
  limit: number;
}

function preloadPlanForState(state: ViewerStateModel): PreloadPlan {
  const fov = state.fov;
  if (fov <= 0.25) {
    return { radius: 0.03, limit: 36 };
  }
  if (fov <= 0.8) {
    return { radius: 0.05, limit: 28 };
  }
  if (fov <= 2.5) {
    return { radius: 0.09, limit: 20 };
  }
  if (fov <= 8) {
    return { radius: 0.14, limit: 14 };
  }
  if (fov <= 30) {
    return { radius: 0.2, limit: 10 };
  }

  return { radius: 0.24, limit: 6 };
}

function cacheKeyForRoute(
  shortId: string | null,
  encodedState: string | null,
): string {
  if (shortId) {
    return `short:${shortId}`;
  }
  if (encodedState) {
    return `state:${encodedState}`;
  }
  return 'default';
}

function cacheStateKey(
  cacheKey: string,
): ReturnType<typeof makeStateKey<ViewerBootstrapData>> {
  return makeStateKey<ViewerBootstrapData>(`viewer-bootstrap:${cacheKey}`);
}

function withTransferState(
  source$: Observable<ViewerBootstrapData>,
  transferState: TransferState,
  platformId: object,
  key: ReturnType<typeof cacheStateKey>,
  telemetry: ViewerSsrTelemetryService,
): Observable<ViewerBootstrapData> {
  if (isPlatformBrowser(platformId)) {
    const cached = transferState.get<ViewerBootstrapData | null>(key, null);
    if (cached) {
      transferState.remove(key);
      telemetry.recordTransferStateHit();
      return of(cached);
    }

    telemetry.recordTransferStateMiss();
  }

  return source$.pipe(
    tap((payload) => {
      if (isPlatformServer(platformId)) {
        transferState.set(key, payload);
      }
    }),
  );
}

export const viewerBootstrapResolver: ResolveFn<ViewerBootstrapData> = (
  route,
) => {
  const viewerApi = inject(ViewerApiService);
  const transferState = inject(TransferState);
  const platformId = inject(PLATFORM_ID);
  const telemetry = inject(ViewerSsrTelemetryService);

  const shortId = route.paramMap.get('shortId');
  const encoded = route.queryParamMap.get('state');
  const transferKey = cacheStateKey(cacheKeyForRoute(shortId, encoded));

  if (shortId) {
    const resolve$ = viewerApi.resolveState(shortId).pipe(
      switchMap((response) => {
        const plan = preloadPlanForState(response.state);
        return viewerApi
          .getNearbyLabels(
            response.state.ra,
            response.state.dec,
            plan.radius,
            plan.limit,
          )
          .pipe(
            map((labels) => ({
              state: response.state,
              shortId: response.short_id,
              permalinkPath: response.permalink_path,
              labels,
            })),
            catchError(() =>
              of({
                state: response.state,
                shortId: response.short_id,
                permalinkPath: response.permalink_path,
                labels: [],
              }),
            ),
          );
      }),
      catchError(() => of({ notFound: true })),
    );

    return withTransferState(
      resolve$,
      transferState,
      platformId,
      transferKey,
      telemetry,
    );
  }

  if (encoded) {
    const decoded = decodeState(encoded);
    if (decoded) {
      const plan = preloadPlanForState(decoded);
      const resolve$ = viewerApi
        .getNearbyLabels(decoded.ra, decoded.dec, plan.radius, plan.limit)
        .pipe(
          map((labels) => ({ state: decoded, labels })),
          catchError(() => of({ state: decoded, labels: [] })),
        );
      return withTransferState(
        resolve$,
        transferState,
        platformId,
        transferKey,
        telemetry,
      );
    }
  }

  const defaultState: ViewerStateModel = {
    ra: 187.25,
    dec: 2.05,
    fov: 1.5,
    survey: 'VLASS',
    labels: [],
  };

  const plan = preloadPlanForState(defaultState);
  const resolve$ = viewerApi
    .getNearbyLabels(defaultState.ra, defaultState.dec, plan.radius, plan.limit)
    .pipe(
      map((labels) => ({ state: defaultState, labels })),
      catchError(() => of({ state: defaultState, labels: [] })),
    );
  return withTransferState(
    resolve$,
    transferState,
    platformId,
    transferKey,
    telemetry,
  );
};

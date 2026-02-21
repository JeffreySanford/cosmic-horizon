import {
  APP_INITIALIZER,
  isDevMode,
  NgModule,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  BrowserModule,
  provideClientHydration,
} from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withFetch,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { RouterModule, provideRouter } from '@angular/router';
import { App } from './app';
import { appRoutes } from './app.routes';
import { MaterialModule } from './shared/material/material.module';
import { AuthTokenInterceptor } from './interceptors/auth-token.interceptor';
import { HttpLoggerInterceptor } from './interceptors/http-logger.interceptor';
import { MockApiInterceptor } from './shared/interceptors/mock-api.interceptor';
import { FooterComponent } from './shared/layout/footer/footer.component';
import { AppHeaderComponent } from './shared/layout/app-header/app-header.component';
import { AppStartupWarmupService } from './services/app-startup-warmup.service';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { appReducers } from './store/app.reducer';
import { AppEffects } from './store/app.effects';
import { UiEffects } from './store/features/ui/ui.effects';
import { AuthEffects } from './store/features/auth/auth.effects';
import { JobsEffects } from './store/features/jobs/jobs.effects';
import { AlertsEffects } from './store/features/alerts/alerts.effects';
import { TelemetryEffects } from './store/features/telemetry/telemetry.effects';

function startupWarmupFactory(
  warmupService: AppStartupWarmupService,
): () => void {
  return () => warmupService.warmUp();
}

@NgModule({
  declarations: [App, FooterComponent, AppHeaderComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule,
    MaterialModule,
    StoreModule.forRoot(appReducers, {
      runtimeChecks: {
        strictStateImmutability: true,
        strictActionImmutability: true,
        strictStateSerializability: true,
        strictActionSerializability: true,
      },
    }),
    EffectsModule.forRoot([
      AppEffects,
      UiEffects,
      AuthEffects,
      JobsEffects,
      AlertsEffects,
      TelemetryEffects,
    ]),
    StoreRouterConnectingModule.forRoot(),
    StoreDevtoolsModule.instrument({
      maxAge: 50,
      logOnly: !isDevMode(),
    }),
  ],
  providers: [
    provideRouter(appRoutes),
    provideBrowserGlobalErrorListeners(),
    provideClientHydration(),
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthTokenInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpLoggerInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MockApiInterceptor,
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: startupWarmupFactory,
      deps: [AppStartupWarmupService],
      multi: true,
    },
  ],
  bootstrap: [App],
})
export class AppModule {}

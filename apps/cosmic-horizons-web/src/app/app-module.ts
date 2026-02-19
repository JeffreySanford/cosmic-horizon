import {
  APP_INITIALIZER,
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
import { AppStartupWarmupService } from './services/app-startup-warmup.service';

function startupWarmupFactory(
  warmupService: AppStartupWarmupService,
): () => void {
  return () => warmupService.warmUp();
}

@NgModule({
  declarations: [App, FooterComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule,
    MaterialModule,
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

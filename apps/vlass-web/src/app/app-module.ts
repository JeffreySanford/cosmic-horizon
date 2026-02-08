import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  BrowserModule,
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { App } from './app';
import { appRoutes } from './app.routes';
import { MaterialModule } from './shared/material/material.module';
import { AuthTokenInterceptor } from './interceptors/auth-token.interceptor';
import { HttpLoggerInterceptor } from './interceptors/http-logger.interceptor';

@NgModule({
  declarations: [App],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(appRoutes),
    MaterialModule,
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideClientHydration(withEventReplay()),
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
  ],
  bootstrap: [App],
})
export class AppModule {}

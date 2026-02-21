import { NgModule } from '@angular/core';
import { provideServerRendering } from '@angular/ssr';
import { App } from './app';
import { AppModule } from './app-module';

@NgModule({
  imports: [AppModule],
  providers: [provideServerRendering()],
  bootstrap: [App],
})
export class AppServerModule {}

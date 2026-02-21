import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

// A small global module exposing the request context helper.  By marking
// it @Global we allow any other feature module (ephemeris, viewer, etc.) to
// inject RequestContextService without having to import the module
// explicitly in their own @Module declaration.
@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class ContextModule {}

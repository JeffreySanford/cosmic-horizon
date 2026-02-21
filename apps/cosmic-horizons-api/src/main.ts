/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { createSessionMiddleware } from './app/config/session.config';
import * as passportImport from 'passport';
import helmet from 'helmet';
import { loadEnvFromFirstAvailable } from './app/config/env-loader';
import { MessagingSocketIoAdapter } from './app/messaging/messaging-socket.adapter';

loadEnvFromFirstAvailable();

const passport =
  (passportImport as unknown as { default?: typeof passportImport }).default ??
  passportImport;

async function bootstrap() {
  try {
    // Ensure OAuth env vars are set (required for strategy initialization even if not used)
    if (!process.env['GITHUB_CLIENT_ID']) {
      process.env['GITHUB_CLIENT_ID'] = 'placeholder-for-openapi-generation';
    }
    if (!process.env['GITHUB_CLIENT_SECRET']) {
      process.env['GITHUB_CLIENT_SECRET'] =
        'placeholder-for-openapi-generation';
    }

    const app = await NestFactory.create(AppModule);
    app.useWebSocketAdapter(new MessagingSocketIoAdapter(app));
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);
    const openApiConfig = new DocumentBuilder()
      .setTitle('Cosmic Horizon API')
      .setDescription(
        'Independent radio astronomy browsing and community API, supporting ngVLA workflows and CosmicAI docking (not affiliated with VLA/NRAO).',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
    if (process.env['GENERATE_OPENAPI_SPEC'] === 'true') {
      const outputPath = resolve(
        process.cwd(),
        'documentation',
        'reference',
        'api',
        'openapi.json',
      );
      mkdirSync(resolve(process.cwd(), 'documentation', 'reference', 'api'), {
        recursive: true,
      });
      writeFileSync(
        outputPath,
        JSON.stringify(openApiDocument, null, 2),
        'utf8',
      );
      await app.close();
      Logger.log(`OpenAPI spec generated at ${outputPath}`);
      return;
    }
    SwaggerModule.setup(`${globalPrefix}/docs`, app, openApiDocument);
    app
      .getHttpAdapter()
      .get(
        `/${globalPrefix}/openapi.json`,
        (_req: unknown, res: { json: (body: unknown) => void }) => {
          res.json(openApiDocument);
        },
      );
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );

    // global validation pipe ensures DTOs are strictly checked
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    // Setup CORS to allow credentials
    const corsOrigin = process.env['FRONTEND_URL'] || 'http://localhost:4200';
    app.enableCors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    });

    // Setup session middleware (may use Redis store depending on environment)
    app.use(createSessionMiddleware());

    // Initialize Passport after session
    app.use(passport.initialize());
    app.use(passport.session());
    attachCsrfMiddleware(app, globalPrefix);

    const port = process.env['API_PORT'] || '3000';
    await app.listen(port);
    Logger.log(
      `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
    );
    Logger.log(`📦 Database: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    Logger.log(`🔒 CORS enabled for: ${corsOrigin}`);
  } catch (error) {
    Logger.error(
      'Failed to start application',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

bootstrap();

function attachCsrfMiddleware(
  app: {
    use: (
      callback: (req: CsrfRequest, res: CsrfResponse, next: () => void) => void,
    ) => void;
  },
  globalPrefix: string,
): void {
  const csrfEnabled = process.env['ENABLE_CSRF_PROTECTION'] === 'true';
  if (!csrfEnabled) {
    return;
  }

  const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  const csrfTokenPath = `/${globalPrefix}/auth/csrf-token`;

  app.use((req, res, next) => {
    if (!unsafeMethods.has(req.method)) {
      next();
      return;
    }

    if (req.path === csrfTokenPath) {
      next();
      return;
    }

    if (!req.headers.cookie?.includes('connect.sid=')) {
      next();
      return;
    }

    const expectedToken = req.session?.csrfToken;
    const providedHeader = req.headers['x-csrf-token'];
    const providedToken =
      typeof providedHeader === 'string' ? providedHeader : providedHeader?.[0];

    if (!expectedToken || expectedToken !== providedToken) {
      res.status(403).json({
        message: 'Invalid CSRF token',
      });
      return;
    }

    next();
  });
}

type CsrfRequest = {
  method: string;
  path: string;
  headers: {
    cookie?: string;
    'x-csrf-token'?: string | string[];
  };
  session?: {
    csrfToken?: string;
  };
};

type CsrfResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

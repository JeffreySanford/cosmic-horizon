/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import session from 'express-session';
import * as passportImport from 'passport';
import helmet from 'helmet';
import { getSessionSecret } from './app/config/security.config';

const envCandidates = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env.local'),
  resolve(process.cwd(), '../../.env'),
];
const envPath = envCandidates.find((path) => existsSync(path));

if (envPath) {
  const envFile = readFileSync(envPath, 'utf8');
  for (const rawLine of envFile.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

const passport =
  (passportImport as unknown as { default?: typeof passportImport }).default ??
  passportImport;

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);
    const openApiConfig = new DocumentBuilder()
      .setTitle('VLASS Portal API')
      .setDescription('VLASS browsing and community portal API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
    if (process.env['GENERATE_OPENAPI_SPEC'] === 'true') {
      const outputPath = resolve(process.cwd(), 'documentation', 'api', 'openapi.json');
      mkdirSync(resolve(process.cwd(), 'documentation', 'api'), { recursive: true });
      writeFileSync(outputPath, JSON.stringify(openApiDocument, null, 2), 'utf8');
      await app.close();
      Logger.log(`OpenAPI spec generated at ${outputPath}`);
      return;
    }
    SwaggerModule.setup(`${globalPrefix}/docs`, app, openApiDocument);
    app.getHttpAdapter().get(`/${globalPrefix}/openapi.json`, (_req: unknown, res: { json: (body: unknown) => void }) => {
      res.json(openApiDocument);
    });
    const snapshotDir = resolveApiRootDir('storage', 'snapshots');
    app.use(`/${globalPrefix}/view/snapshots`, express.static(snapshotDir));
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
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

    // Setup session middleware with memory store
    // In production, use connect-redis or similar
    const sessionSecret = getSessionSecret();
    app.use(
      session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env['NODE_ENV'] === 'production', // Require HTTPS in production
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          sameSite: 'lax',
        },
      }),
    );

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
    Logger.error('Failed to start application', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function resolveApiRootDir(...segments: string[]): string {
  const normalizedCwd = process.cwd().replace(/\\/g, '/');
  const basePath = normalizedCwd.endsWith('/apps/vlass-api') ? process.cwd() : resolve(process.cwd(), 'apps', 'vlass-api');
  return resolve(basePath, ...segments);
}

bootstrap();

function attachCsrfMiddleware(
  app: {
    use: (
      callback: (
        req: CsrfRequest,
        res: CsrfResponse,
        next: () => void,
      ) => void,
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

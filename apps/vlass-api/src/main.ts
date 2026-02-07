/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { AppModule } from './app/app.module';
import session from 'express-session';
import * as passportImport from 'passport';

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
    const snapshotDir = resolve(process.cwd(), 'apps', 'vlass-api', 'storage', 'snapshots');
    app.use(`/${globalPrefix}/view/snapshots`, express.static(snapshotDir));

    // Setup CORS to allow credentials
    const corsOrigin = process.env['FRONTEND_URL'] || 'http://localhost:4200';
    app.enableCors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Setup session middleware with memory store
    // In production, use connect-redis or similar
    const sessionSecret = process.env['SESSION_SECRET'] || 'your-secret-key';
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

    const port = process.env['API_PORT'] || process.env.PORT || '3001';
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

bootstrap();

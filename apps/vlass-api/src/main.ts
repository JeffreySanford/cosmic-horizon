/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);
    const port = process.env.PORT || 3000;
    await app.listen(port);
    Logger.log(
      `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
    );
    Logger.log(`📦 Database: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  } catch (error) {
    Logger.error('Failed to start application', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

bootstrap();

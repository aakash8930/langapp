import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { enableApiVersioning } from './common/versioning';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Every route answers at both its bare path and under `/v1` (ADR-007). Must
  // run before `listen`; see `common/versioning.ts` for why the bare path stays
  // and what a v2 may and may not do.
  enableApiVersioning(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);

  /**
   * CORS MUST be enabled BEFORE versioning. URI versioning processes every
   * request including OPTIONS preflights — if versioning runs first, it rejects
   * the browser's preflight before CORS can add the headers that make it valid.
   */
  const origins = config
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length > 0) {
    app.enableCors({
      origin: origins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: false,
    });
    new Logger('Bootstrap').log(`CORS enabled for: ${origins.join(', ')}`);
  }

  // Versioning comes after CORS so preflights bypass the version matcher.
  enableApiVersioning(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Lets OnModuleDestroy hooks (Redis quit, Mongo close) run on SIGINT/SIGTERM.
  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  new Logger('Bootstrap').log(`API listening on http://localhost:${port}`);
}

void bootstrap();

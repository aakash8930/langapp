import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Lets OnModuleDestroy hooks (Redis quit, Mongo close) run on SIGINT/SIGTERM.
  app.enableShutdownHooks();

  const port = app.get(ConfigService).get<number>('PORT', 3000);
  await app.listen(port);

  new Logger('Bootstrap').log(`API listening on http://localhost:${port}`);
}

void bootstrap();

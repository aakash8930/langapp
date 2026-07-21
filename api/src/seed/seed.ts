import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { validateEnv } from '../config/env.validation';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';

/**
 * A cut-down root module: Mongo and the two content modules, nothing else.
 * The seed has no reason to open Redis, bind a port, or boot the HTTP layer.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
        serverSelectionTimeoutMS: 3000,
      }),
    }),
    // Not because the seed authenticates anything — it doesn't. ContentModule
    // declares JwtAuthGuard on its controllers, so Nest must be able to resolve
    // JwtService to instantiate that module at all. AppModule registers this
    // globally and the seed inherited the assumption without the registration,
    // which is why `npm run seed` could not boot (OPEN-ITEMS #20).
    JwtModule.register({ global: true }),
    SeedModule,
  ],
})
class SeedRootModule {}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Seed');
  // No HTTP server — createApplicationContext gives DI without a listener.
  const app = await NestFactory.createApplicationContext(SeedRootModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const summary = await app.get(SeedService).run();
    logger.log(`Done: ${JSON.stringify(summary)}`);
    await app.close();
    process.exit(0);
  } catch (err) {
    logger.error(`Seed failed: ${err instanceof Error ? err.message : String(err)}`);
    await app.close();
    process.exit(1);
  }
}

void bootstrap();

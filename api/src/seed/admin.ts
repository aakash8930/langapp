import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { Model } from 'mongoose';

import { validateEnv } from '../config/env.validation';
import { User, UserDocument, UserSchema } from '../user/schemas/user.schema';

/**
 * One-time administrator bootstrap.
 *
 * Credentials are deliberately supplied through environment variables rather
 * than a committed/default password. Re-running this command is idempotent: it
 * promotes an existing account or creates one, without rotating its password.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ uri: config.getOrThrow<string>('MONGO_URI'), serverSelectionTimeoutMS: 3_000 }),
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
})
class AdminSeedModule {}

async function bootstrap(): Promise<void> {
  const logger = new Logger('AdminSeed');
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || 'GENKŌ Administrator';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set before running the admin seed.');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  }

  const app = await NestFactory.createApplicationContext(AdminSeedModule, { logger: ['log', 'warn', 'error'] });
  try {
    const users = app.get<Model<UserDocument>>(getModelToken(User.name));
    const existing = await users.findOne({ email }).exec();
    if (existing) {
      await users.updateOne({ _id: existing._id }, { $set: { isAdmin: true, suspended: false } }).exec();
      logger.log(`Promoted existing user ${email} to administrator.`);
    } else {
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      await users.create({
        email,
        passwordHash,
        emailVerified: true,
        isAdmin: true,
        profile: { displayName, nativeLanguage: 'en', activeTrack: 'ja' },
      });
      logger.log(`Created administrator ${email}. Change the bootstrap password after first sign-in.`);
    }
  } finally {
    await app.close();
  }
}

void bootstrap().catch((error: unknown) => {
  // No credentials are included in errors or logs.
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

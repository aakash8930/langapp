import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetStore } from './password-reset.store';
import { RefreshTokenStore } from './refresh-token.store';

/**
 * Depends on UserModule's exported service — never on its collection.
 * That's what keeps Auth extractable later (§4).
 */
@Module({
  imports: [UserModule, MailModule],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenStore, PasswordResetStore],
  exports: [AuthService],
})
export class AuthModule {}

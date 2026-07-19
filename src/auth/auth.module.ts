import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenStore } from './refresh-token.store';

/**
 * Depends on UserModule's exported service — never on its collection.
 * That's what keeps Auth extractable later (§4).
 */
@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenStore],
  exports: [AuthService],
})
export class AuthModule {}

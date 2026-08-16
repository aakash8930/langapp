import { Global, Module } from '@nestjs/common';
import { UserModule } from '../../user/user.module';
import { AccountStateGuard } from './account-state.guard';

/** Global guard provider; feature modules still opt in explicitly on routes. */
@Global()
@Module({
  imports: [UserModule],
  providers: [AccountStateGuard],
  exports: [AccountStateGuard],
})
export class AccountStateModule {}

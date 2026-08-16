import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserService } from '../../user/user.service';
import { RequestWithUser } from './jwt-auth.guard';

export type RequiredAccountState = 'authenticated' | 'verified' | 'onboarded';
const REQUIRED_ACCOUNT_STATE = 'requiredAccountState';

/** Override the default `onboarded` requirement on recovery/setup endpoints. */
export const RequireAccountState = (state: RequiredAccountState) =>
  SetMetadata(REQUIRED_ACCOUNT_STATE, state);

@Injectable()
export class AccountStateGuard implements CanActivate {
  constructor(
    private readonly users: UserService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const current = request.user;
    if (!current) throw new UnauthorizedException('Route is missing JwtAuthGuard');

    const required = this.reflector.getAllAndOverride<RequiredAccountState>(
      REQUIRED_ACCOUNT_STATE,
      [context.getHandler(), context.getClass()],
    ) ?? 'onboarded';

    if (required === 'authenticated') return true;

    // State is monotonic. A true signed claim is enough; old tokens and tokens
    // issued just before a transition fall back to Mongo until the next refresh.
    if (current.emailVerified && (required === 'verified' || current.onboardingComplete)) {
      return true;
    }

    const user = await this.users.findById(current.userId);
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (!user.emailVerified) {
      throw new ForbiddenException({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Verify your email to continue.',
      });
    }
    if (required === 'verified') return true;
    if (!user.onboardingState?.onboardingComplete) {
      throw new ForbiddenException({
        code: 'ONBOARDING_REQUIRED',
        message: 'Complete account setup to continue.',
      });
    }
    return true;
  }
}

import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser, RequestWithUser } from './jwt-auth.guard';

/** Reads what JwtAuthGuard attached. Only valid on routes behind that guard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new UnauthorizedException('Route is missing JwtAuthGuard');
    }
    return request.user;
  },
);

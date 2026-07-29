import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { RequestWithUser } from './jwt-auth.guard';

@Injectable()
export class CreatorGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) return false;
    
    if (!request.user.isAdmin) {
      throw new ForbiddenException('You do not have creator privileges.');
    }
    
    return true;
  }
}

import { Body, Controller, Get, NotFoundException, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { toUserResponse, UserResponse } from './dto/user-response.dto';
import { UserService } from './user.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async me(@CurrentUser() current: AuthenticatedUser): Promise<UserResponse> {
    const user = await this.userService.findById(current.userId);
    if (!user) {
      // Token is valid but the account is gone — treat it as not found.
      throw new NotFoundException('User not found');
    }
    return toUserResponse(user);
  }

  @Patch('settings')
  async updateSettings(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<UserResponse> {
    const user = await this.userService.updateSettings(current.userId, dto);
    return toUserResponse(user);
  }
}

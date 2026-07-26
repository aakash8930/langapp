import { Body, Controller, Get, NotFoundException, Patch, Post, UseGuards } from '@nestjs/common';
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

  /**
   * Spend gems to refill hearts to full — the only gem sink, and the only way out
   * of an empty heart bar besides waiting.
   *
   * 409 when already full or short on gems: both are "your state does not allow
   * this" rather than a malformed request. Returns the two counters so the client
   * does not need to re-fetch progress to update the header.
   */
  @Post('hearts/refill')
  async refillHearts(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ hearts: number; gems: number }> {
    return this.userService.refillHearts(current.userId);
  }
}

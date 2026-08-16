import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AccountStateGuard, RequireAccountState } from '../common/auth/account-state.guard';
import { OnboardingDto } from './dto/onboarding.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { toUserResponse, UserResponse } from './dto/user-response.dto';
import { UserService } from './user.service';
import { StorageService } from '../common/storage/storage.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Controller('me')
@UseGuards(JwtAuthGuard, AccountStateGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly storage: StorageService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  @Get()
  @RequireAccountState('authenticated')
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

  @Patch('onboarding')
  @RequireAccountState('verified')
  async updateOnboarding(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: OnboardingDto,
  ): Promise<UserResponse> {
    const user = await this.userService.updateOnboarding(current.userId, dto);
    return toUserResponse(user);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponse> {
    const user = await this.userService.updateProfile(current.userId, dto);
    return toUserResponse(user);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', {
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only PNG and JPEG images are allowed'), false);
      }
    },
  }))
  async uploadAvatar(
    @CurrentUser() current: AuthenticatedUser,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ): Promise<UserResponse> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const key = `avatars/${current.userId}`;
    await this.storage.put(key, file.buffer);

    await this.userModel.updateOne(
      { _id: current.userId },
      { $set: { avatarUrl: key } },
    ).exec();

    const user = await this.userService.findById(current.userId);
    if (!user) throw new NotFoundException('User not found');
    return toUserResponse(user);
  }

  @Patch('settings/notifications')
  async updateNotificationSettings(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<UserResponse> {
    const user = await this.userService.updateNotificationSettings(current.userId, dto);
    return toUserResponse(user);
  }

  @Post('export')
  async exportData(@CurrentUser() current: AuthenticatedUser) {
    const data = await this.userService.exportUserData(current.userId);
    return data;
  }
}

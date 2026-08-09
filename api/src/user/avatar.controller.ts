import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response } from 'express';
import { StorageService } from '../common/storage/storage.service';
import { User, UserDocument } from '../user/schemas/user.schema';

@Controller('avatars')
export class AvatarController {
  constructor(
    private readonly storage: StorageService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  @Get(':userId')
  async getAvatar(@Param('userId') userId: string, @Res() res: Response) {
    const user = await this.userModel.findById(userId).exec();
    if (!user || !user.avatarUrl) {
      throw new NotFoundException('Avatar not found');
    }

    const buffer = await this.storage.get(user.avatarUrl);
    const contentType = user.avatarUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}

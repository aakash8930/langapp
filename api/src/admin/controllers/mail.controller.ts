import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { MailService } from '../../mail/mail.service';
import { AdminGuard } from '../admin.guard';

/** Manually exercises the exact queue, worker, and provider path production mail uses. */
@Controller('admin/mail')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminMailController {
  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  @Post('smoke')
  @HttpCode(HttpStatus.ACCEPTED)
  async smoke(): Promise<{ status: 'queued'; deliveryId: string }> {
    const to = this.config.get<string>('MAIL_SMOKE_TO')?.trim();
    if (!to) {
      throw new ServiceUnavailableException('MAIL_SMOKE_TO is not configured');
    }

    const result = await this.mail.enqueue(
      to,
      'GENKŌ production mail smoke test',
      '<p>This message confirms that the GENKŌ API, Redis queue, worker, and configured mail provider accepted a production-like delivery.</p>',
      'smoke',
    );
    if (result.status !== 'queued') {
      throw new ServiceUnavailableException(result.error || 'Mail smoke test could not be queued');
    }
    return { status: 'queued', deliveryId: result.deliveryId };
  }
}

import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { ContactService, ContactReceipt } from './contact.service';
import { ContactDto } from './dto/contact.dto';

/** Public support intake. Rate-limited by the same conservative IP budget as auth. */
@Controller('contact')
@UseGuards(ThrottlerGuard)
@SkipThrottle({ chat: true })
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  submit(@Body() input: ContactDto): Promise<ContactReceipt> {
    return this.contact.submit(input);
  }
}

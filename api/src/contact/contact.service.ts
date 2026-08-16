import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { ContactDto } from './dto/contact.dto';

export interface ContactReceipt {
  status: 'queued';
  deliveryId: string;
}

@Injectable()
export class ContactService {
  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async submit(input: ContactDto): Promise<ContactReceipt> {
    // A browser never exposes this field. Never return a queued receipt when no
    // queue write happened: even bot filtering must preserve the delivery contract.
    if (input.website?.trim()) {
      throw new BadRequestException('The request could not be submitted.');
    }

    const destination = this.config.get<string>('CONTACT_TO')?.trim();
    if (!destination) {
      throw new ServiceUnavailableException('Contact delivery is not configured.');
    }

    const name = escapeHtml(input.name.trim());
    const replyTo = escapeHtml(input.email.trim().toLowerCase());
    const message = escapeHtml(input.message.trim()).replace(/\n/g, '<br>');
    const result = await this.mail.enqueue(
      destination,
      `GENKŌ support request from ${name}`,
      `<p><strong>Reply address:</strong> ${replyTo}</p><p><strong>Name:</strong> ${name}</p><p>${message}</p>`,
      'contact',
    );

    if (result.status !== 'queued') {
      throw new ServiceUnavailableException(
        'Your message could not be queued. Please try again shortly.',
      );
    }

    return { status: 'queued', deliveryId: result.deliveryId };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}

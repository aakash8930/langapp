import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsService } from '../jobs/jobs.service';
import { JOB_MAIL_SEND } from '../jobs/queues';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly jobs: JobsService,
  ) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY') ?? '';
    this.enabled = !!this.apiKey;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(`Email not sent (RESEND_API_KEY not configured): ${subject} to ${to}`);
      return;
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'GENKŌ <noreply@genko.app>',
          to,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Resend API returned ${response.status}: ${body}`);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to send email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  enqueue(to: string, subject: string, html: string): void {
    this.jobs.enqueue(JOB_MAIL_SEND, { to, subject, html }).catch(() => {});
  }
}

import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { JobsService, type QueueSnapshot } from '../jobs/jobs.service';
import { JOB_MAIL_SEND, QUEUE_MAIL, type MailKind } from '../jobs/queues';

export interface MailEnqueueResult {
  status: 'queued' | 'unavailable';
  deliveryId: string;
  error?: string;
}

export interface MailHealth {
  status: 'up' | 'down';
  configured: boolean;
  queue: QueueSnapshot;
  error?: string;
}

/**
 * Which real transport `send()` uses. Resend wins when both are configured;
 * SMTP is the explicit development fallback for testing recipients.
 */
type MailTransport = 'resend' | 'smtp' | 'none';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly from: string;
  private readonly smtpTransporter: Transporter | null;
  private readonly transport: MailTransport;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly jobs: JobsService,
  ) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY') ?? '';

    // SMTP_USER/SMTP_PASS is the dev-only path: a Gmail address plus an App
    // Password (myaccount.google.com/apppasswords, needs 2-Step Verification
    // on). No domain to verify and no recipient restriction, unlike Resend's
    // sandbox sender — the trade is Gmail's own ~500/day cap and that it can
    // flag automated sending. Host/port default to Gmail's STARTTLS endpoint
    // so only the two secrets need setting.
    const smtpUser = this.config.get<string>('SMTP_USER') ?? '';
    const smtpPass = this.config.get<string>('SMTP_PASS') ?? '';
    this.smtpTransporter = smtpUser && smtpPass
      ? createTransport({
          host: this.config.get<string>('SMTP_HOST') ?? 'smtp.gmail.com',
          port: this.config.get<number>('SMTP_PORT') ?? 587,
          secure: false, // STARTTLS on 587, not implicit TLS
          auth: { user: smtpUser, pass: smtpPass },
        })
      : null;

    this.transport = this.apiKey ? 'resend' : this.smtpTransporter ? 'smtp' : 'none';
    this.enabled = this.transport !== 'none';

    // Gmail's relay rejects (or silently rewrites) a From address that isn't
    // the authenticated account or a verified alias, so the genko.app default
    // — meant for Resend, which allows any From on a verified domain — would
    // break every send over SMTP. Only fall back to it for Resend.
    const configuredFrom = this.config.get<string>('MAIL_FROM');
    this.from = configuredFrom
      ?? (this.transport === 'smtp' ? `GENKŌ <${smtpUser}>` : 'GENKŌ <noreply@genko.app>');
  }

  /** Called by the worker. A failure must throw so BullMQ retries and retains it. */
  async send(to: string, subject: string, html: string): Promise<string | null> {
    if (this.transport === 'smtp') {
      if (!this.smtpTransporter) throw new Error('SMTP transporter not initialised');
      const info = await this.smtpTransporter.sendMail({ from: this.from, to, subject, html });
      return info.messageId ?? null;
    }

    if (this.transport === 'none') {
      throw new Error('No mail transport is configured (RESEND_API_KEY or SMTP_USER/SMTP_PASS)');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      // Provider bodies can echo a rejected recipient. Keep worker logs free of
      // addresses while retaining the status needed to diagnose/retry.
      throw new Error(`Resend API returned ${response.status}`);
    }

    const body = (await response.json().catch(() => null)) as { id?: string } | null;
    return body?.id ?? null;
  }

  /**
   * Queue a message and return whether Redis accepted it. Authentication flows
   * await this result so they never claim an email was queued when it was not.
   */
  async enqueue(
    to: string,
    subject: string,
    html: string,
    kind: MailKind = 'transactional',
  ): Promise<MailEnqueueResult> {
    const deliveryId = randomUUID();
    if (!this.enabled) {
      const error = 'Mail transport is not configured';
      this.logger.error(`Email enqueue unavailable delivery=${deliveryId} kind=${kind}: ${error}`);
      return { status: 'unavailable', deliveryId, error };
    }

    const result = await this.jobs.enqueue(
      JOB_MAIL_SEND,
      { deliveryId, kind, to, subject, html },
      { jobId: deliveryId },
    );

    if (!result.accepted) {
      this.logger.error(
        `Email enqueue failed delivery=${deliveryId} kind=${kind}: ${result.error ?? 'unknown error'}`,
      );
      return { status: 'unavailable', deliveryId, error: result.error };
    }

    this.logger.log(`Email queued delivery=${deliveryId} kind=${kind}`);
    return { status: 'queued', deliveryId };
  }

  async health(): Promise<MailHealth> {
    const queue = await this.jobs.inspectQueue(QUEUE_MAIL);
    if (!this.enabled) {
      return {
        status: 'down',
        configured: false,
        queue,
        error: 'No mail transport is configured (RESEND_API_KEY or SMTP_USER/SMTP_PASS)',
      };
    }
    const hasTerminalFailures = queue.status === 'up' && queue.failed > 0;
    return {
      status: queue.status === 'up' && !hasTerminalFailures ? 'up' : 'down',
      configured: true,
      queue,
      ...(queue.error
        ? { error: queue.error }
        : hasTerminalFailures
          ? { error: `${queue.failed} retained mail job(s) failed after all retries` }
          : {}),
    };
  }
}

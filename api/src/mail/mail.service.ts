import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly jobs: JobsService,
  ) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY') ?? '';
    this.from = this.config.get<string>('MAIL_FROM') ?? 'GENKŌ <noreply@genko.app>';
    this.enabled = !!this.apiKey;
  }

  /** Called by the worker. A failure must throw so BullMQ retries and retains it. */
  async send(to: string, subject: string, html: string): Promise<string | null> {
    if (!this.enabled) {
      throw new Error('RESEND_API_KEY is not configured');
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
        error: 'RESEND_API_KEY is not configured',
      };
    }
    return {
      status: queue.status,
      configured: true,
      queue,
      ...(queue.error ? { error: queue.error } : {}),
    };
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOB_MAIL_SEND, MailSendPayload, QUEUE_MAIL } from '../jobs/queues';
import { MailService } from './mail.service';

@Processor(QUEUE_MAIL)
@Injectable()
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<MailSendPayload>): Promise<void> {
    if (job.name !== JOB_MAIL_SEND) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    const prefix = `delivery=${job.data.deliveryId} kind=${job.data.kind} attempt=${attempt}/${maxAttempts}`;
    this.logger.log(`Email sending ${prefix}`);

    try {
      const providerId = await this.mailService.send(job.data.to, job.data.subject, job.data.html);
      this.logger.log(
        `Email provider accepted ${prefix}${providerId ? ` provider=${providerId}` : ''}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const lifecycle = attempt >= maxAttempts
        ? 'Email terminal failure'
        : 'Email attempt failed; retry pending';
      this.logger.error(`${lifecycle} ${prefix}: ${message}`);
      // Never swallow this: BullMQ needs the rejection to apply backoff/retries
      // and retain the final failure for queue telemetry.
      throw err;
    }
  }
}

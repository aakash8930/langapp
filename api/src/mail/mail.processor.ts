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

    try {
      await this.mailService.send(job.data.to, job.data.subject, job.data.html);
    } catch (err) {
      this.logger.warn(
        `Mail job failed for ${job.data.to}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

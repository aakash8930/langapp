import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { JOB_CHECK_REMINDERS } from '../jobs/queues';

@Injectable()
export class ReminderScheduler implements OnApplicationBootstrap {
  private static readonly SCHEDULER_ID = 'reminders-hourly';
  private static readonly PATTERN = '0 * * * *';

  constructor(private readonly jobs: JobsService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.jobs.schedule(
      ReminderScheduler.SCHEDULER_ID,
      JOB_CHECK_REMINDERS,
      ReminderScheduler.PATTERN,
      {},
    );
  }
}

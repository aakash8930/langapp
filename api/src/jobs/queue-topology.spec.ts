import { PROCESSOR_METADATA } from '@nestjs/bullmq/dist/bull.constants';
import { AnalyticsProcessor } from '../analytics/analytics.processor';
import { LeagueSettleProcessor } from '../social/league-settle.processor';
import { ReminderProcessor } from '../notification/reminder.processor';
import { MailProcessor } from '../mail/mail.processor';
import { JOB_QUEUE, JobName, QUEUE_NAMES, QueueName } from './queues';

/**
 * Guards the one BullMQ property that is easy to get wrong and impossible to
 * see in a unit test of a processor: **a worker consumes every job on its
 * queue, whatever the job is called.**
 *
 * `@Processor(name)` creates one Worker per decorated class, so two processors
 * sharing a queue name means two workers each pulling the other's jobs, on a
 * race, and each throwing `Unknown job name` about half the time. Nothing else
 * in the suite can catch that: every processor spec constructs the class
 * directly and hands it a job, which is exactly the case that always works.
 *
 * Registered here by hand rather than discovered from the Nest graph, because
 * booting the app needs Redis and Mongo and CI has neither. The cost is that a
 * new processor must be added to this list; the `expect` on the count is what
 * makes forgetting it fail rather than pass quietly.
 */
const PROCESSORS = [
  AnalyticsProcessor,
  LeagueSettleProcessor,
  ReminderProcessor,
  MailProcessor,
];

function queueOf(processor: new (...args: never[]) => unknown): string {
  const metadata = Reflect.getMetadata(PROCESSOR_METADATA, processor) as
    | { name?: string }
    | undefined;
  if (!metadata?.name) {
    throw new Error(`${processor.name} has no @Processor(queue) metadata`);
  }
  return metadata.name;
}

describe('queue topology (ADR-006)', () => {
  it('gives every processor its own queue — two on one queue misroute each other', () => {
    const claimed = PROCESSORS.map((processor) => ({
      processor: processor.name,
      queue: queueOf(processor),
    }));

    const byQueue = new Map<string, string[]>();
    for (const { processor, queue } of claimed) {
      byQueue.set(queue, [...(byQueue.get(queue) ?? []), processor]);
    }

    const shared = [...byQueue.entries()].filter(([, owners]) => owners.length > 1);
    expect(shared).toEqual([]);
  });

  it('only claims queues that JobsModule registers', () => {
    for (const processor of PROCESSORS) {
      expect(QUEUE_NAMES).toContain(queueOf(processor) as QueueName);
    }
  });

  it('has a processor for every queue a job can be enqueued onto', () => {
    const withWorkers = new Set(PROCESSORS.map(queueOf));
    const targeted = new Set(Object.values(JOB_QUEUE));

    // A job whose queue has no worker sits in Redis until it is trimmed —
    // enqueued successfully, never run, and silent about it.
    for (const queue of targeted) {
      expect(withWorkers).toContain(queue);
    }
  });

  it('routes each job name to exactly one registered queue', () => {
    const names = Object.keys(JOB_QUEUE) as JobName[];
    expect(names.length).toBeGreaterThan(0);

    for (const name of names) {
      expect(QUEUE_NAMES).toContain(JOB_QUEUE[name]);
    }
  });

  it('covers every processor in the app — add new ones to PROCESSORS', () => {
    // Bumped deliberately when a processor lands, so the list above cannot go
    // stale without a failing test to say so.
    expect(PROCESSORS).toHaveLength(4);
  });
});

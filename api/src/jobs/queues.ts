/**
 * The job registry (ADR-006): every queue, every job name, the payload each
 * job carries, and which queue it rides on.
 *
 * One file, for one reason: **a BullMQ worker consumes every job on its queue,
 * whatever the job is called.** Job names do not route. So the mapping from job
 * to queue is a real invariant — get it wrong and jobs land in a worker that
 * does not handle them — and it belongs somewhere a reader can check at a
 * glance rather than spread across module metadata. `queue-topology.spec.ts`
 * asserts the processors agree with this file.
 *
 * Adding a job means: a name here, a payload type here, an entry in `JOB_QUEUE`,
 * and a `@Processor` for that queue in the module that owns the data it writes.
 * If the new job wants its own retry policy or concurrency, it wants its own
 * queue too.
 */

export const QUEUE_ANALYTICS = 'analytics';
export const QUEUE_LEAGUE = 'league';
export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_MAIL = 'mail';

export const QUEUE_NAMES = [QUEUE_ANALYTICS, QUEUE_LEAGUE, QUEUE_NOTIFICATIONS, QUEUE_MAIL] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

export const JOB_ANALYTICS_RECORD = 'analytics.record';
export const JOB_LEAGUE_SETTLE = 'league.settle';
export const JOB_CHECK_REMINDERS = 'notifications.check-reminders';
export const JOB_MAIL_SEND = 'mail.send';

export interface AnalyticsRecordPayload {
  userId: string;
  type: string;
  payload?: Record<string, unknown>;
}

export interface LeagueSettlePayload {
  /**
   * ISO instant to settle as of. **Optional**, and absent is the normal case
   * for the scheduled run: a repeatable job's template data is frozen when the
   * schedule is upserted, so a baked-in `now` would be the time the server
   * booted rather than the time the job fired. Absent means "the worker's own
   * clock", which is what the boundary run wants; the lazy path passes the
   * request's `now` so a test can pin it.
   */
  now?: string;
}

/**
 * Job name → payload. Computed keys so the names above are the single source
 * of truth; `JobName` is derived from this, so a job without a payload type
 * does not compile.
 */
export interface CheckRemindersPayload {
  now?: string;
}

export interface MailSendPayload {
  to: string;
  subject: string;
  html: string;
}

export type JobPayloads = {
  [JOB_ANALYTICS_RECORD]: AnalyticsRecordPayload;
  [JOB_LEAGUE_SETTLE]: LeagueSettlePayload;
  [JOB_CHECK_REMINDERS]: CheckRemindersPayload;
  [JOB_MAIL_SEND]: MailSendPayload;
};

export type JobName = keyof JobPayloads;

/**
 * Which queue each job rides on. `Record<JobName, QueueName>` rather than a
 * looser map, so adding a job name without giving it a queue is a compile
 * error rather than an undefined lookup at enqueue time.
 */
export const JOB_QUEUE: Record<JobName, QueueName> = {
  [JOB_ANALYTICS_RECORD]: QUEUE_ANALYTICS,
  [JOB_LEAGUE_SETTLE]: QUEUE_LEAGUE,
  [JOB_CHECK_REMINDERS]: QUEUE_NOTIFICATIONS,
  [JOB_MAIL_SEND]: QUEUE_MAIL,
};

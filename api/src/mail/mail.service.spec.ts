import { ConfigService } from '@nestjs/config';
import { JobsService } from '../jobs/jobs.service';
import { JOB_MAIL_SEND, QUEUE_MAIL } from '../jobs/queues';
import { MailService } from './mail.service';

function makeService(options: { apiKey?: string; accepted?: boolean } = {}) {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'RESEND_API_KEY') return options.apiKey ?? 'resend-key';
      if (key === 'MAIL_FROM') return 'GENKŌ <mail@example.com>';
      return undefined;
    }),
  } as unknown as ConfigService;
  const jobs = {
    enqueue: jest.fn().mockResolvedValue(
      options.accepted === false
        ? { accepted: false, error: 'redis down' }
        : { accepted: true, jobId: 'job-id' },
    ),
    inspectQueue: jest.fn().mockResolvedValue({
      status: 'up', waiting: 1, active: 2, delayed: 3, failed: 4, completed: 5,
    }),
  } as unknown as JobsService;
  return { service: new MailService(config, jobs), jobs };
}

describe('MailService delivery observability', () => {
  it('correlates the payload and BullMQ job id and reports queue acceptance', async () => {
    const { service, jobs } = makeService();

    const result = await service.enqueue('learner@example.com', 'Verify', '<p>123456</p>', 'verification');

    expect(result).toEqual({ status: 'queued', deliveryId: expect.any(String) });
    expect(jobs.enqueue).toHaveBeenCalledWith(
      JOB_MAIL_SEND,
      expect.objectContaining({
        deliveryId: result.deliveryId,
        kind: 'verification',
        to: 'learner@example.com',
      }),
      { jobId: result.deliveryId },
    );
  });

  it('reports an accepted-account email as unavailable when Redis rejects it', async () => {
    const { service } = makeService({ accepted: false });

    await expect(service.enqueue('learner@example.com', 'Verify', '<p>code</p>', 'verification'))
      .resolves.toMatchObject({ status: 'unavailable', error: 'redis down' });
  });

  it('does not queue undeliverable work when the provider is unconfigured', async () => {
    const { service, jobs } = makeService({ apiKey: '' });

    await expect(service.enqueue('learner@example.com', 'Verify', '<p>code</p>', 'verification'))
      .resolves.toMatchObject({
        status: 'unavailable',
        error: 'Mail transport is not configured',
      });
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('exposes configuration and retry/failure queue counts in health', async () => {
    const { service, jobs } = makeService({ apiKey: '' });

    await expect(service.health()).resolves.toMatchObject({
      status: 'down',
      configured: false,
      queue: { status: 'up', delayed: 3, failed: 4 },
    });
    expect(jobs.inspectQueue).toHaveBeenCalledWith(QUEUE_MAIL);
  });

  it('throws provider failures so BullMQ can retry the job', async () => {
    const { service } = makeService();
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('temporarily unavailable'),
    }) as typeof fetch;

    try {
      await expect(service.send('learner@example.com', 'Verify', '<p>code</p>'))
        .rejects.toThrow('Resend API returned 503');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

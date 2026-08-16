import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOB_MAIL_SEND, type MailSendPayload } from '../jobs/queues';
import { MailProcessor } from './mail.processor';
import { MailService } from './mail.service';

function job(attemptsMade = 0): Job<MailSendPayload> {
  return {
    name: JOB_MAIL_SEND,
    attemptsMade,
    opts: { attempts: 2 },
    data: {
      deliveryId: '00000000-0000-4000-8000-000000000010',
      kind: 'verification',
      to: 'learner@example.com',
      subject: 'Verify',
      html: '<p>code</p>',
    },
  } as Job<MailSendPayload>;
}

describe('MailProcessor', () => {
  afterEach(() => jest.restoreAllMocks());

  it('logs provider acceptance with correlation metadata and no recipient', async () => {
    const mail = { send: jest.fn().mockResolvedValue('provider-123') } as unknown as MailService;
    const logged = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const processor = new MailProcessor(mail);

    await processor.process(job());

    expect(logged).toHaveBeenCalledWith(expect.stringContaining('Email provider accepted'));
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('delivery=00000000-0000-4000-8000-000000000010'));
    expect(logged.mock.calls.flat().join(' ')).not.toContain('learner@example.com');
  });

  it('rethrows transport failures and identifies retry and terminal attempts', async () => {
    const failure = new Error('provider unavailable');
    const mail = { send: jest.fn().mockRejectedValue(failure) } as unknown as MailService;
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const processor = new MailProcessor(mail);

    await expect(processor.process(job(0))).rejects.toBe(failure);
    expect(logged).toHaveBeenLastCalledWith(expect.stringContaining('retry pending'));

    await expect(processor.process(job(1))).rejects.toBe(failure);
    expect(logged).toHaveBeenLastCalledWith(expect.stringContaining('terminal failure'));
  });
});

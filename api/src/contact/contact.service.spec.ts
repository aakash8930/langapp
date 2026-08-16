import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { ContactService } from './contact.service';

function harness(options: { destination?: string; queued?: boolean } = {}) {
  const config = {
    get: jest.fn((key: string) => key === 'CONTACT_TO' ? options.destination ?? 'support@genko.app' : undefined),
  } as unknown as ConfigService;
  const mail = {
    enqueue: jest.fn().mockResolvedValue(
      options.queued === false
        ? { status: 'unavailable', deliveryId: 'delivery-1', error: 'redis down' }
        : { status: 'queued', deliveryId: 'delivery-1' },
    ),
  } as unknown as MailService;
  return { service: new ContactService(config, mail), mail };
}

const input = {
  name: 'Learner',
  email: 'Learner@example.com',
  message: 'I need help with a lesson.',
};

describe('ContactService', () => {
  it('only reports success after the real mail queue accepts the request', async () => {
    const { service, mail } = harness();

    await expect(service.submit(input)).resolves.toEqual({
      status: 'queued',
      deliveryId: 'delivery-1',
    });
    expect(mail.enqueue).toHaveBeenCalledWith(
      'support@genko.app',
      'GENKŌ support request from Learner',
      expect.stringContaining('learner@example.com'),
      'contact',
    );
  });

  it('does not turn a queue outage into a false-positive receipt', async () => {
    const { service } = harness({ queued: false });
    await expect(service.submit(input)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('escapes user input before it reaches the HTML email', async () => {
    const { service, mail } = harness();
    await service.submit({ ...input, name: '<script>', message: '<b>hello</b> there' });
    expect(mail.enqueue).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('&lt;script&gt;'),
      expect.stringContaining('&lt;b&gt;hello&lt;/b&gt;'),
      'contact',
    );
  });

  it('rejects honeypot submissions without claiming they were queued', async () => {
    const { service, mail } = harness();
    await expect(service.submit({ ...input, website: 'https://spam.example' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(mail.enqueue).not.toHaveBeenCalled();
  });
});

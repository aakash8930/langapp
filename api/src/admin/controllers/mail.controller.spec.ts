import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { MailService } from '../../mail/mail.service';
import { AdminMailController } from './mail.controller';

function setup(to = 'ops@example.com', status: 'queued' | 'unavailable' = 'queued') {
  const config = { get: jest.fn().mockReturnValue(to) } as unknown as ConfigService;
  const mail = {
    enqueue: jest.fn().mockResolvedValue({
      status,
      deliveryId: 'delivery-1',
      ...(status === 'unavailable' ? { error: 'redis down' } : {}),
    }),
  } as unknown as MailService;
  return { controller: new AdminMailController(config, mail), mail };
}

describe('AdminMailController', () => {
  it('queues a smoke message through the production mail path', async () => {
    const { controller, mail } = setup();
    await expect(controller.smoke()).resolves.toEqual({ status: 'queued', deliveryId: 'delivery-1' });
    expect(mail.enqueue).toHaveBeenCalledWith(
      'ops@example.com',
      expect.stringContaining('smoke test'),
      expect.stringContaining('Redis queue'),
      'smoke',
    );
  });

  it('refuses to make a false delivery claim when destination or queue is unavailable', async () => {
    await expect(setup('').controller.smoke()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(setup('ops@example.com', 'unavailable').controller.smoke())
      .rejects.toThrow('redis down');
  });
});

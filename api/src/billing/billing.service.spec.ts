import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import type { IPaymentProvider } from './payment-provider.interface';

describe('BillingService public MVP', () => {
  it('does not create a checkout for the free public MVP plan', async () => {
    const provider = { createCheckoutSession: jest.fn() } as unknown as IPaymentProvider;
    const userModel = { findById: jest.fn() };
    const service = new BillingService(provider, userModel as never);

    await expect(service.createCheckout('user-id', 'free', 'monthly'))
      .rejects.toThrow(BadRequestException);
    expect(provider.createCheckoutSession).not.toHaveBeenCalled();
    expect(userModel.findById).not.toHaveBeenCalled();
  });
});

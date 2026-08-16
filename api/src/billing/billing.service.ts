import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../user/schemas/user.schema';
import { IPaymentProvider, PAYMENT_PROVIDER } from './payment-provider.interface';
import { PLANS, PlanId } from './plans';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: IPaymentProvider,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private async getUser(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  getPlans() {
    return PLANS;
  }

  async createCheckout(
    userId: string,
    planId: PlanId,
    billingCycle: 'monthly' | 'yearly',
  ): Promise<{ url: string }> {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) throw new BadRequestException('Invalid plan');
    if (plan.monthlyPrice === 0 && plan.yearlyPrice === 0) {
      throw new BadRequestException('GENKŌ is free during the public MVP; checkout is disabled.');
    }

    const user = await this.getUser(userId);
    const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    if (price === null) throw new BadRequestException('This plan requires contacting sales.');

    const session = await this.paymentProvider.createCheckoutSession({
      userId,
      email: user.email,
      planId,
      billingCycle,
    });

    // Store the intent so the webhook knows what to do
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          'subscription.gatewaySubscriptionId': session.sessionId,
        },
      },
    ).exec();

    return { url: session.url };
  }

  async createPortal(userId: string): Promise<{ url: string }> {
    const user = await this.getUser(userId);
    if (!user.subscription?.gatewayCustomerId) {
      throw new BadRequestException('No active subscription');
    }
    return this.paymentProvider.createPortalSession({
      customerId: user.subscription.gatewayCustomerId,
    });
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const event = await this.paymentProvider.verifyWebhook(rawBody, signature);
    this.logger.log(`Webhook: ${event.type} for subscription ${event.subscriptionId}`);

    const user = await this.userModel.findOne({
      'subscription.gatewaySubscriptionId': event.subscriptionId,
    }).exec();

    if (!user) {
      this.logger.warn(`No user found for subscription ${event.subscriptionId}`);
      return;
    }

    switch (event.type) {
      case 'subscription.activated':
      case 'subscription.charged':
        await this.userModel.updateOne(
          { _id: user._id },
          {
            $set: {
              'subscription.status': 'active',
              'subscription.plan': user.subscription?.plan ?? 'pro',
              'subscription.currentPeriodEnd': event.currentPeriodEnd ?? null,
              'subscription.gatewayCustomerId': event.customerId,
            },
          },
        ).exec();
        break;

      case 'subscription.cancelled':
        await this.userModel.updateOne(
          { _id: user._id },
          {
            $set: {
              'subscription.status': 'canceled',
              'subscription.plan': 'free',
              'subscription.currentPeriodEnd': null,
            },
          },
        ).exec();
        break;

      case 'subscription.pending':
        await this.userModel.updateOne(
          { _id: user._id },
          {
            $set: {
              'subscription.status': 'past_due',
            },
          },
        ).exec();
        break;

      default:
        this.logger.log(`Unhandled webhook event: ${event.type}`);
    }
  }

  async cancelSubscription(userId: string, cancelAtPeriodEnd = true): Promise<void> {
    const user = await this.getUser(userId);
    const subId = user.subscription?.gatewaySubscriptionId;

    if (cancelAtPeriodEnd) {
      await this.userModel.updateOne(
        { _id: userId },
        { $set: { 'subscription.cancelAtPeriodEnd': true } },
      ).exec();
      return;
    }

    // Immediate cancellation
    if (subId) {
      try {
        await this.paymentProvider.cancelSubscription(subId);
      } catch (err) {
        this.logger.warn(`Failed to cancel at gateway: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          'subscription.status': 'canceled',
          'subscription.plan': 'free',
          'subscription.currentPeriodEnd': null,
          'subscription.cancelAtPeriodEnd': false,
          'subscription.gatewaySubscriptionId': null,
        },
      },
    ).exec();
  }

  async getInvoices(userId: string) {
    const user = await this.getUser(userId);
    if (!user.subscription?.gatewayCustomerId) return { items: [], total: 0 };
    const items = await this.paymentProvider.getInvoices(user.subscription.gatewayCustomerId);
    return { items, total: items.length };
  }

  isPremium(user: UserDocument): boolean {
    return (
      (user.subscription?.status === 'active' || user.subscription?.status === 'trialing') &&
      user.subscription?.plan !== 'free'
    );
  }

  async cancelForAccountDeletion(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    if (!user?.subscription?.gatewaySubscriptionId) return;

    try {
      await this.paymentProvider.cancelSubscription(user.subscription.gatewaySubscriptionId);
    } catch (err) {
      this.logger.warn(`Failed to cancel subscription during deletion: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

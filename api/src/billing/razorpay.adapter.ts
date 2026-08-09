import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import {
  IPaymentProvider,
  GatewayInvoice,
  GatewaySubscription,
  WebhookEvent,
} from './payment-provider.interface';

interface RazorpaySubscription {
  id: string;
  status: string;
  current_end: number | null;
  customer_id: string;
  customer_notify?: boolean;
}

interface RazorpayInvoice {
  id: string;
  date: number;
  description: string;
  amount: number;
  currency: string;
  status: string;
  short_url?: string;
}

/**
 * Razorpay adapter. Plans are created in Razorpay dashboard as "Plan" entities.
 * The adapter maps our internal plan IDs to Razorpay plan IDs.
 */
@Injectable()
export class RazorpayAdapter implements IPaymentProvider {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = 'https://api.razorpay.com/v1';
  private readonly planIds: Record<string, { monthly?: string; yearly?: string }> = {};
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID') ?? '';
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') ?? '';
    this.webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '';
    this.enabled = !!(this.keyId && this.keySecret);

    // Plan IDs from Razorpay dashboard — set in env or hardcoded here.
    this.planIds = {
      pro: {
        monthly: this.config.get<string>('RAZORPAY_PLAN_PRO_MONTHLY') ?? '',
        yearly: this.config.get<string>('RAZORPAY_PLAN_PRO_YEARLY') ?? '',
      },
      enterprise: {
        monthly: this.config.get<string>('RAZORPAY_PLAN_ENTERPRISE_MONTHLY') ?? '',
        yearly: this.config.get<string>('RAZORPAY_PLAN_ENTERPRISE_YEARLY') ?? '',
      },
    };
  }

  async createCheckoutSession(params: {
    userId: string;
    email: string;
    planId: string;
    billingCycle: 'monthly' | 'yearly';
  }): Promise<{ sessionId: string; url: string }> {
    if (!this.enabled) throw new Error('Billing is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    const razorpayPlanId = this.planIds[params.planId]?.[params.billingCycle];
    if (!razorpayPlanId) {
      throw new Error(`No Razorpay plan configured for ${params.planId}/${params.billingCycle}`);
    }

    const body = {
      plan_id: razorpayPlanId,
      customer_notify: 1,
      total_count: 12, // auto-renew 12 times
      quantity: 1,
      notes: {
        userId: params.userId,
        plan: params.planId,
        cycle: params.billingCycle,
      },
    };

    const sub = await this.request<RazorpaySubscription>('POST', '/subscriptions', body);
    return {
      sessionId: sub.id,
      url: `https://razorpay.com/subscription/${sub.id}/authenticate?auth_type=link`,
    };
  }

  async createPortalSession(params: { customerId: string }): Promise<{ url: string }> {
    // Razorpay doesn't have a hosted customer portal. Link to subscription page.
    const subs = await this.request<{ items: RazorpaySubscription[] }>(
      'GET',
      `/subscriptions?customer_id=${encodeURIComponent(params.customerId)}`,
    );
    const active = subs.items.find((s) => s.status === 'active');
    if (active) {
      return { url: `https://razorpay.com/subscriptions/${active.id}` };
    }
    return { url: 'https://dashboard.razorpay.com/app/subscriptions' };
  }

  async verifyWebhook(rawBody: Buffer, signature: string): Promise<WebhookEvent> {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expected) {
      throw new Error('Webhook signature mismatch');
    }

    const payload = JSON.parse(rawBody.toString());
    const event = payload.event;
    const sub = payload.payload?.subscription?.entity ?? {};

    return {
      type: event,
      subscriptionId: sub.id,
      customerId: sub.customer_id,
      status: sub.status,
      currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : undefined,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request('POST', `/subscriptions/${subscriptionId}/cancel`, {
      cancel_at_cycle_end: 0,
    });
  }

  async getInvoices(customerId: string, limit = 20): Promise<GatewayInvoice[]> {
    const result = await this.request<{ items: RazorpayInvoice[] }>(
      'GET',
      `/invoices?customer_id=${encodeURIComponent(customerId)}&count=${limit}`,
    );
    return result.items.map((inv) => ({
      id: inv.id,
      date: new Date(inv.date * 1000),
      description: inv.description ?? 'Subscription payment',
      amount: inv.amount / 100,
      currency: inv.currency,
      status: inv.status,
      pdfUrl: inv.short_url,
    }));
  }

  async getSubscription(subscriptionId: string): Promise<GatewaySubscription | null> {
    try {
      const sub = await this.request<RazorpaySubscription>(
        'GET',
        `/subscriptions/${subscriptionId}`,
      );
      return {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : new Date(),
        cancelAtPeriodEnd: false,
        customerId: sub.customer_id,
      };
    } catch {
      return null;
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Razorpay ${method} ${path} returned ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }
}

export interface GatewaySubscription {
  id: string;
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  customerId: string;
}

export interface GatewayInvoice {
  id: string;
  date: Date;
  description: string;
  amount: number;
  currency: string;
  status: string;
  pdfUrl?: string;
}

export interface WebhookEvent {
  type: string;
  subscriptionId: string;
  customerId: string;
  status?: string;
  currentPeriodEnd?: Date;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface IPaymentProvider {
  createCheckoutSession(params: {
    userId: string;
    email: string;
    planId: string;
    billingCycle: 'monthly' | 'yearly';
  }): Promise<{ sessionId: string; url: string }>;

  createPortalSession(params: { customerId: string }): Promise<{ url: string }>;

  verifyWebhook(rawBody: Buffer, signature: string): Promise<WebhookEvent>;

  cancelSubscription(subscriptionId: string): Promise<void>;

  getInvoices(customerId: string, limit?: number): Promise<GatewayInvoice[]>;

  getSubscription(subscriptionId: string): Promise<GatewaySubscription | null>;
}

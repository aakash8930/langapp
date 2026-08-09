import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import { PlanId } from './plans';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('billing/plans')
  getPlans() {
    return { plans: this.billing.getPlans() };
  }

  @Post('me/billing/checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(
    @CurrentUser() current: AuthenticatedUser,
    @Body() body: { planId: PlanId; billingCycle: 'monthly' | 'yearly' },
  ) {
    if (!body.planId || !body.billingCycle) {
      throw new BadRequestException('planId and billingCycle are required');
    }
    return this.billing.createCheckout(current.userId, body.planId, body.billingCycle);
  }

  @Post('me/billing/portal')
  @UseGuards(JwtAuthGuard)
  async portal(@CurrentUser() current: AuthenticatedUser) {
    return this.billing.createPortal(current.userId);
  }

  @Get('me/billing/invoices')
  @UseGuards(JwtAuthGuard)
  async invoices(@CurrentUser() current: AuthenticatedUser) {
    return this.billing.getInvoices(current.userId);
  }

  @Post('me/billing/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(
    @CurrentUser() current: AuthenticatedUser,
    @Query('at_period_end') atPeriodEnd?: string,
  ) {
    const cancelAtPeriodEnd = atPeriodEnd !== 'false';
    await this.billing.cancelSubscription(current.userId, cancelAtPeriodEnd);
    return { message: cancelAtPeriodEnd ? 'Subscription will cancel at period end.' : 'Subscription cancelled.' };
  }

  @Post('billing/webhook')
  async webhook(
    @Req() req: Request,
    @Body() body: any,
  ) {
    const signature = (req.headers['x-razorpay-signature'] as string) ?? '';
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(body));
    await this.billing.handleWebhook(rawBody, signature);
    return { received: true };
  }
}

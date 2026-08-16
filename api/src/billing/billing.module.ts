import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RazorpayAdapter } from './razorpay.adapter';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { User, UserSchema } from '../user/schemas/user.schema';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UserModule,
  ],
  controllers: [BillingController],
  providers: [
    BillingService,
    { provide: PAYMENT_PROVIDER, useClass: RazorpayAdapter },
  ],
  exports: [BillingService],
})
export class BillingModule {}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'coupons', timestamps: true })
export class Coupon {
  @Prop({ type: String, required: true, unique: true, uppercase: true })
  code: string;

  @Prop({ type: String, required: true, enum: ['percent', 'fixed'] })
  discountType: 'percent' | 'fixed';

  @Prop({ type: Number, required: true, min: 1 })
  discountValue: number;

  @Prop({ type: Number, default: null })
  maxUses: number | null;

  @Prop({ type: Number, default: 0 })
  usedCount: number;

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;

  @Prop({ type: Boolean, default: true })
  active: boolean;

  @Prop({ type: [String], default: [] })
  applicablePlans: string[];
}

export type CouponDocument = HydratedDocument<Coupon>;
export const CouponSchema = SchemaFactory.createForClass(Coupon);

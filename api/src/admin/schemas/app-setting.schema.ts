import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'app_settings', timestamps: true })
export class AppSetting {
  @Prop({ type: String, required: true, unique: true })
  key: string;

  @Prop({ type: Object, required: true })
  value: unknown;
}

export type AppSettingDocument = HydratedDocument<AppSetting>;
export const AppSettingSchema = SchemaFactory.createForClass(AppSetting);

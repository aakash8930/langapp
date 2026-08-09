import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'roles', timestamps: true })
export class Role {
  @Prop({ type: String, required: true, unique: true })
  name: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];
}

export type RoleDocument = HydratedDocument<Role>;
export const RoleSchema = SchemaFactory.createForClass(Role);

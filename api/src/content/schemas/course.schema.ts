import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'courses', timestamps: true })
export class Course {
  @Prop({ type: String, required: true, enum: ['ja'], default: 'ja' })
  lang: 'ja';

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String, default: '', trim: true })
  description: string;

  @Prop({ type: [String], default: [] })
  unitSlugs: string[];

  @Prop({ type: String, enum: ['draft', 'published'], default: 'draft' })
  status: 'draft' | 'published';

  @Prop({ type: Number, default: 0 })
  order: number;
}

export type CourseDocument = HydratedDocument<Course>;
export const CourseSchema = SchemaFactory.createForClass(Course);

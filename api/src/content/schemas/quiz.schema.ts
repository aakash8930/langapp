import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'quizzes', timestamps: true })
export class Quiz {
  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String, default: '', trim: true })
  description: string;

  @Prop({ type: String, enum: ['draft', 'published'], default: 'draft' })
  status: 'draft' | 'published';

  @Prop({
    type: [{
      question: { type: String, required: true },
      type: { type: String, enum: ['multiple_choice', 'text_input'], default: 'multiple_choice' },
      options: { type: [String], default: [] },
      correctAnswer: { type: String, required: true },
      explanation: { type: String, default: '' },
    }],
    default: [],
  })
  questions: {
    question: string;
    type: 'multiple_choice' | 'text_input';
    options: string[];
    correctAnswer: string;
    explanation: string;
  }[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, enum: ['N5', 'N4', 'N3', 'N2', 'N1', 'any'], default: 'any' })
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'any';
}

export type QuizDocument = HydratedDocument<Quiz>;
export const QuizSchema = SchemaFactory.createForClass(Quiz);
QuizSchema.index({ status: 1, createdAt: -1 });
QuizSchema.index({ tags: 1 });

import { BadRequestException, Injectable } from '@nestjs/common';
import { GeneratedQuestion } from '../../dto/exercise-response.dto';
import { Choice, ExerciseContext, ExercisePlugin, GradeInput, GradeOutput, QuestionStyle } from './exercise-plugin.interface';

function normaliseAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}

@Injectable()
export class WordReadingPlugin implements ExercisePlugin {
  readonly exerciseType = 'wordReading';

  generateQuestion(
    correct: Choice,
    _lessonPool: Choice[],
    _unitPool: Choice[],
    style: QuestionStyle,
    context: ExerciseContext,
  ): GeneratedQuestion {
    return {
      exerciseId: `${context.attempt}:${context.index}`,
      type: 'wordReading',
      promptKind: style.promptKind,
      itemId: correct.id,
      prompt: correct.prompt,
      question: style.question(correct),
      correctValue: correct.answer,
    };
  }

  gradeAnswer(question: GeneratedQuestion, input: GradeInput): GradeOutput {
    if (typeof input.text !== 'string') {
      throw new BadRequestException('wordReading exercise requires a text parameter');
    }
    const normalized = normaliseAnswer(input.text);
    const correct = normalized === normaliseAnswer(question.correctValue ?? '');

    return {
      correct,
      selectedValue: normalized,
      correctValue: question.correctValue ?? '',
    };
  }
}

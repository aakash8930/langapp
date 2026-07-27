import { BadRequestException, Injectable } from '@nestjs/common';
import { GeneratedQuestion } from '../../dto/exercise-response.dto';
import { Choice, ExerciseContext, ExercisePlugin, GradeInput, GradeOutput, QuestionStyle } from './exercise-plugin.interface';

@Injectable()
export class FlashcardPlugin implements ExercisePlugin {
  readonly exerciseType = 'flashcard';

  generateQuestion(
    correct: Choice,
    _lessonPool: Choice[],
    _unitPool: Choice[],
    style: QuestionStyle,
    context: ExerciseContext,
  ): GeneratedQuestion {
    return {
      exerciseId: `${context.attempt}:${context.index}`,
      type: 'flashcard',
      promptKind: style.promptKind,
      itemId: correct.id,
      prompt: correct.prompt,
      question: style.question(correct),
      correctValue: correct.answer,
    };
  }

  gradeAnswer(question: GeneratedQuestion, input: GradeInput): GradeOutput {
    if (typeof input.text !== 'string' && !input.optionId) {
      throw new BadRequestException('flashcard exercise requires self-graded text ("pass"/"fail") or optionId');
    }

    const val = (input.text || input.optionId || '').trim().toLowerCase();
    const correct = val === 'pass' || val === 'good' || val === 'easy' || val === (question.correctValue || '').trim().toLowerCase();

    return {
      correct,
      selectedValue: val,
      correctValue: question.correctValue ?? '',
    };
  }
}

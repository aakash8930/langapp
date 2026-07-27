import { BadRequestException, Injectable } from '@nestjs/common';
import { GeneratedQuestion } from '../../dto/exercise-response.dto';
import { Choice, ExerciseContext, ExercisePlugin, GradeInput, GradeOutput, QuestionStyle } from './exercise-plugin.interface';

const OPTIONS_PER_QUESTION = 4;

function shuffle<T>(array: T[], random: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

@Injectable()
export class FillInTheBlankPlugin implements ExercisePlugin {
  readonly exerciseType = 'fillInTheBlank';

  generateQuestion(
    correct: Choice,
    lessonPool: Choice[],
    unitPool: Choice[],
    style: QuestionStyle,
    context: ExerciseContext,
  ): GeneratedQuestion {
    const pool = lessonPool.length >= OPTIONS_PER_QUESTION ? lessonPool : unitPool;
    const distractors = shuffle(pool.filter((c) => c.answer !== correct.answer), context.random).slice(
      0,
      OPTIONS_PER_QUESTION - 1,
    );

    const optionsUnshuffled = [
      { value: correct.answer, correct: true },
      ...distractors.map((c) => ({ value: c.answer, correct: false })),
    ];
    const optionsShuffled = shuffle(optionsUnshuffled, context.random);

    const options = optionsShuffled.map((opt, i) => ({
      id: `opt-${i}`,
      value: opt.value,
    }));

    const correctOptionId = options.find((_, i) => optionsShuffled[i].correct)?.id ?? 'opt-0';

    return {
      exerciseId: `${context.attempt}:${context.index}`,
      type: 'fillInTheBlank',
      promptKind: style.promptKind,
      itemId: correct.id,
      prompt: correct.prompt.includes('＿') ? correct.prompt : `${correct.prompt} ( ＿ )`,
      question: style.question(correct),
      options,
      correctOptionId,
      correctValue: correct.answer,
    };
  }

  gradeAnswer(question: GeneratedQuestion, input: GradeInput): GradeOutput {
    if (!input.optionId && typeof input.text !== 'string') {
      throw new BadRequestException('fillInTheBlank exercise requires optionId or text parameter');
    }

    if (input.optionId) {
      const selected = question.options?.find((o) => o.id === input.optionId);
      if (!selected) {
        throw new BadRequestException(`Option ${input.optionId} is not valid for this exercise`);
      }
      return {
        correct: selected.id === question.correctOptionId,
        selectedValue: selected.value,
        correctValue: question.correctValue ?? '',
      };
    }

    const typed = (input.text ?? '').trim().toLowerCase();
    const target = (question.correctValue ?? '').trim().toLowerCase();

    return {
      correct: typed === target,
      selectedValue: typed,
      correctValue: question.correctValue ?? '',
    };
  }
}

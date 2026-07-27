import { BadRequestException, Injectable } from '@nestjs/common';
import { GeneratedQuestion } from '../../dto/exercise-response.dto';
import { Choice, ExerciseContext, ExercisePlugin, GradeInput, GradeOutput, QuestionStyle } from './exercise-plugin.interface';

const OPTIONS_PER_QUESTION = 4;

function distractorPool(pool: Choice[], correct: Choice): Choice[] {
  return pool.filter((c) => c.answer !== correct.answer);
}

function shuffle<T>(array: T[], random: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

@Injectable()
export class MultipleChoicePlugin implements ExercisePlugin {
  readonly exerciseType = 'multipleChoice';

  generateQuestion(
    correct: Choice,
    lessonPool: Choice[],
    unitPool: Choice[],
    style: QuestionStyle,
    context: ExerciseContext,
  ): GeneratedQuestion {
    const needed = OPTIONS_PER_QUESTION - 1;
    const lessonDistractors = shuffle(distractorPool(lessonPool, correct), context.random);
    const taken = lessonDistractors.slice(0, needed);

    if (taken.length < needed) {
      const seen = new Set<string>([correct.answer, ...taken.map((c) => c.answer)]);
      const fallback: Choice[] = [];
      for (const candidate of shuffle(distractorPool(unitPool, correct), context.random)) {
        if (seen.has(candidate.answer)) continue;
        seen.add(candidate.answer);
        fallback.push(candidate);
        if (taken.length + fallback.length >= needed) break;
      }
      taken.push(...fallback);
    }

    const optionsUnshuffled = [
      { value: correct.answer, correct: true },
      ...taken.map((c) => ({ value: c.answer, correct: false })),
    ];
    const optionsShuffled = shuffle(optionsUnshuffled, context.random);

    const options = optionsShuffled.map((opt, i) => ({
      id: `opt-${i}`,
      value: opt.value,
    }));

    const correctOptionId = options.find(
      (_, i) => optionsShuffled[i].correct,
    )?.id;

    return {
      exerciseId: `${context.attempt}:${context.index}`,
      type: 'multipleChoice',
      promptKind: style.promptKind,
      itemId: correct.id,
      prompt: correct.prompt,
      question: style.question(correct),
      options,
      correctOptionId: correctOptionId ?? 'opt-0',
      correctValue: correct.answer,
    };
  }

  gradeAnswer(question: GeneratedQuestion, input: GradeInput): GradeOutput {
    if (!input.optionId) {
      throw new BadRequestException('multipleChoice exercise requires an optionId parameter');
    }
    const selected = question.options?.find((o) => o.id === input.optionId);
    if (!selected) {
      throw new BadRequestException(`Option ${input.optionId} is not valid for this exercise`);
    }

    const correct = selected.id === question.correctOptionId;
    return {
      correct,
      selectedValue: selected.value,
      correctValue: question.correctValue ?? '',
    };
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { GeneratedQuestion } from '../../dto/exercise-response.dto';
import { Choice, ExerciseContext, ExercisePlugin, GradeInput, GradeOutput, QuestionStyle } from './exercise-plugin.interface';

function shuffle<T>(array: T[], random: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

@Injectable()
export class SentenceBuildingPlugin implements ExercisePlugin {
  readonly exerciseType = 'sentenceBuilding';

  generateQuestion(
    correct: Choice,
    _lessonPool: Choice[],
    _unitPool: Choice[],
    _style: QuestionStyle,
    context: ExerciseContext,
  ): GeneratedQuestion {
    // If choice has explicit tokens, use them; otherwise split by spaces or characters
    const targetTokens = correct.tokens ?? correct.prompt.split(/\s+/).filter(Boolean);
    const shuffledTokens = shuffle(targetTokens, context.random);

    const options = shuffledTokens.map((token, i) => ({
      id: `opt-${i}`,
      value: token,
    }));

    return {
      exerciseId: `${context.attempt}:${context.index}`,
      type: 'sentenceBuilding',
      promptKind: 'grammar',
      itemId: correct.id,
      prompt: correct.hint ? `Translate: “${correct.hint}”` : `Arrange tokens for: ${correct.answer}`,
      question: 'Arrange the tokens in the correct word order:',
      options,
      correctValue: targetTokens.join(' '),
    };
  }

  gradeAnswer(question: GeneratedQuestion, input: GradeInput): GradeOutput {
    if (!input.selectedTokens && typeof input.text !== 'string') {
      throw new BadRequestException('sentenceBuilding exercise requires selectedTokens or text parameter');
    }

    const submitted = input.selectedTokens
      ? input.selectedTokens.join(' ').trim()
      : (input.text ?? '').trim();

    const expected = (question.correctValue ?? '').trim();
    const correct = submitted === expected;

    return {
      correct,
      selectedValue: submitted,
      correctValue: expected,
    };
  }
}

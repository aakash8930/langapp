import { BadRequestException, Injectable } from '@nestjs/common';
import { GeneratedQuestion } from '../../dto/exercise-response.dto';
import { Choice, ExerciseContext, ExercisePlugin, GradeInput, GradeOutput, QuestionStyle } from './exercise-plugin.interface';

// Normalize Japanese text by removing spaces, punctuation, and converting full-width to half-width if needed.
function normaliseSpeech(text: string): string {
  return text
    .trim()
    .replace(/[\s　。、！？.!?]/g, '')
    .toLowerCase();
}

@Injectable()
export class SpeechPlugin implements ExercisePlugin {
  readonly exerciseType = 'speech';

  generateQuestion(
    correct: Choice,
    _lessonPool: Choice[],
    _unitPool: Choice[],
    style: QuestionStyle,
    context: ExerciseContext,
  ): GeneratedQuestion {
    // For speech, the prompt is the text we want them to say.
    // E.g., prompt might be "学校" or "私は学生です"
    return {
      exerciseId: `${context.attempt}:${context.index}`,
      type: 'speech',
      promptKind: style.promptKind,
      itemId: correct.id,
      prompt: correct.prompt,
      question: 'Read the phrase aloud',
      correctValue: correct.prompt, // For speech, they must say the prompt itself.
    };
  }

  gradeAnswer(question: GeneratedQuestion, input: GradeInput): GradeOutput {
    if (typeof input.text !== 'string') {
      throw new BadRequestException('speech exercise requires a text parameter from the transcript');
    }
    
    const normalizedInput = normaliseSpeech(input.text);
    const normalizedTarget = normaliseSpeech(question.correctValue ?? '');
    
    // Fuzzy matching: if the target is found within the spoken transcript, or vice versa
    const correct = normalizedInput.includes(normalizedTarget) || normalizedTarget.includes(normalizedInput);

    return {
      correct,
      selectedValue: input.text,
      correctValue: question.correctValue ?? '',
    };
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { ContentService } from '../content/content.service';
import { LessonSummary, ResolvedItem } from '../content/dto/lesson-response.dto';
import { Question } from '../content/dto/exercise-response.dto';
import { ExerciseService } from '../content/exercise/exercise.service';
import { LearnerItemStateService, WeakItemEvidence } from '../learning/learner-item-state.service';
import { ItemRef } from '../content/schemas/lesson.schema';
import { UserService } from '../user/user.service';
import { localDateString } from '../user/gamification/streak';
import { AnswerPracticeQuestionDto, CreatePracticeSessionDto } from './dto/practice.dto';
import {
  PRACTICE_SKILLS,
  PracticeAnswer,
  PracticeMode,
  PracticeQuestion,
  PracticeSession,
  PracticeSessionDocument,
  PracticeSkill,
} from './schemas/practice-session.schema';

const DEFAULT_QUESTION_COUNTS: Record<PracticeMode, number> = {
  daily: 12,
  mixed: 15,
  weak: 12,
  timed: 40,
  random: 10,
  challenge: 20,
};

@Injectable()
export class PracticeService {
  constructor(
    @InjectModel(PracticeSession.name)
    private readonly sessionModel: Model<PracticeSessionDocument>,
    private readonly contentService: ContentService,
    private readonly exerciseService: ExerciseService,
    private readonly learnerItems: LearnerItemStateService,
    private readonly userService: UserService,
  ) {}

  async create(userId: string, input: CreatePracticeSessionDto) {
    const sessionId = new Types.ObjectId();
    const allLessons = await this.contentService.findLessons();
    const selectedSkills = input.skills?.length ? [...new Set(input.skills)] : [...PRACTICE_SKILLS];
    const level = input.level ?? 'all';
    const questionCount = input.questionCount ?? DEFAULT_QUESTION_COUNTS[input.mode];
    const weakEvidence = await this.learnerItems.findWeakestForUser(
      userId,
      60,
      selectedSkills.flatMap(skillToContentKinds),
    );
    const weakIds = new Set(weakEvidence.map((row) => row.id.toString()));
    const weakLessons = weakEvidence.length
      ? await this.contentService.findLessonsContainingItems(
          weakEvidence.map((row) => ({ kind: row.kind, id: row.id }) as ItemRef),
        )
      : [];
    const weakLessonIds = new Set(weakLessons.map((lesson) => lesson.id));

    if (input.mode === 'weak' && weakEvidence.length === 0) {
      throw new UnprocessableEntityException(
        'Weak Areas needs answered exercises first. Complete Mixed or Daily Practice to create real confidence evidence.',
      );
    }

    let candidates = allLessons.filter((lesson) => {
      const skill = skillForLesson(lesson);
      return selectedSkills.includes(skill) && lessonMatchesLevel(lesson, level);
    });
    if (input.mode === 'weak') {
      candidates = candidates.filter((lesson) => weakLessonIds.has(lesson.id));
    }
    if (candidates.length === 0) {
      throw new UnprocessableEntityException(
        'No generated exercises match these level and skill filters.',
      );
    }

    const dailyTimezone = input.mode === 'daily'
      ? (await this.userService.findById(userId))?.settings.tz ?? 'UTC'
      : 'UTC';
    const seed = input.mode === 'daily'
      ? `${userId}:${localDateString(new Date(), dailyTimezone)}:daily`
      : `${sessionId.toString()}:${input.mode}`;
    const prioritizedWeakLessons = input.mode === 'daily' || input.mode === 'weak'
      ? weakLessonIds
      : new Set<string>();
    const ordered = orderLessons(candidates, selectedSkills, prioritizedWeakLessons, seed);
    const setsNeeded = Math.min(ordered.length, Math.max(5, Math.ceil(questionCount / 3) + 2));
    const generated = await Promise.allSettled(
      ordered.slice(0, setsNeeded).map((lesson) =>
        this.exerciseService.generate(lesson.id, userId, attemptFor(sessionId, lesson.id)),
      ),
    );

    let questionPool = generated.flatMap((result) =>
      result.status === 'fulfilled'
        ? result.value.questions.map((question) => ({
            question,
            lessonId: result.value.lessonId,
            lessonTitle: result.value.title,
            unit: result.value.unit,
          }))
        : [],
    );
    questionPool = deterministicShuffle(questionPool, `${seed}:questions`);
    if (input.mode === 'weak' || input.mode === 'daily') {
      questionPool.sort((a, b) => Number(weakIds.has(b.question.itemId)) - Number(weakIds.has(a.question.itemId)));
    }

    const interleaved = interleaveBySkill(questionPool, selectedSkills).slice(0, questionCount);
    if (interleaved.length === 0) {
      throw new UnprocessableEntityException(
        'The available lessons could not generate questions for these filters.',
      );
    }

    const now = new Date();
    const timeLimitMinutes = timeLimitFor(input.mode, input.timeLimitMinutes);
    const timeLimitSeconds = timeLimitMinutes ? timeLimitMinutes * 60 : null;
    const questions: PracticeQuestion[] = interleaved.map((entry, index) => ({
      id: `q-${index + 1}`,
      lessonId: new Types.ObjectId(entry.lessonId),
      lessonTitle: entry.lessonTitle,
      unit: entry.unit,
      skill: skillForQuestion(entry.question),
      exerciseId: entry.question.exerciseId,
      itemId: entry.question.itemId,
      type: entry.question.type,
      prompt: entry.question.prompt,
      promptKind: entry.question.promptKind,
      question: entry.question.question,
      ...('options' in entry.question && entry.question.options
        ? { options: entry.question.options }
        : {}),
    }));

    const session = await this.sessionModel.create({
      _id: sessionId,
      userId: new Types.ObjectId(userId),
      mode: input.mode,
      status: 'active',
      questions,
      answers: [],
      filters: { skills: selectedSkills, level },
      startedAt: now,
      completedAt: null,
      deadlineAt: timeLimitSeconds
        ? new Date(now.getTime() + timeLimitSeconds * 1000)
        : null,
      timeLimitSeconds,
      score: 0,
      maxCombo: 0,
      xpAwarded: 0,
      durationSeconds: null,
    });
    return this.sessionResponse(session);
  }

  async findOne(userId: string, sessionId: string) {
    const session = await this.findOwned(userId, sessionId);
    if (session.status === 'active' && session.deadlineAt && session.deadlineAt.getTime() <= Date.now()) {
      return this.complete(userId, sessionId);
    }
    return this.sessionResponse(session);
  }

  async answer(
    userId: string,
    sessionId: string,
    questionId: string,
    input: AnswerPracticeQuestionDto,
  ) {
    const session = await this.findOwned(userId, sessionId);
    if (session.status !== 'active') {
      throw new ConflictException('This Practice session is already complete.');
    }
    if (session.deadlineAt && session.deadlineAt.getTime() <= Date.now()) {
      await this.complete(userId, sessionId);
      throw new ConflictException('Time expired. The session has been completed with the answers received.');
    }
    const question = session.questions.find((candidate) => candidate.id === questionId);
    if (!question) throw new NotFoundException('Practice question not found');
    if (session.answers.some((answer) => answer.questionId === questionId)) {
      throw new ConflictException('This Practice question has already been answered.');
    }

    const result = await this.exerciseService.answer(
      question.lessonId.toString(),
      question.exerciseId,
      userId,
      {
        optionId: input.optionId,
        text: input.text,
        responseTimeMs: input.responseTimeMs,
        sourceContext: 'practice',
      },
    );
    const previousCombo = session.answers.at(-1)?.combo ?? 0;
    const combo = result.correct ? previousCombo + 1 : 0;
    const pressure = session.mode === 'challenge' ? 1 + Math.floor(session.answers.length / 5) * 0.1 : 1;
    const points = result.correct
      ? Math.round((100 + Math.min(combo * 15, 150)) * pressure)
      : 0;
    const answer: PracticeAnswer = {
      questionId,
      skill: question.skill,
      prompt: question.prompt,
      correct: result.correct,
      selectedValue: result.selectedValue,
      correctValue: result.correctValue,
      responseTimeMs: input.responseTimeMs,
      points,
      combo,
      answeredAt: new Date(),
    };

    const updated = await this.sessionModel.findOneAndUpdate(
      {
        _id: session._id,
        userId: new Types.ObjectId(userId),
        status: 'active',
        'answers.questionId': { $ne: questionId },
      },
      {
        $push: { answers: answer },
        $inc: { score: points },
        $max: { maxCombo: combo },
      },
      { new: true },
    ).exec();
    if (!updated) throw new ConflictException('This answer was already recorded.');

    const complete = updated.answers.length >= updated.questions.length;
    const finalSession = complete ? await this.finish(updated) : updated;
    return {
      answer,
      progress: {
        answered: finalSession.answers.length,
        total: finalSession.questions.length,
        score: finalSession.score,
        combo,
        maxCombo: finalSession.maxCombo,
        complete: finalSession.status === 'completed',
      },
      ...(finalSession.status === 'completed' ? { session: this.sessionResponse(finalSession) } : {}),
    };
  }

  async complete(userId: string, sessionId: string) {
    const session = await this.findOwned(userId, sessionId);
    return this.sessionResponse(session.status === 'completed' ? session : await this.finish(session));
  }

  async overview(userId: string) {
    const sessions = await this.sessionModel
      .find({ userId: new Types.ObjectId(userId), status: 'completed' })
      .select('mode completedAt durationSeconds score xpAwarded answers questions.id')
      .sort({ completedAt: -1 })
      .lean()
      .exec();
    const now = new Date();
    const user = await this.userService.findById(userId);
    const timezone = user?.settings.tz ?? 'UTC';
    const todayKey = localDateString(now, timezone);
    const recent = sessions.slice(0, 5).map((session) => summaryFor(session));
    const answers = sessions.flatMap((session) => session.answers ?? []);
    const correct = answers.filter((answer) => answer.correct).length;
    const totalSeconds = sessions.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0);

    const skillStats = PRACTICE_SKILLS.map((skill) => {
      const skillAnswers = answers.filter((answer) => answer.skill === skill);
      const skillCorrect = skillAnswers.filter((answer) => answer.correct).length;
      return {
        skill,
        answered: skillAnswers.length,
        correct: skillCorrect,
        accuracy: percent(skillCorrect, skillAnswers.length),
      };
    });
    const dailyActivity = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(now.getTime() - (6 - index) * 86_400_000);
      const key = localDateString(day, timezone);
      const daySessions = sessions.filter((session) =>
        session.completedAt
          ? localDateString(new Date(session.completedAt), timezone) === key
          : false,
      );
      return {
        date: key,
        answered: daySessions.flatMap((session) => session.answers ?? []).length,
      };
    });
    const todayAnswers = sessions
      .filter((session) =>
        session.completedAt && localDateString(new Date(session.completedAt), timezone) === todayKey,
      )
      .flatMap((session) => session.answers ?? []);
    const dailyPlan = (['vocabulary', 'kanji', 'grammar', 'reading'] as PracticeSkill[]).map((skill) => {
      const target = skill === 'vocabulary' ? 5 : 3;
      return {
        skill,
        target,
        completed: Math.min(target, todayAnswers.filter((answer) => answer.skill === skill).length),
      };
    });

    const weakEvidence = await this.learnerItems.findWeakestForUser(userId, 8);
    const weakAreas = await this.describeWeakItems(weakEvidence);
    const personalBest = Math.max(
      0,
      ...sessions.filter((session) => session.mode === 'challenge').map((session) => session.score),
    );

    return {
      totals: {
        sessions: sessions.length,
        answered: answers.length,
        correct,
        accuracy: percent(correct, answers.length),
        practiceSeconds: totalSeconds,
      },
      today: {
        answered: todayAnswers.length,
        correct: todayAnswers.filter((answer) => answer.correct).length,
      },
      skillStats,
      dailyActivity,
      dailyPlan,
      weakAreas,
      recent,
      challengePersonalBest: personalBest,
      capabilities: {
        skills: [...PRACTICE_SKILLS],
        questionTypes: ['multipleChoice', 'wordReading'],
        levels: ['foundation', 'N5'],
      },
    };
  }

  /** Account-deletion cascade: Practice owns this collection. */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.sessionModel.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
  }

  private async findOwned(userId: string, sessionId: string): Promise<PracticeSessionDocument> {
    if (!Types.ObjectId.isValid(sessionId)) throw new NotFoundException('Practice session not found');
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!session) throw new NotFoundException('Practice session not found');
    return session;
  }

  private async finish(session: PracticeSessionDocument): Promise<PracticeSessionDocument> {
    const now = new Date();
    const endedAt = session.deadlineAt && now > session.deadlineAt ? session.deadlineAt : now;
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000),
    );
    const completed = await this.sessionModel.findOneAndUpdate(
      { _id: session._id, status: 'active' },
      { $set: { status: 'completed', completedAt: now, durationSeconds } },
      { new: true },
    ).exec();
    if (!completed) return (await this.sessionModel.findById(session._id).exec()) ?? session;

    if (completed.mode === 'challenge') {
      const user = await this.userService.findById(completed.userId.toString());
      const timezone = user?.settings.tz ?? 'UTC';
      // Read a bounded 36-hour window, then compare in the learner's timezone.
      // A UTC-midnight query would reset the "daily" award at the wrong time
      // for almost every learner outside UTC.
      const recentAwards = await this.sessionModel
        .find({
          _id: { $ne: completed._id },
          userId: completed.userId,
          mode: 'challenge',
          status: 'completed',
          completedAt: { $gte: new Date(now.getTime() - 36 * 3_600_000) },
          xpAwarded: { $gt: 0 },
        })
        .select('completedAt')
        .lean()
        .exec();
      const today = localDateString(now, timezone);
      const alreadyAwarded = recentAwards.some((row) =>
        row.completedAt ? localDateString(new Date(row.completedAt), timezone) === today : false,
      );
      if (!alreadyAwarded) {
        const correct = completed.answers.filter((answer) => answer.correct).length;
        const xp = Math.min(25, correct + (correct === completed.questions.length ? 5 : 0));
        if (xp > 0) {
          await this.userService.awardXp(completed.userId.toString(), xp);
          completed.xpAwarded = xp;
          await completed.save();
        }
      }
    }
    return completed;
  }

  private async describeWeakItems(rows: WeakItemEvidence[]) {
    if (rows.length === 0) return [];
    const refs = rows.map((row) => ({ kind: row.kind, id: row.id }) as ItemRef);
    const resolved = await this.contentService.resolveItemRefs(refs);
    const itemById = new Map(resolved.map((item) => [item.id, item]));
    return rows.map((row) => ({
      id: row.id.toString(),
      kind: row.kind,
      label: labelForItem(itemById.get(row.id.toString())),
      confidence: Math.round(row.confidence * 100),
      exposures: row.exposures,
      incorrect: row.incorrect,
      weakestFormat: weakestFormat(row),
    }));
  }

  private sessionResponse(session: PracticeSessionDocument) {
    const answeredIds = new Set(session.answers.map((answer) => answer.questionId));
    const accuracy = percent(
      session.answers.filter((answer) => answer.correct).length,
      session.answers.length,
    );
    return {
      id: session._id.toString(),
      mode: session.mode,
      status: session.status,
      questions: session.questions.map((question) => ({
        id: question.id,
        lessonId: question.lessonId.toString(),
        lessonTitle: question.lessonTitle,
        unit: question.unit,
        skill: question.skill,
        exerciseId: question.exerciseId,
        itemId: question.itemId,
        type: question.type,
        prompt: question.prompt,
        promptKind: question.promptKind,
        question: question.question,
        ...(question.options ? { options: question.options.map((option) => ({ id: option.id, value: option.value })) } : {}),
        answered: answeredIds.has(question.id),
      })),
      answers: session.answers.map((answer) => ({
        questionId: answer.questionId,
        skill: answer.skill,
        prompt: answer.prompt,
        correct: answer.correct,
        selectedValue: answer.selectedValue,
        correctValue: answer.correctValue,
        responseTimeMs: answer.responseTimeMs,
        points: answer.points,
        combo: answer.combo,
        answeredAt: answer.answeredAt.toISOString(),
      })),
      filters: session.filters,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      deadlineAt: session.deadlineAt?.toISOString() ?? null,
      timeLimitSeconds: session.timeLimitSeconds,
      score: session.score,
      maxCombo: session.maxCombo,
      xpAwarded: session.xpAwarded,
      durationSeconds: session.durationSeconds,
      metrics: {
        answered: session.answers.length,
        total: session.questions.length,
        correct: session.answers.filter((answer) => answer.correct).length,
        accuracy,
        mistakes: session.answers.filter((answer) => !answer.correct).length,
      },
    };
  }
}

type GeneratedEntry = {
  question: Question;
  lessonId: string;
  lessonTitle: string;
  unit: string;
};

function skillForLesson(lesson: LessonSummary): PracticeSkill {
  const unit = lesson.unit.toLowerCase();
  const title = lesson.title.toLowerCase();
  if (lesson.exerciseTypes.includes('wordReading')) return 'reading';
  if (unit.includes('grammar') || title.includes('grammar')) return 'grammar';
  if (unit.includes('kanji') || title.includes('kanji')) return 'kanji';
  if (unit.includes('hiragana') || unit.includes('katakana') || unit.includes('kana')) return 'reading';
  return 'vocabulary';
}

function skillForQuestion(question: Question): PracticeSkill {
  if (question.type === 'wordReading' || question.promptKind === 'wordReading' || question.promptKind === 'kana') return 'reading';
  if (question.promptKind === 'kanji') return 'kanji';
  if (question.promptKind === 'grammar') return 'grammar';
  return 'vocabulary';
}

function skillToContentKinds(skill: PracticeSkill): ('kana' | 'vocab' | 'grammar' | 'kanji')[] {
  if (skill === 'reading') return ['kana', 'vocab'];
  if (skill === 'vocabulary') return ['vocab'];
  return [skill];
}

function lessonMatchesLevel(lesson: LessonSummary, level: string): boolean {
  if (level === 'all') return true;
  const foundation = /hiragana|katakana|kana|marks/.test(lesson.unit.toLowerCase());
  return level === 'foundation' ? foundation : !foundation;
}

function orderLessons(
  lessons: LessonSummary[],
  skills: PracticeSkill[],
  weakLessonIds: Set<string>,
  seed: string,
): LessonSummary[] {
  const shuffled = deterministicShuffle(lessons, seed);
  const weak = shuffled.filter((lesson) => weakLessonIds.has(lesson.id));
  const rest = shuffled.filter((lesson) => !weakLessonIds.has(lesson.id));
  const ordered = [...weak, ...rest];
  const buckets = new Map(skills.map((skill) => {
    const matching = ordered.filter((lesson) => skillForLesson(lesson) === skill);
    // Typed recall is currently the second real generated format. Put one
    // wordReading lesson into the first round when the selected catalog has
    // one, so Mixed/Daily sessions do not silently collapse to all-MC.
    if (skill === 'reading') {
      matching.sort((a, b) =>
        (Number(weakLessonIds.has(b.id)) - Number(weakLessonIds.has(a.id))) ||
        (Number(b.exerciseTypes.includes('wordReading')) - Number(a.exerciseTypes.includes('wordReading'))),
      );
    }
    return [skill, matching];
  }));
  const output: LessonSummary[] = [];
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const skill of skills) {
      const next = buckets.get(skill)?.shift();
      if (next) {
        output.push(next);
        remaining = true;
      }
    }
  }
  return output;
}

function interleaveBySkill(entries: GeneratedEntry[], skills: PracticeSkill[]): GeneratedEntry[] {
  const buckets = new Map(skills.map((skill) => [skill, entries.filter((entry) => skillForQuestion(entry.question) === skill)]));
  const output: GeneratedEntry[] = [];
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const skill of skills) {
      const next = buckets.get(skill)?.shift();
      if (next) {
        output.push(next);
        remaining = true;
      }
    }
  }
  return output;
}

function deterministicShuffle<T>(values: T[], seed: string): T[] {
  return [...values]
    .map((value, index) => ({ value, order: hashNumber(`${seed}:${index}`) }))
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.value);
}

function attemptFor(sessionId: Types.ObjectId, lessonId: string): number {
  return hashNumber(`${sessionId.toString()}:${lessonId}`) % 10000;
}

function hashNumber(value: string): number {
  return Number.parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16);
}

function timeLimitFor(mode: PracticeMode, requested?: number): number | null {
  if (mode === 'challenge') return 3;
  if (mode === 'timed') return requested ?? 5;
  return null;
}

function percent(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function summaryFor(session: {
  _id: Types.ObjectId;
  mode: PracticeMode;
  completedAt: Date | null;
  durationSeconds: number | null;
  score: number;
  xpAwarded: number;
  answers: PracticeAnswer[];
  questions: PracticeQuestion[];
}) {
  const answers = session.answers ?? [];
  const correct = answers.filter((answer) => answer.correct).length;
  return {
    id: session._id.toString(),
    mode: session.mode,
    completedAt: session.completedAt?.toISOString() ?? null,
    answered: answers.length,
    total: session.questions.length,
    correct,
    accuracy: percent(correct, answers.length),
    durationSeconds: session.durationSeconds ?? 0,
    score: session.score,
    xpAwarded: session.xpAwarded,
  };
}

function labelForItem(item?: ResolvedItem): string {
  if (!item) return 'Course item';
  if (item.kind === 'kana') return `${item.kana} · ${item.romaji}`;
  if (item.kind === 'vocab') return `${item.lemma} · ${item.gloss}`;
  if (item.kind === 'kanji') return `${item.char} · ${item.meanings.join(', ')}`;
  return item.title;
}

function weakestFormat(row: WeakItemEvidence): string | null {
  const attempted = row.exerciseTypes.filter((stats) => stats.seen > 0);
  if (attempted.length === 0) return null;
  return [...attempted].sort((a, b) => (a.correct / a.seen) - (b.correct / b.seen))[0]?.type ?? null;
}

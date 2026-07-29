/**
 * The read-only slice of the langapp API this site uses.
 *
 * `GET /lessons` and `GET /lessons/:id` are unauthenticated on purpose — shared
 * reference content with no per-user state — so the curriculum browses without
 * a session. Everything that teaches (quizzes, completion, progress) is behind
 * a bearer token, with one refresh-and-retry on 401.
 *
 * Shapes mirror `api/src/content/dto/lesson-response.dto.ts`. Keep them in step
 * with the contract in the root CLAUDE.md.
 */

import { emitSessionExpired, getTokens, setTokens, type Tokens, type User } from './auth';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');

/**
 * The same base, for the one thing that does not go through `authed`: the
 * unauthenticated audio route, whose URL is handed to an `<audio>` element
 * rather than fetched here. Empty string when unset, so a misconfigured build
 * produces a dead play button rather than a `undefined/content/...` request.
 */
export const API_BASE = BASE_URL ?? '';

/** Matches the 10s budget the Expo client uses, for the same reason. */
const TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  // Declared and assigned rather than a constructor parameter property —
  // tsconfig has `erasableSyntaxOnly`, which forbids the shorthand.
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type LessonSummary = {
  id: string;
  lang: 'ja';
  unit: string;
  order: number;
  title: string;
  exerciseTypes: string[];
  itemCount: number;
  prerequisiteLessonIds: string[];
};

export type ResolvedItem =
  | {
      kind: 'kana';
      id: string;
      kana: string;
      romaji: string;
      script: string;
      row: string;
      order: number;
    }
  | {
      kind: 'vocab';
      id: string;
      lemma: string;
      reading: string;
      /** Latin script, present up to N4. */
      romaji?: string;
      gloss: string;
      pos: string;
      jlpt: string;
    }
  | {
      kind: 'grammar';
      id: string;
      title: string;
      jlpt: string;
      explanation: string;
      examples: { sentence: string; answer: string; romaji?: string; gloss: string }[];
    }
  | {
      kind: 'kanji';
      id: string;
      char: string;
      on: string[];
      kun: string[];
      meanings: string[];
      strokes: number;
    };

export type LessonDetail = LessonSummary & { items: ResolvedItem[] };

/** Nest's exception filter answers `{ message }` or `{ message: string[] }`. */
async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join('. ');
    if (body.message) return body.message;
  } catch {
    // Non-JSON body — a proxy error page, usually.
  }
  return `The server returned ${response.status}.`;
}

async function send<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError(
      'VITE_API_URL is not set. Copy .env.example to .env, point it at the API, and restart the dev server.',
      0,
    );
  }

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
      // The API runs on a laptop that sleeps. Without this the page hangs
      // forever behind a funnel that terminates TLS for a dead service.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(
      'Can’t reach the server. The API runs on a laptop — check that it’s awake, then try again.',
      0,
    );
  }

  if (!response.ok) throw new ApiError(await readError(response), response.status);
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

function get<T>(path: string): Promise<T> {
  return send<T>(path);
}

/** Every unit in one request — the site groups them client-side. */
export function fetchLessons(): Promise<LessonSummary[]> {
  return get<LessonSummary[]>('/lessons');
}

export function fetchLesson(id: string): Promise<LessonDetail> {
  return get<LessonDetail>(`/lessons/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Authenticated calls
// ---------------------------------------------------------------------------

/**
 * Shared across concurrent 401s.
 *
 * Refresh tokens **rotate** — presenting one consumes it. Five parallel
 * requests failing at once must therefore share a single refresh, or four of
 * them race to redeem a token that the winner already burned and the session
 * dies for no reason. The contract in the root CLAUDE.md calls this out
 * explicitly; this variable is the whole of the fix.
 */
let refreshInFlight: Promise<Tokens> | null = null;

function refresh(refreshToken: string): Promise<Tokens> {
  if (refreshInFlight) return refreshInFlight;

  const pending = (async () => {
    try {
      // `/auth/refresh` answers flat — not nested under `tokens`.
      const tokens = await send<Tokens>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      setTokens(tokens);
      return tokens;
    } finally {
      refreshInFlight = null;
    }
  })();

  refreshInFlight = pending;
  return pending;
}

/** One refresh-and-retry on 401, then the session is over. */
async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const tokens = getTokens();
  if (!tokens) {
    emitSessionExpired();
    throw new ApiError('Sign in to continue.', 401);
  }

  try {
    return await send<T>(path, init, tokens.accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;

    let renewed: Tokens;
    try {
      renewed = await refresh(tokens.refreshToken);
    } catch (refreshError) {
      // A refresh that failed because the server is unreachable is not an
      // expired session — keep the tokens so it recovers when it is back.
      if (refreshError instanceof ApiError && refreshError.status === 0) throw refreshError;
      emitSessionExpired();
      throw new ApiError('Your session expired. Sign in again.', 401);
    }

    try {
      return await send<T>(path, init, renewed.accessToken);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        emitSessionExpired();
        throw new ApiError('Your session expired. Sign in again.', 401);
      }
      throw retryError;
    }
  }
}

export type AuthResponse = { user: User; tokens: Tokens };

export function register(body: {
  email: string;
  password: string;
  displayName: string;
  /** ISO 'YYYY-MM-DD'. Required — the server's age gate refuses under-13s. */
  dateOfBirth: string;
  tz?: string;
}): Promise<AuthResponse> {
  return send<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) });
}

export function login(body: { email: string; password: string }): Promise<AuthResponse> {
  return send<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) });
}

/**
 * Answers the same way for a registered address and an unknown one, so the
 * message it returns must be shown verbatim — it is deliberately non-committal
 * and rewriting it into "check your email" would state something untrue.
 */
export function forgotPassword(email: string): Promise<{ message: string }> {
  return send<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** `code` is the six digits `/auth/forgot-password` wrote to the API's log. */
export function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ message: string }> {
  return send<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, newPassword }),
  });
}

export function fetchMe(): Promise<User> {
  return authed<User>('/me');
}

export type Progress = {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  streakDays: number;
  lastStudyDate: string | null;
  daily: {
    xpToday: number;
    goalXp: number;
    percentOfGoal: number;
    goalMet: boolean;
    /**
     * Counted on the user's local day (T1.8). Declared to keep this type an
     * honest mirror of the server's `ProgressResponse`; the site does not render
     * them yet — the header carries XP and streak, and a third metric would
     * crowd it. The app's home screen is where the daily summary lives.
     */
    reviewsDone: number;
    lessonsDone: number;
  };
  cardsDueNow: number;
  lessonsCompleted: number;
  completedLessonIds: string[];
};

export function fetchProgress(): Promise<Progress> {
  return authed<Progress>('/me/progress');
}

export type ExerciseOption = { id: string; value: string };
export type PromptKind = 'kana' | 'vocab' | 'grammar' | 'wordReading' | 'kanji';

/**
 * The content item behind the prompt — the same `id` `GET /lessons/:id` returns.
 * `exerciseId` is a position in a shuffle and changes between attempts, so this
 * is the only stable per-item handle. Sent for every `promptKind`; which prompts
 * can do anything with it is this surface's decision.
 */
type ItemId = string;

export type MultipleChoiceQuestion = {
  exerciseId: string;
  itemId: ItemId;
  type: 'multipleChoice';
  prompt: string;
  promptKind: PromptKind;
  question: string;
  options: ExerciseOption[];
};

/**
 * A typing question. The prompt is the word the learner reads; the answer is
 * the romaji they type. No options — the API never sends them for this
 * shape. The grader is exact-match with case + whitespace normalised.
 */
export type WordReadingQuestion = {
  exerciseId: string;
  itemId: ItemId;
  type: 'wordReading';
  prompt: string;
  promptKind: PromptKind;
  question: string;
};

export type SpeechQuestion = {
  exerciseId: string;
  itemId: ItemId;
  type: 'speech';
  prompt: string;
  promptKind: PromptKind;
  question: string;
};

export type Question = MultipleChoiceQuestion | WordReadingQuestion | SpeechQuestion;

/** An object wrapping the array, not a bare array. */
export type ExerciseSet = {
  lessonId: string;
  unit: string;
  title: string;
  attempt: number;
  questionCount: number;
  questions: Question[];
};

export type AnswerResult = {
  exerciseId: string;
  correct: boolean;
  /**
   * For multipleChoice: the id of the chosen option. For wordReading: an
   * empty string — the learner typed, they did not pick. The typed text is
   * in `selectedValue`.
   */
  selectedOptionId: string;
  /** The option's value for multipleChoice, or the typed text for wordReading. */
  selectedValue: string | null;
  /**
   * For multipleChoice: the id of the right option, so the screen can
   * highlight it. For wordReading: an empty string — the canonical romaji
   * is in `correctValue`.
   */
  correctOptionId: string;
  /** The right answer: an option value for multipleChoice, the romaji for wordReading. */
  correctValue: string;
  prompt: string;
};

export type CompleteResult = {
  lessonId: string;
  title: string;
  cardsCreated: number;
  cardsAlreadyPresent: number;
  xpAwarded: number;
  firstCompletion: boolean;
  totalXp: number;
};

export function fetchExercises(lessonId: string, attempt: number): Promise<ExerciseSet> {
  return authed<ExerciseSet>(
    `/lessons/${encodeURIComponent(lessonId)}/exercises?attempt=${attempt}`,
  );
}

/**
 * Send an answer. The body shape is dictated by the lesson's exercise type:
 *
 *   - `multipleChoice` — `{ optionId }`. The id comes from the option list in
 *     the question payload.
 *   - `wordReading` — `{ text }`. The romaji the learner typed, which the
 *     server will trim, lowercase and exact-match against the canonical form.
 *
 * The server enforces this — sending the wrong field is a 400 — so the
 * caller passes the right one for the question they are answering.
 */
export function answerExercise(
  lessonId: string,
  exerciseId: string,
  body: { optionId: string } | { text: string },
): Promise<AnswerResult> {
  return authed<AnswerResult>(
    `/lessons/${encodeURIComponent(lessonId)}/exercises/${encodeURIComponent(exerciseId)}/answer`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function completeLesson(lessonId: string): Promise<CompleteResult> {
  return authed<CompleteResult>(`/lessons/${encodeURIComponent(lessonId)}/complete`, {
    method: 'POST',
  });
}

/**
 * A checkpoint question. Structurally the same as a lesson `Question` — same
 * fields, same names — so the quiz card renders either without branching.
 *
 * `type` is a bare string rather than the `Question` union: the server sends
 * whatever exercise type the unit teaches, and a new plugin type must not make
 * this file fail to compile before anyone has decided how to draw it. The
 * screen falls back to "unsupported" for a type it does not know.
 */
export type CheckpointQuestion = {
  exerciseId: string;
  itemId: ItemId;
  type: string;
  prompt: string;
  promptKind: PromptKind;
  question: string;
  /** Absent for typed questions. */
  options?: ExerciseOption[];
};

export type CheckpointSet = {
  unit: string;
  attempt: number;
  questionCount: number;
  /** The fraction needed to pass. Read it; never hard-code 0.8 here. */
  passMark: number;
  questions: CheckpointQuestion[];
};

/** One item the learner got wrong, with its answer. Only present after submit. */
export type CheckpointMiss = {
  itemId: string;
  prompt: string;
  promptKind: PromptKind;
  correctValue: string;
  /** False when they never reached it — submitted early rather than answered wrong. */
  answered: boolean;
};

export type CheckpointResult = {
  unit: string;
  attempt: number;
  questionCount: number;
  correctCount: number;
  /** Fraction 0..1. */
  score: number;
  passMark: number;
  passed: boolean;
  xpAwarded: number;
  missed: CheckpointMiss[];
  scheduledForReview: number;
};

/**
 * Start the unit checkpoint, or resume the one already open.
 *
 * **Calling this twice does not produce two tests.** The server returns the
 * open attempt unchanged until it is submitted, which is what stops a learner
 * re-rolling for an easier draw — so this is safe to call on mount, and a
 * refresh mid-test lands back on the same questions.
 */
export function startCheckpoint(unit: string): Promise<CheckpointSet> {
  return authed<CheckpointSet>(`/units/${encodeURIComponent(unit)}/checkpoint`, {
    method: 'POST',
  });
}

/**
 * Answer one checkpoint question.
 *
 * Unlike `answerExercise`, the result's `correctValue` and `correctOptionId`
 * come back **empty** — a test does not show the answer while it is running.
 * They arrive at submit, in `missed`. Do not build a "remember this" panel out
 * of this response; it has nothing to put in one.
 *
 * `responseTimeMs` is sent because this is a timed test and the server's
 * confidence model weights answer speed. It is optional on the wire.
 */
export function answerCheckpoint(
  unit: string,
  attempt: number,
  exerciseId: string,
  body: ({ optionId: string } | { text: string }) & { responseTimeMs?: number },
): Promise<AnswerResult> {
  return authed<AnswerResult>(
    `/units/${encodeURIComponent(unit)}/checkpoint/${attempt}/answer/${encodeURIComponent(exerciseId)}`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

/**
 * Close the attempt and get the verdict.
 *
 * Idempotent: submitting again returns the same score with `xpAwarded: 0`, so
 * a retried request cannot pay out twice and does not need to be guarded here.
 */
export function submitCheckpoint(unit: string, attempt: number): Promise<CheckpointResult> {
  return authed<CheckpointResult>(
    `/units/${encodeURIComponent(unit)}/checkpoint/${attempt}/submit`,
    { method: 'POST' },
  );
}

export const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'] as const;
export type ReviewGrade = (typeof REVIEW_GRADES)[number];
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export type DueCard = {
  cardId: string;
  state: CardState;
  /** ISO 8601 — JSON has no Date, whatever the server's DTO says. */
  due: string;
  reps: number;
  lapses: number;
  item: ResolvedItem;
};

export type DueReviews = { count: number; totalDue: number; cap: number; cards: DueCard[] };

/**
 * Mirrors the server's `GradeReviewResponse`. The leak rule in the root
 * CLAUDE.md says FSRS internals (stability, difficulty) must not reach a
 * client; this type does not declare them, so they cannot be rendered.
 */
export type GradeResult = {
  cardId: string;
  grade: ReviewGrade;
  state: CardState;
  due: string;
  /** Minutes until the card returns — the number a learner cares about. */
  intervalMinutes: number;
  reps: number;
  lapses: number;
  xpAwarded: number;
  totalXp: number;
};

export function fetchDueReviews(): Promise<DueReviews> {
  return authed<DueReviews>('/reviews/due');
}

/**
 * XP is due-gated server-side: grading a card that was not actually due
 * reschedules it but awards nothing, so `xpAwarded` can legitimately be 0.
 */
export function gradeReview(cardId: string, grade: ReviewGrade): Promise<GradeResult> {
  return authed<GradeResult>(`/reviews/${encodeURIComponent(cardId)}/grade`, {
    method: 'POST',
    body: JSON.stringify({ grade }),
  });
}

/**
 * The server has no per-user attempt counter, so the client picks the seed.
 * Drawn once per run through a lesson — re-drawing mid-lesson would reshuffle
 * the questions and invalidate the exerciseIds already on screen.
 */
export function newAttempt(): number {
  return Math.floor(Math.random() * 10001);
}

/**
 * Display names and teaching order for unit slugs.
 *
 * Duplicated from `client/lib/lessons.ts` rather than shared: the two apps have
 * separate `node_modules` by design, and a shared package for ten labels would
 * cost more than it saves. If a third copy ever appears, extract it.
 *
 * **Both copies drifted on 2026-07-26** — four units were added to the seed and
 * neither list was updated, so they rendered as raw slugs and sorted wrongly.
 * Insertion order here *is* teaching order (`UNIT_ORDER` is `Object.keys`), so a
 * new unit has to go in the right slot, not just get appended.
 */
const UNIT_LABELS: Record<string, { label: string; ja: string; blurb: string }> = {
  'hiragana-basics': {
    label: 'Hiragana',
    ja: 'ひらがな',
    blurb: 'The 46 base characters, in the order the table reads.',
  },
  'katakana-basics': {
    label: 'Katakana',
    ja: 'カタカナ',
    blurb: 'The same table again, in the script used for loanwords.',
  },
  'vocab-basics': {
    label: 'First words',
    ja: 'たんご',
    blurb: 'Words you can read the day you finish the kana — nothing else.',
  },
  'hiragana-marks': {
    label: 'Hiragana marks',
    ja: 'だくてん',
    blurb: 'Dakuten, handakuten and yōon: three rules, not 58 new shapes.',
  },
  'katakana-marks': {
    label: 'Katakana marks',
    ja: 'ダクテン',
    blurb: 'The same three rules, applied to the second script.',
  },
  // `ja` here was 'とおぼこ' / 'トオボコ', which is not a Japanese word — it looks
  // like a slip from the T1.1 build. The marks have real names: 促音 そくおん is
  // the small tsu, 長音 ちょうおん the vowel-lengthening bar. Fixed 2026-07-26.
  // This site's own README calls confidently teaching wrong Japanese the
  // existential risk of the project (OPEN-ITEMS #8), and a unit heading is as
  // front-of-house as it gets.
  'hiragana-marks-extra': {
    label: 'Hiragana っ / ー',
    ja: 'そくおん',
    blurb: 'The doubling marks — pronounced by eating the next consonant or stretching the previous vowel.',
  },
  'katakana-marks-extra': {
    label: 'Katakana ッ / ー',
    ja: 'ちょうおん',
    blurb: 'Same marks, loanword-heavy words. The contrast with hiragana is the lesson.',
  },
  'vocab-everyday': {
    label: 'Everyday words',
    ja: 'にちじょう',
    blurb: '220 words the marks unlocked — food, family, travel, work, and the verbs you actually use.',
  },
  'grammar-basics': {
    label: 'First sentences',
    ja: 'ぶんぽう',
    blurb: 'Particles and polite endings — what turns words into sentences.',
  },
  'kanji-basics': {
    label: 'First kanji',
    ja: 'かんじ',
    blurb: 'Every character here writes a word you already know in kana. 山 is just やま.',
  },
  'vocab-n5': {
    label: 'Everything else at N5',
    ja: 'ごい',
    blurb: '512 more words — the ones that take the course to a full N5 vocabulary of 802.',
  },
};

const UNIT_ORDER = Object.keys(UNIT_LABELS);

export type Unit = {
  slug: string;
  label: string;
  ja: string;
  blurb: string;
  lessons: LessonSummary[];
  itemCount: number;
};

export function groupByUnit(lessons: LessonSummary[]): Unit[] {
  const bySlug = new Map<string, LessonSummary[]>();
  for (const lesson of lessons) {
    const existing = bySlug.get(lesson.unit);
    if (existing) existing.push(lesson);
    else bySlug.set(lesson.unit, [lesson]);
  }

  return [...bySlug.entries()]
    .map(([slug, unitLessons]) => ({
      slug,
      label: UNIT_LABELS[slug]?.label ?? slug,
      ja: UNIT_LABELS[slug]?.ja ?? '',
      blurb: UNIT_LABELS[slug]?.blurb ?? '',
      lessons: [...unitLessons].sort((a, b) => a.order - b.order),
      itemCount: unitLessons.reduce((total, lesson) => total + lesson.itemCount, 0),
    }))
    .sort((a, b) => rank(a.slug) - rank(b.slug));
}

function rank(slug: string): number {
  const index = UNIT_ORDER.indexOf(slug);
  return index === -1 ? UNIT_ORDER.length : index;
}

/**
 * Every lesson in teaching order, units included — the course as one list.
 *
 * `groupByUnit` already sorts units by `UNIT_ORDER` and lessons by `order`, so
 * flattening it is the whole of the ordering logic. Kept as its own function
 * because "what comes after this lesson" is asked from two places and getting
 * the order from a different route in each would be a way for them to disagree.
 */
export function inTeachingOrder(units: Unit[]): LessonSummary[] {
  return units.flatMap((unit) => unit.lessons);
}

/**
 * The lesson that follows `lessonId`, or null at the end of the course.
 *
 * Null is also the answer for a lesson that is not in the list at all, which is
 * the honest result: if we cannot place it, we cannot say what follows it.
 */
export function nextLessonAfter(units: Unit[], lessonId: string): LessonSummary | null {
  const all = inTeachingOrder(units);
  const index = all.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) return null;
  return all[index + 1] ?? null;
}

/**
 * The first lesson the learner has not completed — "you are here" on the home
 * page.
 *
 * Prerequisites are not consulted: the course is a straight line, so the first
 * uncompleted lesson in teaching order is by construction the one whose
 * prerequisites are satisfied. Null means everything is done.
 */
export function nextUnlearnedLesson(
  units: Unit[],
  completedLessonIds: string[],
): LessonSummary | null {
  const done = new Set(completedLessonIds);
  return inTeachingOrder(units).find((lesson) => !done.has(lesson.id)) ?? null;
}

// ---------------------------------------------------------------------------
// Social / Gamification
// ---------------------------------------------------------------------------

export type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  weeklyXp: number;
  isYou: boolean;
};

export type Leaderboard = {
  week: string;
  endsAt: string;
  tier: number;
  tierName: string;
  tierCount: number;
  rows: LeaderboardRow[];
  yourRank: number | null;
  promotionCount: number;
  relegationCount: number;
  optedIn: boolean;
};

export function fetchLeaderboard(): Promise<Leaderboard> {
  return authed<Leaderboard>('/social/leaderboard');
}

export type PublicProfile = {
  id: string;
  displayName: string;
  level: number;
  xp: number;
  streakDays: number;
};

export type FriendRequest = {
  requestId: string;
  from: PublicProfile;
};

export type DirectMessage = {
  id: string;
  text: string;
  mine: boolean;
  createdAt: string;
};

export function searchUsers(q: string): Promise<PublicProfile[]> {
  return authed<PublicProfile[]>(`/social/users?q=${encodeURIComponent(q)}`);
}

export function fetchFriends(): Promise<PublicProfile[]> {
  return authed<PublicProfile[]>('/social/friends');
}

export function fetchFriendRequests(): Promise<FriendRequest[]> {
  return authed<FriendRequest[]>('/social/friends/requests');
}

export function sendFriendRequest(userId: string): Promise<{ status: string }> {
  return authed<{ status: string }>(`/social/friends/requests/${encodeURIComponent(userId)}`, { method: 'POST' });
}

export function acceptRequest(requestId: string): Promise<{ status: string }> {
  return authed<{ status: string }>(`/social/friends/requests/${encodeURIComponent(requestId)}/accept`, { method: 'POST' });
}

export function declineRequest(requestId: string): Promise<{ status: string }> {
  return authed<{ status: string }>(`/social/friends/requests/${encodeURIComponent(requestId)}/decline`, { method: 'POST' });
}

export function removeFriend(userId: string): Promise<{ removed: boolean }> {
  return authed<{ removed: boolean }>(`/social/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export function fetchMessages(userId: string): Promise<DirectMessage[]> {
  return authed<DirectMessage[]>(`/social/messages/${encodeURIComponent(userId)}`);
}

export function sendMessage(userId: string, text: string): Promise<{ id: string; text: string; createdAt: string }> {
  return authed<{ id: string; text: string; createdAt: string }>(`/social/messages/${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// --- AI Chat ---

export interface Correction {
  span: string;
  fix: string;
  note: string;
}

export interface ChatMessageResponse {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  corrections: Correction[];
  createdAt: string;
}

export interface ChatSessionResponse {
  id: string;
  scenario: string;
  title: string;
  titleJa: string;
  startedAt: string;
  messages: ChatMessageResponse[];
}

export interface ChatTurnResponse {
  sessionId: string;
  corrections: Correction[];
  reply: ChatMessageResponse;
}

export async function createChatSession(scenario?: string): Promise<ChatSessionResponse> {
  const body = scenario ? { scenario } : {};
  return authed<ChatSessionResponse>('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function sendChatMessage(sessionId: string, text: string): Promise<ChatTurnResponse> {
  return authed<ChatTurnResponse>(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// --- Creator ---

export interface CreateLessonPayload {
  unit: string;
  order: number;
  title: string;
  itemRefs: { kind: 'vocab' | 'grammar' | 'kanji' | 'kana' | 'lesson'; id: string }[];
  exerciseTypes: string[];
  prerequisiteLessonIds: string[];
}

export interface CreateVocabPayload {
  lemma: string;
  reading: string;
  romaji: string;
  gloss: string;
  pos: string;
  jlpt?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  tags: string[];
}

export async function createLesson(payload: CreateLessonPayload): Promise<{ id: string; status: string }> {
  return authed<{ id: string; status: string }>('/creator/lessons', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createVocab(payload: CreateVocabPayload): Promise<{ id: string; status: string }> {
  return authed<{ id: string; status: string }>('/creator/vocab', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

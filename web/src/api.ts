/**
 * The read-only slice of the langapp API this site uses.
 *
 * `GET /lessons` and `GET /lessons/:id` are unauthenticated on purpose — shared
 * reference content with no per-user state — which is why the whole curriculum
 * browser works with no login, no token storage and no refresh dance. The
 * moment this site wants progress or reviews, that changes.
 *
 * Shapes mirror `api/src/content/dto/lesson-response.dto.ts`. Keep them in step
 * with the contract in the root CLAUDE.md.
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');

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
      examples: { sentence: string; answer: string; gloss: string }[];
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

async function get<T>(path: string): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError(
      'VITE_API_URL is not set. Copy .env.example to .env, point it at the API, and restart the dev server.',
      0,
    );
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
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

  if (!response.ok) {
    throw new ApiError(`The server returned ${response.status}.`, response.status);
  }

  return (await response.json()) as T;
}

/** Every unit in one request — the site groups them client-side. */
export function fetchLessons(): Promise<LessonSummary[]> {
  return get<LessonSummary[]>('/lessons');
}

export function fetchLesson(id: string): Promise<LessonDetail> {
  return get<LessonDetail>(`/lessons/${encodeURIComponent(id)}`);
}

/**
 * Display names and teaching order for unit slugs.
 *
 * Duplicated from `client/lib/lessons.ts` rather than shared: the two apps have
 * separate `node_modules` by design, and a shared package for six strings would
 * cost more than it saves. If a third copy ever appears, extract it.
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
  'grammar-basics': {
    label: 'First sentences',
    ja: 'ぶんぽう',
    blurb: 'Particles and polite endings — what turns words into sentences.',
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

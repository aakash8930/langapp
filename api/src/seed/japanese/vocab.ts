export interface VocabSeed {
  /** How the word is written at this level. See the note on orthography below. */
  lemma: string;
  /** Kana reading. Identical to `lemma` for every word in this unit, by design. */
  reading: string;
  gloss: string;
  pos: string;
}

export interface VocabLessonSeed {
  order: number;
  title: string;
  /** Keys into `VOCAB_GROUPS`. */
  groups: string[];
  exerciseTypes: string[];
}

/**
 * The first vocabulary unit — 58 words a beginner can *read on the day they
 * arrive*, which is the constraint that picked every one of them.
 *
 * ## Why these words and not the obvious ones
 *
 * A learner reaching this unit knows exactly the 92 characters seeded by the
 * two kana units: the base gojūon, and nothing else. No dakuten (が), no
 * handakuten (ぱ), no small kana (きゃ, がっこう), no chōonpu (コーヒー). So every
 * word here is spelled using only those 92 characters — a rule enforced by a
 * test, not by care.
 *
 * That rule is why some of the most common beginner words are missing, and the
 * absences are conspicuous: **たべる (to eat)** needs べ, **ありがとう (thank you)**
 * needs が, and **ください (please)** needs だ. So do みず (water), ともだち
 * (friend), がくせい (student), and every katakana loanword worth knowing — パン,
 * コーヒー, テレビ all need a handakuten, a dakuten, or a long mark. They belong
 * to the unit that teaches those marks, and putting them here would mean
 * shipping a lesson whose first card cannot be read.
 *
 * All three of those were in the first draft of this list. The test caught
 * them, which is the argument for the test.
 *
 * ## Orthography
 *
 * `lemma` and `reading` are identical throughout, and that is not a placeholder.
 * ねこ is a correct way to write 猫, and kana-only is how these words are
 * presented until kanji are taught. When the kanji unit lands, `lemma` gains the
 * kanji spelling and `reading` is already right — which is exactly why §5 keeps
 * the two fields apart.
 *
 * All N5. Grouped thematically rather than by frequency, because a lesson of
 * ten unrelated words is ten things to memorise while a lesson about people is
 * one.
 */
export const VOCAB_GROUPS: Record<string, VocabSeed[]> = {
  people: [
    { lemma: 'わたし', reading: 'わたし', gloss: 'I, me', pos: 'pronoun' },
    { lemma: 'あなた', reading: 'あなた', gloss: 'you', pos: 'pronoun' },
    { lemma: 'ひと', reading: 'ひと', gloss: 'person', pos: 'noun' },
    { lemma: 'おとこ', reading: 'おとこ', gloss: 'man', pos: 'noun' },
    { lemma: 'おんな', reading: 'おんな', gloss: 'woman', pos: 'noun' },
    { lemma: 'せんせい', reading: 'せんせい', gloss: 'teacher', pos: 'noun' },
    { lemma: 'なまえ', reading: 'なまえ', gloss: 'name', pos: 'noun' },
    // ちち and はは are the words for one's *own* parents — the humble forms.
    // Someone else's are おとうさん / おかあさん, which need marks not taught yet.
    { lemma: 'ちち', reading: 'ちち', gloss: 'my father', pos: 'noun' },
    { lemma: 'はは', reading: 'はは', gloss: 'my mother', pos: 'noun' },
    { lemma: 'いもうと', reading: 'いもうと', gloss: 'younger sister', pos: 'noun' },
  ],
  things: [
    { lemma: 'ほん', reading: 'ほん', gloss: 'book', pos: 'noun' },
    { lemma: 'くるま', reading: 'くるま', gloss: 'car', pos: 'noun' },
    { lemma: 'いえ', reading: 'いえ', gloss: 'house', pos: 'noun' },
    { lemma: 'みせ', reading: 'みせ', gloss: 'shop', pos: 'noun' },
    { lemma: 'とけい', reading: 'とけい', gloss: 'clock, watch', pos: 'noun' },
    { lemma: 'かさ', reading: 'かさ', gloss: 'umbrella', pos: 'noun' },
    { lemma: 'いす', reading: 'いす', gloss: 'chair', pos: 'noun' },
    { lemma: 'つくえ', reading: 'つくえ', gloss: 'desk', pos: 'noun' },
    { lemma: 'かみ', reading: 'かみ', gloss: 'paper', pos: 'noun' },
    { lemma: 'くつ', reading: 'くつ', gloss: 'shoes', pos: 'noun' },
  ],
  nature: [
    { lemma: 'やま', reading: 'やま', gloss: 'mountain', pos: 'noun' },
    { lemma: 'うみ', reading: 'うみ', gloss: 'sea', pos: 'noun' },
    { lemma: 'そら', reading: 'そら', gloss: 'sky', pos: 'noun' },
    { lemma: 'はな', reading: 'はな', gloss: 'flower', pos: 'noun' },
    { lemma: 'あめ', reading: 'あめ', gloss: 'rain', pos: 'noun' },
    { lemma: 'ゆき', reading: 'ゆき', gloss: 'snow', pos: 'noun' },
    { lemma: 'つき', reading: 'つき', gloss: 'moon', pos: 'noun' },
    { lemma: 'ほし', reading: 'ほし', gloss: 'star', pos: 'noun' },
    { lemma: 'あさ', reading: 'あさ', gloss: 'morning', pos: 'noun' },
    { lemma: 'よる', reading: 'よる', gloss: 'night', pos: 'noun' },
  ],
  verbs: [
    // Dictionary form throughout — the form a dictionary lists and the one
    // every other form is built from. Conjugation is the grammar unit's job.
    { lemma: 'のむ', reading: 'のむ', gloss: 'to drink', pos: 'verb' },
    // かう pairs with みせ from the previous lesson. It is here partly because
    // たべる, the verb you would expect, is unreadable at this level.
    { lemma: 'かう', reading: 'かう', gloss: 'to buy', pos: 'verb' },
    { lemma: 'みる', reading: 'みる', gloss: 'to see, to watch', pos: 'verb' },
    { lemma: 'きく', reading: 'きく', gloss: 'to listen, to ask', pos: 'verb' },
    { lemma: 'はなす', reading: 'はなす', gloss: 'to speak', pos: 'verb' },
    { lemma: 'よむ', reading: 'よむ', gloss: 'to read', pos: 'verb' },
    { lemma: 'かく', reading: 'かく', gloss: 'to write', pos: 'verb' },
    { lemma: 'いく', reading: 'いく', gloss: 'to go', pos: 'verb' },
    { lemma: 'くる', reading: 'くる', gloss: 'to come', pos: 'verb' },
    { lemma: 'する', reading: 'する', gloss: 'to do', pos: 'verb' },
  ],
  adjectives: [
    { lemma: 'おおきい', reading: 'おおきい', gloss: 'big', pos: 'adjective' },
    { lemma: 'ちいさい', reading: 'ちいさい', gloss: 'small', pos: 'adjective' },
    { lemma: 'たかい', reading: 'たかい', gloss: 'tall, expensive', pos: 'adjective' },
    { lemma: 'やすい', reading: 'やすい', gloss: 'cheap', pos: 'adjective' },
    { lemma: 'あつい', reading: 'あつい', gloss: 'hot', pos: 'adjective' },
    { lemma: 'さむい', reading: 'さむい', gloss: 'cold', pos: 'adjective' },
    { lemma: 'あたらしい', reading: 'あたらしい', gloss: 'new', pos: 'adjective' },
    { lemma: 'ふるい', reading: 'ふるい', gloss: 'old', pos: 'adjective' },
    { lemma: 'おいしい', reading: 'おいしい', gloss: 'delicious', pos: 'adjective' },
    { lemma: 'たのしい', reading: 'たのしい', gloss: 'fun, enjoyable', pos: 'adjective' },
  ],
  greetings: [
    { lemma: 'こんにちは', reading: 'こんにちは', gloss: 'hello, good afternoon', pos: 'expression' },
    { lemma: 'おはよう', reading: 'おはよう', gloss: 'good morning', pos: 'expression' },
    { lemma: 'おやすみ', reading: 'おやすみ', gloss: 'good night', pos: 'expression' },
    { lemma: 'さようなら', reading: 'さようなら', gloss: 'goodbye', pos: 'expression' },
    { lemma: 'すみません', reading: 'すみません', gloss: 'excuse me, sorry', pos: 'expression' },
    { lemma: 'はい', reading: 'はい', gloss: 'yes', pos: 'expression' },
    { lemma: 'いいえ', reading: 'いいえ', gloss: 'no', pos: 'expression' },
    // The casual half of よろしくおねがいします — the full phrase needs が.
    // Directly useful: the AI chat's first-meeting scenario opens with it.
    { lemma: 'よろしく', reading: 'よろしく', gloss: 'nice to meet you', pos: 'expression' },
  ],
};

export const VOCAB_UNIT = 'vocab-basics';

/**
 * Six lessons, one theme each. The greetings lesson is last but is the one that
 * pays off first — it is the vocabulary the AI chat scenario actually uses.
 */
export const VOCAB_LESSONS: VocabLessonSeed[] = [
  {
    order: 0,
    title: 'Words: people and family',
    groups: ['people'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 1,
    title: 'Words: things around you',
    groups: ['things'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 2,
    title: 'Words: nature and time',
    groups: ['nature'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 3,
    title: 'Words: everyday verbs',
    groups: ['verbs'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 4,
    title: 'Words: everyday adjectives',
    groups: ['adjectives'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 5,
    title: 'Words: greetings and everyday phrases',
    groups: ['greetings'],
    exerciseTypes: ['multipleChoice'],
  },
];

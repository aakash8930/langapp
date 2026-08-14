/** The character that marks the gap in an example sentence. */
export const BLANK = '＿';

export interface GrammarExampleSeed {
  /** The sentence, with exactly one ＿ where the answer belongs. */
  sentence: string;
  /** What fills the gap. */
  answer: string;
  /**
   * The **completed** sentence in latin script.
   *
   * This is where a kana table would betray you: は as a topic marker is `wa`
   * and を as an object marker is `o`, which is precisely what the lessons here
   * teach. Transliterating `sentence` character by character would print
   * `watashi ha sensei desu` and contradict lesson one.
   */
  romaji: string;
  /** English translation of the *completed* sentence. */
  gloss: string;
}

export interface GrammarSeed {
  /** 「は — topic marker」 — the form first, the label second. */
  title: string;
  explanation: string;
  examples: GrammarExampleSeed[];
  usage?: string;
  commonMistakes?: { mistake: string; correction: string; note: string }[];
}

export interface GrammarLessonSeed {
  order: number;
  title: string;
  /** Keys into `GRAMMAR_GROUPS`. */
  groups: string[];
  exerciseTypes: string[];
}

/**
 * The first grammar unit — 16 points that turn a pile of words into sentences.
 *
 * ## How these are quizzed, and what that required
 *
 * Fill in the blank: 「わたし＿せんせいです。」with は / を / に / の to choose
 * from. That tests *using* a particle, where matching a title to its definition
 * would only test having read the definition — and four explanations as options
 * is an unreadable question on a phone.
 *
 * It needs an example sentence, which §5's `GrammarPoint` has nowhere to put, so
 * the schema gains an `examples` array. That is the second documented departure
 * from §5 (the first is on `SrsCard`, OPEN-ITEMS #15). Approved before it was
 * made.
 *
 * **The English gloss is part of the question, not decoration.** 「わたしはいき＿。」
 * is grammatical with ます, ません *and* ました — only the gloss says which is
 * meant. Any fill-in-the-blank question about verb endings is undecidable
 * without it.
 *
 * ## The constraints on every sentence
 *
 * - **Only taught kana.** All 208 are available by the time a learner reaches
 *   here, but っ and ー are not (OPEN-ITEMS #25), so no sentence may use them.
 * - **Only words from the vocabulary unit**, in their taught dictionary form or
 *   a conjugation this unit teaches. A grammar lesson should be hard because of
 *   the grammar, not because half the sentence is unfamiliar.
 * - **Short.** Japanese does not space its words, and a beginner parses a long
 *   unspaced string badly. Every sentence here is three or four words, which is
 *   what makes the lack of spaces survivable.
 *
 * All three are enforced by `grammar.spec.ts` rather than trusted.
 *
 * ## Ordering
 *
 * Verbs come second, before their particles, because を / に / で have nothing
 * to attach to until there is a verb to attach them to. Noun-linking (の, も, と)
 * comes last: it is the least useful on its own and the easiest to bolt on.
 */
export const GRAMMAR_GROUPS: Record<string, GrammarSeed[]> = {
  being: [
    {
      title: 'です — to be (polite)',
      explanation:
        'Ends a polite sentence that says what something is. It carries the politeness, so it is what changes when you speak more or less formally — the noun in front of it never changes.',
      usage: 'Place it after a noun or adjective. です replaces だ (the casual form) in polite speech. In questions, add か (ですか). Never use です with verbs — verbs have their own polite endings (ます).',
      commonMistakes: [
        { mistake: 'わたしがせんせいです', correction: 'わたしはせんせいです', note: 'Use は (topic marker), not が, when stating what someone IS.' },
        { mistake: 'わたしせんせいです', correction: 'わたしはせんせいです', note: 'Don\'t drop the topic marker は — it\'s required in a full sentence.' },
      ],
      examples: [
        { sentence: 'わたしはせんせい＿。', answer: 'です', romaji: 'watashi wa sensei desu.', gloss: 'I am a teacher.' },
      ],
    },
    {
      title: 'は — topic marker',
      explanation:
        'Marks what the sentence is about — "as for this…". Written は but pronounced "wa" when it does this job, which is the single most common surprise in beginner Japanese.',
      usage: 'Placed right after the topic of the sentence. Pronounced "wa". Do not confuse with the hiragana は which reads "ha" in other words. In questions, keep は before か (…は…です+か).',
      commonMistakes: [
        { mistake: 'Pronouncing は as "ha"', correction: 'When は is a particle, say "wa"', note: 'は is only "ha" as part of a word like はな (flower). As a particle it\'s always "wa".' },
        { mistake: 'Using が instead of は for topics', correction: 'は marks the topic; が marks the subject', note: 'は = "as for X, ...". が = "X is the one who...". Use は for general statements.' },
      ],
      examples: [{ sentence: 'ちち＿せんせいです。', answer: 'は', romaji: 'chichi wa sensei desu.', gloss: 'My father is a teacher.' }],
    },
    {
      title: 'か — question marker',
      explanation:
        'Turns a statement into a question by being added to the end. Nothing else moves: the word order of a Japanese question is the word order of the statement.',
      usage: 'Add か at the very end of a polite sentence. The intonation rises naturally — no need to change word order like in English. For casual questions, drop か and just raise your tone.',
      commonMistakes: [
        { mistake: 'あなたはせんせいかですか', correction: 'あなたはせんせいですか', note: 'Don\'t stack か and です — です+か is correct, not X+か+です.' },
      ],
      examples: [{ sentence: 'あなたはせんせいです＿。', answer: 'か', romaji: 'anata wa sensei desu ka.', gloss: 'Are you a teacher?' }],
    },
    {
      title: 'ではありません — noun negative (polite)',
      explanation:
        'Negates a noun predicate. It replaces です outright — ではありません is the whole ending, not です with something bolted on.',
      usage: '[noun] + ではありません. Do not add です before or after it — ではありません already carries the politeness.',
      commonMistakes: [
        { mistake: 'せんせいですではありません', correction: 'せんせいではありません', note: 'ではありません replaces です completely; the two never appear together.' },
      ],
      examples: [{ sentence: 'あなたはせんせい＿。', answer: 'ではありません', romaji: 'anata wa sensei dewa arimasen.', gloss: 'You are not a teacher.' }],
    },
  ],
  verbs: [
    {
      title: 'ます — polite present',
      explanation:
        'The polite ending for something you do or will do. Japanese does not separate present from future — よみます is both "I read" and "I will read", and context decides.',
      usage: 'Attach ます to the verb stem (the part before ます in dictionary form). よむ → よみ+ます. For irregulars: する → し+ます, くる → き+ます. This is your default polite verb form.',
      commonMistakes: [
        { mistake: 'Using です with verbs', correction: 'よみます (NOT よむです)', note: 'です is for nouns/adjectives. Verbs use ます for politeness.' },
      ],
      examples: [{ sentence: 'わたしはほんをよみ＿。', answer: 'ます', romaji: 'watashi wa hon o yomimasu.', gloss: 'I read a book.' }],
    },
    {
      title: 'ません — polite negative',
      explanation:
        'The negative of ます. The verb itself does not change — only the ending does, which is why learning the endings is worth more than learning each verb twice.',
      usage: 'Replace ます with ません. よみます → よみません. For past negative: ませんでした. The verb stem stays the same — only the ending changes.',
      commonMistakes: [
        { mistake: 'よむません', correction: 'よみません', note: 'Always attach ません to the verb stem (よみ+ません), not the dictionary form.' },
      ],
      examples: [{ sentence: 'わたしはくるまをかい＿。', answer: 'ません', romaji: 'watashi wa kuruma o kaimasen.', gloss: 'I do not buy a car.' }],
    },
    {
      title: 'ました — polite past',
      explanation:
        'The past of ます. Same rule again: swap the ending, leave the verb alone.',
      usage: 'Replace ます with ました. いきます → いきました. For past negative: ませんでした. The verb stem stays the same.',
      commonMistakes: [
        { mistake: 'いきますでした', correction: 'いきました', note: 'Don\'t add でした after ます — directly replace ます with ました.' },
      ],
      examples: [{ sentence: 'わたしはうみにいき＿。', answer: 'ました', romaji: 'watashi wa umi ni ikimashita.', gloss: 'I went to the sea.' }],
    },
    {
      title: 'ませんでした — polite past negative',
      explanation:
        'The past of ません. Attach it to the same verb stem — でした comes after ません, not after ました, which is the mistake this ending invites.',
      usage: '[stem] + ませんでした. Contrast with ません (did not / will not) and ました (did).',
      commonMistakes: [
        { mistake: 'いきませんました', correction: 'いきませんでした', note: 'The ending is ませんでした — でした, not ました, follows ません.' },
      ],
      examples: [{ sentence: 'わたしはうみにいき＿。', answer: 'ませんでした', romaji: 'watashi wa umi ni ikimasen deshita.', gloss: 'I did not go to the sea.' }],
    },
  ],
  particles: [
    {
      title: 'を — object marker',
      explanation:
        'Marks the thing a verb is done to. Written を, pronounced "o" — it is the only job this character has, so meeting it means an object is in front of you.',
      usage: 'Placed between the object and the verb: [object] + を + [verb]. Pronounced "o" (not "wo"). Marks the direct object — the thing being eaten, read, bought.',
      commonMistakes: [
        { mistake: 'Pronouncing を as "wo"', correction: 'Pronounce it "o"', note: 'を is always pronounced "o". The "w" was lost centuries ago.' },
      ],
      examples: [{ sentence: 'わたしはほん＿よみます。', answer: 'を', romaji: 'watashi wa hon o yomimasu.', gloss: 'I read a book.' }],
    },
    {
      title: 'に — destination',
      explanation:
        'Marks where something is going, or when it happens. Pairs with movement verbs like いきます and きます.',
      usage: 'Place after the destination: [place/time] + に + [movement verb]. に can also mark a point in time (3時に, at 3 o\'clock).',
      commonMistakes: [
        { mistake: 'Confusing に and で for location', correction: 'に = destination/where you\'re going. で = where the action happens.', note: 'うみにいきます = go TO the sea. うみでおよぎます = swim AT the sea.' },
      ],
      examples: [{ sentence: 'わたしはうみ＿いきます。', answer: 'に', romaji: 'watashi wa umi ni ikimasu.', gloss: 'I go to the sea.' }],
    },
    {
      title: 'で — place of action',
      explanation:
        'Marks where an action happens — as opposed to に, which marks where it is heading. みせでかいます is buying at the shop; みせにいきます is going to it.',
      usage: 'Place after the location where the action occurs: [place] + で + [action verb]. Also used for means/method (ペンでかきます = write with a pen).',
      commonMistakes: [
        { mistake: 'Using に for action location', correction: 'みせでかいます (NOT みせにかいます)', note: 'に = going to. で = doing at. If there\'s movement, use に. If there\'s an action, use で.' },
      ],
      examples: [{ sentence: 'わたしはみせ＿かいます。', answer: 'で', romaji: 'watashi wa mise de kaimasu.', gloss: 'I buy it at the shop.' }],
    },
  ],
  linking: [
    {
      title: 'の — possessive',
      explanation:
        'Joins two nouns, with the first owning or describing the second. わたしのほん is my book; ほんのなまえ is the book’s title.',
      examples: [{ sentence: 'わたし＿ほんです。', answer: 'の', romaji: 'watashi no hon desu.', gloss: 'It is my book.' }],
    },
    {
      title: 'も — also',
      explanation:
        'Replaces は to mean "too". It does not sit next to は — it takes its place, which is why わたしもです is right and わたしはもです is not.',
      examples: [
        { sentence: 'いもうと＿せんせいです。', answer: 'も', romaji: 'imouto mo sensei desu.', gloss: 'My younger sister is also a teacher.' },
      ],
    },
    {
      title: 'と — and',
      explanation:
        'Joins nouns into a complete list — ほんとかみ is a book and paper, and nothing else. It does not join sentences.',
      examples: [
        { sentence: 'ほん＿かみをかいます。', answer: 'と', romaji: 'hon to kami o kaimasu.', gloss: 'I buy a book and paper.' },
      ],
    },
  ],
  /**
   * い-adjectives conjugate on their own ending — unlike nouns and な-adjectives,
   * they never touch です/ではありません for grammar, only for politeness. Ten
   * adjectives were seeded in `vocab.ts` and never used by a single grammar
   * point until now.
   */
  adjectives: [
    {
      title: 'くありません — い-adjective negative (polite)',
      explanation:
        'Negates an い-adjective. Drop the final い and add くありません — a completely different pattern from the ではありません a noun takes.',
      usage: '[adjective stem]+く + ありません. たかい → たかくありません. Never negate an い-adjective with ではありません — that pattern is for nouns only.',
      commonMistakes: [
        { mistake: 'たかいではありません', correction: 'たかくありません', note: 'い-adjectives drop い and take くありません, not ではありません — that ending is for nouns.' },
      ],
      examples: [{ sentence: 'くるまはたか＿。', answer: 'くありません', romaji: 'kuruma wa takaku arimasen.', gloss: 'The car is not expensive.' }],
    },
    {
      title: 'かったです — い-adjective past (polite)',
      explanation:
        'Puts an い-adjective in the past. Drop the final い and add かったです — the adjective itself carries the tense, not です.',
      usage: '[adjective stem]+かった + です. さむい → さむかったです. です here only adds politeness; かった alone is the casual past.',
      commonMistakes: [
        { mistake: 'さむいでした', correction: 'さむかったです', note: 'です does not carry past tense for an い-adjective — the adjective itself changes to かった.' },
      ],
      examples: [{ sentence: 'やまはさむ＿。', answer: 'かったです', romaji: 'yama wa samukatta desu.', gloss: 'The mountain was cold.' }],
    },
  ],
};

export const GRAMMAR_UNIT = 'grammar-basics';

export const GRAMMAR_LESSONS: GrammarLessonSeed[] = [
  {
    order: 0,
    title: 'Grammar: saying what something is',
    groups: ['being'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 1,
    title: 'Grammar: polite verbs',
    groups: ['verbs'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 2,
    title: 'Grammar: particles that go with verbs',
    groups: ['particles'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 3,
    title: 'Grammar: joining nouns',
    groups: ['linking'],
    exerciseTypes: ['multipleChoice'],
  },
  {
    order: 4,
    title: 'Grammar: describing things with adjectives',
    groups: ['adjectives'],
    exerciseTypes: ['multipleChoice'],
  },
];

import type { GrammarLessonSeed, GrammarSeed } from './grammar';

/**
 * The first N4 grammar unit — 16 points that move past N5's sentence
 * fundamentals into connected, opinionated speech: the て-form and what it
 * attaches to, wanting and being able to do things, giving a reason,
 * softening a claim with an opinion, and a first conditional.
 *
 * ## Why this unit does not repeat `grammar.spec.ts`'s strictest checks
 *
 * The N5 unit enforces that every example sentence is buildable from *only*
 * the kana and vocabulary taught so far in the course — a "readable on day
 * one" constraint that is the whole design of that unit (see `grammar.ts`'s
 * header). That constraint does not carry forward here for a structural
 * reason, not a laziness one: N4 grammar is built on **verb conjugation**
 * (て-form, ない-form, た-form, the ます-stem), and those forms do not reduce
 * to "the lemma, or the lemma minus its last character" the way N5's
 * `VOCAB_STEMS` slicing assumes — よむ becomes よんで, かう becomes かって, いく
 * becomes the irregular いって. A mechanical reduction test built for
 * unconjugated vocabulary would either reject every correct sentence here or
 * have to reimplement a real Japanese conjugator, which is out of scope for
 * a seed-time content check.
 *
 * What *does* carry forward, and is enforced exactly as it is for N5:
 *
 *   - Every word used is one the N5 or N4 vocabulary packs actually teach —
 *     checked by hand against `vocab.ts`, the N5-everyday/N5 packs and
 *     `vocab-n4.ts` while this file was written, the same way `grammar.ts`'s
 *     comment records having caught unreadable words before.
 *   - Every example's romaji is checked **mechanically** against the shared
 *     transliterator in `romaji.spec.ts` (this file's examples are folded
 *     into that spec's `ALL_EXAMPLES`), which does catch a mistyped
 *     conjugation — it does not know what よんで "means", but it knows
 *     whether the kana produces that string.
 *   - No duplicate titles or answers, one blank per example, a gloss on
 *     every example (load-bearing here too: 「くつをかい＿。」 is completed by
 *     both たいです and ました, and only the gloss says which is meant).
 *
 * All checked in `grammar-n4.spec.ts`.
 */
export const GRAMMAR_N4_GROUPS: Record<string, GrammarSeed[]> = {
  te_form: [
    {
      title: 'ています — ongoing action or state',
      explanation:
        'Attaches to a verb\'s て-form to describe an action in progress or an ongoing state — "is doing" rather than "does".',
      usage: '[て-form] + います. よむ → よんで, かく → かいて. Irregulars: いく → いって.',
      commonMistakes: [
        { mistake: 'ほんをよみている', correction: 'ほんをよんでいます', note: 'いる/います attaches to the て-form (よんで), not the ます-stem (よみ).' },
      ],
      examples: [{ sentence: 'ほんをよん＿。', answer: 'でいます', romaji: 'hon o yonde imasu.', gloss: 'I am reading a book.' }],
    },
    {
      title: 'てもいい — permission',
      explanation:
        'Attaches to the て-form to ask for or grant permission — "may I…?" or "you may…".',
      usage: '[て-form] + もいいです. Add か to turn it into a question.',
      commonMistakes: [
        { mistake: 'かさをかうもいいですか', correction: 'かさをかってもいいですか', note: 'もいい attaches to the て-form (かって), not the dictionary form (かう).' },
      ],
      examples: [{ sentence: 'かさをかっ＿か。', answer: 'てもいいです', romaji: 'kasa o kattemo ii desu ka.', gloss: 'May I buy an umbrella?' }],
    },
    {
      title: 'てはいけない — prohibition',
      explanation:
        'Attaches to the て-form to forbid an action — "must not…". The polite form is てはいけません.',
      usage: '[て-form] + はいけません. Stronger and more direct than simply saying ません.',
      commonMistakes: [
        { mistake: 'うみにいくはいけません', correction: 'うみにいってはいけません', note: 'はいけません attaches to the て-form (いって), not the dictionary form (いく).' },
      ],
      examples: [{ sentence: 'うみにいっ＿。', answer: 'てはいけません', romaji: 'umi ni ittewa ikemasen.', gloss: 'You must not go to the sea.' }],
    },
    {
      title: 'てください — polite request',
      explanation: 'Attaches to the て-form to make a polite request — "please do…".',
      usage: '[て-form] + ください.',
      commonMistakes: [
        { mistake: 'なまえをかきください', correction: 'なまえをかいてください', note: 'ください attaches to the て-form (かいて), not the ます-stem (かき).' },
      ],
      examples: [{ sentence: 'なまえをかい＿。', answer: 'てください', romaji: 'namae o kaite kudasai.', gloss: 'Please write your name.' }],
    },
  ],
  desire_ability: [
    {
      title: 'たい — want to',
      explanation:
        'Attaches to a verb\'s ます-stem to say "want to do" something. たい itself then conjugates like an い-adjective.',
      usage: '[ます-stem] + たいです. かう → かい + たいです.',
      commonMistakes: [
        { mistake: 'くつをかいますたいです', correction: 'くつをかいたいです', note: 'たい replaces ます entirely — attach it straight to the stem (かい).' },
      ],
      examples: [{ sentence: 'くつをかい＿。', answer: 'たいです', romaji: 'kutsu o kaitai desu.', gloss: 'I want to buy shoes.' }],
    },
    {
      title: 'ことができる — ability',
      explanation:
        'Attaches to a verb\'s plain dictionary form to express ability — "can do X". A regular way to state potential without conjugating the verb itself.',
      usage: '[dictionary form] + ことができます.',
      commonMistakes: [
        { mistake: 'はなすをことができます', correction: 'はなすことができます', note: 'No を between the dictionary-form verb and こと — こと directly follows the verb.' },
      ],
      examples: [{ sentence: 'はなす＿。', answer: 'ことができます', romaji: 'hanasu koto ga dekimasu.', gloss: 'I can speak.' }],
    },
    {
      title: 'なければならない — obligation',
      explanation:
        'Built on a verb\'s ない-form (drop the final い) to express obligation — "must do X".',
      usage: '[ない-form stem] + ければなりません. いく → いかない → いかなければなりません.',
      commonMistakes: [
        { mistake: 'いえにいくなければなりません', correction: 'いえにいかなければなりません', note: 'なければならない attaches to the negative stem (いかな), not the dictionary form (いく).' },
      ],
      examples: [{ sentence: 'いえにいかな＿。', answer: 'ければなりません', romaji: 'ie ni ikanakereba narimasen.', gloss: 'I must go home.' }],
    },
    {
      title: 'たほうがいい — advice',
      explanation:
        'Attaches to a verb\'s plain past (た-form) to give advice about a specific action — "you had better do X".',
      usage: '[た-form] + ほうがいいです. みる → みた + ほうがいいです.',
      commonMistakes: [
        { mistake: 'ほしをみるほうがいいです', correction: 'ほしをみたほうがいいです', note: 'ほうがいい attaches to the past た-form (みた) when giving advice about a specific action, not the dictionary form.' },
      ],
      examples: [{ sentence: 'ほしをみ＿。', answer: 'たほうがいいです', romaji: 'hoshi o mita hou ga ii desu.', gloss: 'You had better watch the stars.' }],
    },
  ],
  reason_contrast: [
    {
      title: 'から — reason',
      explanation: 'Attaches after a plain-form clause to state a reason — "because X, Y".',
      usage: '[reason]から、[result]。',
      commonMistakes: [
        { mistake: 'やすいのでから、かいます', correction: 'やすいから、かいます', note: 'から and ので both mean "because" — never combine them.' },
      ],
      examples: [{ sentence: 'やすい＿、かいます。', answer: 'から', romaji: 'yasui kara, kaimasu.', gloss: "Because it's cheap, I'll buy it." }],
    },
    {
      title: 'ので — reason (softer)',
      explanation:
        'Like から but softer and more objective in tone — common in polite explanations.',
      usage: '[reason]ので、[result]。',
      commonMistakes: [
        { mistake: 'たかいですのでから', correction: 'たかいので', note: 'ので already means "because" on its own — do not add から after it.' },
      ],
      examples: [{ sentence: 'たかい＿、かいません。', answer: 'ので', romaji: 'takai node, kaimasen.', gloss: "Since it's expensive, I won't buy it." }],
    },
    {
      title: 'けど — but, although',
      explanation:
        'A casual contrast particle placed at the end of a clause — softer and more common in speech than が.',
      usage: '[clause]けど、[contrasting clause]。',
      commonMistakes: [
        { mistake: 'たかいですがけど', correction: 'たかいけど', note: 'が and けど both mean "but" — do not stack them.' },
      ],
      examples: [{ sentence: 'たかい＿、かいます。', answer: 'けど', romaji: 'takai kedo, kaimasu.', gloss: "It's expensive, but I'll buy it." }],
    },
    {
      title: 'と思う — stating an opinion',
      explanation: 'Attaches after a plain-form clause to report an opinion or guess — "I think that…".',
      usage: '[plain-form clause] + とおもいます. Even in a polite sentence, the clause before と stays plain: だ, not です.',
      commonMistakes: [
        { mistake: 'あめですとおもいます', correction: 'あめだとおもいます', note: 'とおもいます attaches to the plain form (だ), not the polite です.' },
      ],
      examples: [{ sentence: 'あしたはあめだ＿。', answer: 'とおもいます', romaji: 'ashita wa ame da to omoimasu.', gloss: 'I think it will rain tomorrow.' }],
    },
  ],
  manner_degree: [
    {
      title: 'すぎる — too much',
      explanation: 'Attaches to an い-adjective stem (drop the final い) to mean "too much, excessively".',
      usage: '[adjective stem] + すぎます. たかい → たか + すぎます.',
      commonMistakes: [
        { mistake: 'くるまはたかいすぎます', correction: 'くるまはたかすぎます', note: 'すぎる attaches to the adjective stem (たか), dropping the final い, not to the full adjective.' },
      ],
      examples: [{ sentence: 'くるまはたか＿。', answer: 'すぎます', romaji: 'kuruma wa takasugimasu.', gloss: 'The car is too expensive.' }],
    },
    {
      title: 'やすい — easy to do',
      explanation:
        'Attaches to a verb\'s ます-stem to mean "easy to do". The opposite, にくい, means "hard to do".',
      usage: '[ます-stem] + やすいです. よむ → よみ + やすいです.',
      commonMistakes: [
        { mistake: 'ほんはよむやすいです', correction: 'ほんはよみやすいです', note: 'やすい attaches to the ます-stem (よみ), not the dictionary form (よむ).' },
      ],
      examples: [{ sentence: 'ほんはよみ＿。', answer: 'やすいです', romaji: 'hon wa yomiyasui desu.', gloss: 'The book is easy to read.' }],
    },
    {
      title: 'たら — conditional',
      explanation:
        'Attaches after a verb or adjective\'s plain past (た-form) to mean "if/when X happens, Y" — one of the most flexible conditionals in Japanese.',
      usage: '[た-form] + ら、[result]。 さむい → さむかった → さむかったら.',
      commonMistakes: [
        { mistake: 'さむいたら、いきません', correction: 'さむかったら、いきません', note: 'たら attaches after the plain past form (さむかった), not the plain present (さむい).' },
      ],
      examples: [{ sentence: 'さむかっ＿、いきません。', answer: 'たら', romaji: 'samukattara, ikimasen.', gloss: "If it's cold, I won't go." }],
    },
    {
      title: 'ながら — simultaneous actions',
      explanation:
        'Attaches to a verb\'s ます-stem to link two actions happening at the same time, done by the same person — "while doing X, do Y".',
      usage: '[ます-stem] + ながら、[main action]。',
      commonMistakes: [
        { mistake: 'きくながら、はなします', correction: 'ききながら、はなします', note: 'ながら attaches to the ます-stem (きき), not the dictionary form (きく).' },
      ],
      examples: [{ sentence: 'はなし＿、ききます。', answer: 'ながら', romaji: 'hanashinagara, kikimasu.', gloss: 'I listen while speaking.' }],
    },
  ],
};

export const GRAMMAR_N4_UNIT = 'grammar-n4';

export const GRAMMAR_N4_LESSONS: GrammarLessonSeed[] = [
  { order: 0, title: 'N4 grammar: the て-form at work', groups: ['te_form'], exerciseTypes: ['multipleChoice'] },
  { order: 1, title: 'N4 grammar: wanting and being able to', groups: ['desire_ability'], exerciseTypes: ['multipleChoice'] },
  { order: 2, title: 'N4 grammar: reasons and contrast', groups: ['reason_contrast'], exerciseTypes: ['multipleChoice'] },
  { order: 3, title: 'N4 grammar: degree and conditionals', groups: ['manner_degree'], exerciseTypes: ['multipleChoice'] },
];

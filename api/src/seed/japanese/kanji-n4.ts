import type { KanjiSeed, KanjiLessonSeed } from './kanji';

/**
 * The first N4 kanji unit — 84 characters, built the same way `kanji.ts`
 * built the N5 unit: every character writes a word the course already
 * teaches, so this is a re-reading of known vocabulary rather than a
 * memorisation slog of unattached glyphs.
 *
 * ## Where the words come from
 *
 * Two sources, both already seeded by the time this unit is reached:
 *
 *   - `vocab-n4.ts` — words this pack itself introduced (きんむ, かんたん…).
 *   - The N5 packs — common words the N5 vocabulary already taught in kana
 *     (つよい, おもう, いろ…) that happen to be written with an N4-level
 *     kanji in real orthography. 強い was always "strong", `vocab-n5.ts` just
 *     taught it as つよい; this unit is where it gets its kanji.
 *
 * `kanji-n4.spec.ts` checks every `writes` entry against the union of both,
 * the same discipline `kanji.spec.ts` applies to the N5 unit alone.
 *
 * ## Scope
 *
 * Real N4 kanji lists run to roughly 170 characters. This is a first pack —
 * the same relationship `kanji.ts` (104) has to the full N5 kanji list, and
 * the same relationship `vocab-n4.ts` has to the full N4 word list. Extend
 * it the same way those were extended, not by rewriting it.
 */
export const KANJI_N4_GROUPS: Record<string, KanjiSeed[]> = {
  verbs: [
    { char: '使', on: ['シ'], kun: ['つか.う'], meanings: ['to use'], strokes: 8, radical: '人', writes: ['つかう'] },
    { char: '思', on: ['シ'], kun: ['おも.う'], meanings: ['to think'], strokes: 9, radical: '心', writes: ['おもう'] },
    { char: '知', on: ['チ'], kun: ['し.る'], meanings: ['to know'], strokes: 8, radical: '矢', writes: ['しる', 'しらせる'] },
    { char: '持', on: ['ジ'], kun: ['も.つ'], meanings: ['to hold, to have'], strokes: 9, radical: '手', writes: ['もつ', 'きぶん'] },
    { char: '選', on: ['セン'], kun: ['えら.ぶ'], meanings: ['to choose, to select'], strokes: 15, radical: '辵', writes: ['えらぶ'] },
    { char: '比', on: ['ヒ'], kun: ['くら.べる'], meanings: ['to compare', 'ratio'], strokes: 4, radical: '比', writes: ['くらべる'] },
    { char: '変', on: ['ヘン'], kun: ['か.わる'], meanings: ['to change', 'strange'], strokes: 9, radical: '夂', writes: ['かわる'] },
    { char: '育', on: ['イク'], kun: ['そだ.てる', 'そだ.つ'], meanings: ['to raise', 'to grow up'], strokes: 8, radical: '月', writes: ['そだてる', 'そだつ'] },
    { char: '守', on: ['シュ', 'ス'], kun: ['まも.る'], meanings: ['to protect', 'to keep'], strokes: 6, radical: '宀', writes: ['まもる'] },
    { char: '許', on: ['キョ'], kun: ['ゆる.す'], meanings: ['to forgive', 'to permit'], strokes: 11, radical: '言', writes: ['ゆるす'] },
    { char: '続', on: ['ゾク'], kun: ['つづ.ける', 'つづ.く'], meanings: ['to continue'], strokes: 13, radical: '糸', writes: ['つづける'] },
  ],
  descriptions: [
    { char: '太', on: ['タイ', 'タ'], kun: ['ふと.る', 'ふと.い'], meanings: ['fat', 'thick'], strokes: 4, radical: '大', writes: ['ふとる'] },
    { char: '似', on: ['ジ'], kun: ['に.る'], meanings: ['to resemble'], strokes: 7, radical: '人', writes: ['にる'] },
    { char: '強', on: ['キョウ'], kun: ['つよ.い'], meanings: ['strong'], strokes: 11, radical: '弓', writes: ['つよい'] },
    { char: '弱', on: ['ジャク'], kun: ['よわ.い'], meanings: ['weak'], strokes: 10, radical: '弓', writes: ['よわい'] },
    { char: '広', on: ['コウ'], kun: ['ひろ.い'], meanings: ['wide, spacious'], strokes: 5, radical: '广', writes: ['ひろい'] },
    { char: '重', on: ['ジュウ', 'チョウ'], kun: ['おも.い'], meanings: ['heavy', 'important'], strokes: 9, radical: '里', writes: ['おもい', 'たいじゅう'] },
    { char: '軽', on: ['ケイ'], kun: ['かる.い'], meanings: ['light (weight)'], strokes: 12, radical: '車', writes: ['かるい'] },
    { char: '速', on: ['ソク'], kun: ['はや.い'], meanings: ['fast, quick'], strokes: 10, radical: '辵', writes: ['はやい'] },
    { char: '若', on: ['ジャク', 'ニャク'], kun: ['わか.い'], meanings: ['young'], strokes: 8, radical: '艸', writes: ['わかい'] },
    { char: '静', on: ['セイ', 'ジョウ'], kun: ['しず.か'], meanings: ['quiet, still'], strokes: 14, radical: '青', writes: ['しずか'] },
    { char: '親', on: ['シン'], kun: ['おや', 'した.しい'], meanings: ['parent', 'intimate'], strokes: 16, radical: '見', writes: ['しんせつ'] },
    { char: '切', on: ['セツ'], kun: ['き.る'], meanings: ['to cut', 'kind'], strokes: 4, radical: '刀', writes: ['しんせつ'] },
  ],
  reasons_results: [
    { char: '理', on: ['リ'], kun: [], meanings: ['reason', 'logic'], strokes: 11, radical: '玉', writes: ['りゆう'] },
    { char: '由', on: ['ユ', 'ユウ'], kun: ['よし'], meanings: ['reason', 'cause'], strokes: 5, radical: '田', writes: ['りゆう'] },
    { char: '全', on: ['ゼン'], kun: ['まった.く'], meanings: ['whole, entire'], strokes: 6, radical: '入', writes: ['ぜんぜん', 'あんぜん'] },
    { char: '然', on: ['ゼン', 'ネン'], kun: [], meanings: ['thus, so'], strokes: 12, radical: '火', writes: ['ぜんぜん'] },
    { char: '原', on: ['ゲン'], kun: ['はら'], meanings: ['origin', 'field'], strokes: 10, radical: '厂', writes: ['げんいん'] },
    { char: '因', on: ['イン'], kun: ['よ.る'], meanings: ['cause'], strokes: 6, radical: '囗', writes: ['げんいん'] },
    { char: '関', on: ['カン'], kun: ['せき', 'かか.わる'], meanings: ['related to', 'barrier'], strokes: 14, radical: '門', writes: ['かんけい'] },
    { char: '成', on: ['セイ', 'ジョウ'], kun: ['な.る'], meanings: ['to become, to succeed'], strokes: 6, radical: '戈', writes: ['せいこう', 'かんせい'] },
    { char: '功', on: ['コウ', 'ク'], kun: [], meanings: ['achievement, success'], strokes: 5, radical: '力', writes: ['せいこう'] },
    { char: '失', on: ['シツ'], kun: ['うしな.う'], meanings: ['to lose'], strokes: 5, radical: '大', writes: ['しっぱい'] },
  ],
  work_records: [
    { char: '受', on: ['ジュ'], kun: ['う.ける'], meanings: ['to receive'], strokes: 8, radical: '又', writes: ['うけつけ'] },
    { char: '料', on: ['リョウ'], kun: [], meanings: ['fee', 'materials'], strokes: 10, radical: '斗', writes: ['りょうきん'] },
    { char: '注', on: ['チュウ'], kun: ['そそ.ぐ'], meanings: ['to pour', 'to note'], strokes: 8, radical: '水', writes: ['ちゅうもん', 'ちゅうしゃ'] },
    { char: '記', on: ['キ'], kun: ['しる.す'], meanings: ['to record'], strokes: 10, radical: '言', writes: ['きろく'] },
    { char: '録', on: ['ロク'], kun: [], meanings: ['record'], strokes: 16, radical: '金', writes: ['きろく'] },
    { char: '院', on: ['イン'], kun: [], meanings: ['institution'], strokes: 10, radical: '阜', writes: ['たいいん', 'にゅういん'] },
    { char: '治', on: ['チ', 'ジ'], kun: ['なお.る', 'おさ.める'], meanings: ['to cure', 'to govern'], strokes: 8, radical: '水', writes: ['ちりょう'] },
    { char: '身', on: ['シン'], kun: ['み'], meanings: ['body, oneself'], strokes: 7, radical: '身', writes: ['しんちょう'] },
    { char: '特', on: ['トク'], kun: [], meanings: ['special'], strokes: 10, radical: '牛', writes: ['とくに', 'とくちょう', 'とくべつ', 'とっきゅう'] },
    { char: '急', on: ['キュウ'], kun: ['いそ.ぐ'], meanings: ['urgent', 'sudden'], strokes: 9, radical: '心', writes: ['きゅうこう', 'とっきゅう', 'きゅうに'] },
  ],
  town_directions: [
    { char: '近', on: ['キン'], kun: ['ちか.い'], meanings: ['near'], strokes: 7, radical: '辵', writes: ['ちかい', 'ちかみち'] },
    { char: '遠', on: ['エン'], kun: ['とお.い'], meanings: ['far'], strokes: 13, radical: '辵', writes: ['とおい', 'とおまわり'] },
    { char: '回', on: ['カイ'], kun: ['まわ.る'], meanings: ['times, to turn'], strokes: 6, radical: '囗', writes: ['とおまわり'] },
    { char: '必', on: ['ヒツ'], kun: ['かなら.ず'], meanings: ['certainly, must'], strokes: 5, radical: '心', writes: ['かならず'] },
    { char: '計', on: ['ケイ'], kun: ['はか.る'], meanings: ['to measure', 'plan'], strokes: 9, radical: '言', writes: ['とけい'] },
    { char: '色', on: ['シキ', 'ショク'], kun: ['いろ'], meanings: ['color'], strokes: 6, radical: '色', writes: ['いろ'] },
    { char: '段', on: ['ダン'], kun: [], meanings: ['step, level'], strokes: 9, radical: '殳', writes: ['だんだん'] },
    { char: '習', on: ['シュウ'], kun: ['なら.う'], meanings: ['to learn, to practice'], strokes: 11, radical: '羽', writes: ['しゅうかん'] },
    { char: '慣', on: ['カン'], kun: ['な.れる'], meanings: ['to get used to'], strokes: 14, radical: '心', writes: ['しゅうかん'] },
    { char: '外', on: ['ガイ', 'ゲ'], kun: ['そと'], meanings: ['outside'], strokes: 5, radical: '夕', writes: ['がいこく'] },
    { char: '国', on: ['コク'], kun: ['くに'], meanings: ['country'], strokes: 8, radical: '囗', writes: ['がいこく'] },
  ],
  difficulty_danger: [
    { char: '難', on: ['ナン'], kun: ['むずか.しい'], meanings: ['difficult'], strokes: 18, radical: '隹', writes: ['むずかしい'] },
    { char: '簡', on: ['カン'], kun: [], meanings: ['simple'], strokes: 18, radical: '竹', writes: ['かんたん'] },
    { char: '単', on: ['タン'], kun: [], meanings: ['single, simple'], strokes: 9, radical: '十', writes: ['かんたん'] },
    { char: '危', on: ['キ'], kun: ['あぶ.ない'], meanings: ['dangerous'], strokes: 6, radical: '卩', writes: ['あぶない', 'きけん'] },
    { char: '険', on: ['ケン'], kun: [], meanings: ['steep, risky'], strokes: 11, radical: '阜', writes: ['きけん'] },
    { char: '同', on: ['ドウ'], kun: ['おな.じ'], meanings: ['same'], strokes: 6, radical: '口', writes: ['おなじ'] },
    { char: '違', on: ['イ'], kun: ['ちが.う'], meanings: ['to differ'], strokes: 13, radical: '辵', writes: ['ちがう'] },
    { char: '別', on: ['ベツ'], kun: ['わか.れる'], meanings: ['separate, different'], strokes: 7, radical: '刀', writes: ['べつに', 'わかれる'] },
    { char: '離', on: ['リ'], kun: ['はな.れる'], meanings: ['to leave, be apart'], strokes: 18, radical: '隹', writes: ['はなれる'] },
    { char: '競', on: ['キョウ'], kun: ['きそ.う'], meanings: ['to compete'], strokes: 20, radical: '立', writes: ['きょうそう'] },
    { char: '争', on: ['ソウ'], kun: ['あらそ.う'], meanings: ['to fight, to compete'], strokes: 6, radical: '亅', writes: ['きょうそう'] },
    { char: '発', on: ['ハツ', 'ホツ'], kun: [], meanings: ['to depart, to emit'], strokes: 9, radical: '癶', writes: ['しゅっぱつ', 'はったつ'] },
    { char: '着', on: ['チャク'], kun: ['き.る', 'つ.く'], meanings: ['to arrive', 'to wear'], strokes: 12, radical: '目', writes: ['とうちゃく'] },
  ],
  feelings_effort: [
    { char: '完', on: ['カン'], kun: [], meanings: ['complete'], strokes: 7, radical: '宀', writes: ['かんせい'] },
    { char: '感', on: ['カン'], kun: [], meanings: ['feeling, emotion'], strokes: 13, radical: '心', writes: ['かんどうする'] },
    { char: '期', on: ['キ', 'ゴ'], kun: [], meanings: ['period, term'], strokes: 12, radical: '月', writes: ['きたい'] },
    { char: '信', on: ['シン'], kun: [], meanings: ['trust, faith'], strokes: 9, radical: '人', writes: ['しんらい'] },
    { char: '情', on: ['ジョウ', 'セイ'], kun: ['なさ.け'], meanings: ['emotion, sympathy'], strokes: 11, radical: '心', writes: ['ゆうじょう'] },
    { char: '残', on: ['ザン'], kun: ['のこ.る'], meanings: ['to remain'], strokes: 10, radical: '歹', writes: ['ざんねん'] },
    { char: '念', on: ['ネン'], kun: [], meanings: ['sense, thought'], strokes: 8, radical: '心', writes: ['ざんねん'] },
    { char: '努', on: ['ド'], kun: ['つと.める'], meanings: ['to endeavor'], strokes: 7, radical: '力', writes: ['どりょく'] },
    { char: '力', on: ['リョク', 'リキ'], kun: ['ちから'], meanings: ['power, strength'], strokes: 2, radical: '力', writes: ['どりょく'] },
    { char: '標', on: ['ヒョウ'], kun: [], meanings: ['sign, mark'], strokes: 15, radical: '木', writes: ['もくひょう'] },
    { char: '達', on: ['タツ'], kun: [], meanings: ['to reach, to attain'], strokes: 12, radical: '辵', writes: ['はったつ'] },
  ],
  quantity_common: [
    { char: '平', on: ['ヘイ', 'ビョウ'], kun: ['たい.ら', 'ひら'], meanings: ['flat, average'], strokes: 5, radical: '干', writes: ['へいきん'] },
    { char: '均', on: ['キン'], kun: [], meanings: ['equal, level'], strokes: 7, radical: '土', writes: ['へいきん'] },
    { char: '合', on: ['ゴウ', 'ガッ'], kun: ['あ.う'], meanings: ['to fit, to match'], strokes: 6, radical: '口', writes: ['しあい', 'ごうけい'] },
    { char: '試', on: ['シ'], kun: ['こころ.みる', 'ため.す'], meanings: ['to try, to test'], strokes: 13, radical: '言', writes: ['しあい'] },
    { char: '共', on: ['キョウ'], kun: ['とも'], meanings: ['together, both'], strokes: 6, radical: '八', writes: ['きょうつう'] },
    { char: '通', on: ['ツウ'], kun: ['とお.る', 'かよ.う'], meanings: ['to pass through, to commute'], strokes: 10, radical: '辵', writes: ['きょうつう'] },
  ],
};

export const KANJI_N4_UNIT = 'kanji-n4';

/**
 * Eight lessons, themed the same way `kanji.ts` themes the N5 unit — each
 * lesson re-reads the vocabulary group (N4 or N5) that already taught the
 * words in kana.
 */
export const KANJI_N4_LESSONS: KanjiLessonSeed[] = [
  { order: 0, title: 'N4 kanji: verbs you already know', groups: ['verbs'], exerciseTypes: ['multipleChoice'] },
  { order: 1, title: 'N4 kanji: describing things', groups: ['descriptions'], exerciseTypes: ['multipleChoice'] },
  { order: 2, title: 'N4 kanji: reasons and results', groups: ['reasons_results'], exerciseTypes: ['multipleChoice'] },
  { order: 3, title: 'N4 kanji: work and records', groups: ['work_records'], exerciseTypes: ['multipleChoice'] },
  { order: 4, title: 'N4 kanji: town and directions', groups: ['town_directions'], exerciseTypes: ['multipleChoice'] },
  { order: 5, title: 'N4 kanji: difficulty and danger', groups: ['difficulty_danger'], exerciseTypes: ['multipleChoice'] },
  { order: 6, title: 'N4 kanji: feelings and effort', groups: ['feelings_effort'], exerciseTypes: ['multipleChoice'] },
  { order: 7, title: 'N4 kanji: quantity and matching', groups: ['quantity_common'], exerciseTypes: ['multipleChoice'] },
];

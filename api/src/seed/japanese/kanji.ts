export interface KanjiSeed {
  char: string;
  /** On-yomi (the Chinese-derived reading), katakana by convention. */
  on: string[];
  /**
   * Kun-yomi (the native Japanese reading), hiragana by convention.
   *
   * Written with the dictionary's okurigana dot — 食 is `た.べる`, not `たべる` —
   * because the dot is the only thing that says *which part of the word the
   * kanji actually writes*. Without it a learner reading `たべる` beside 食
   * reasonably concludes the glyph spells all three syllables, and then cannot
   * explain why 食べる is written with two kana after it.
   */
  kun: string[];
  /** English meanings. Joined with ', ' to make the quiz answer, so keep them tight. */
  meanings: string[];
  strokes: number;
  /** The classifying radical, as a character. */
  radical: string;
  /**
   * Seeded kana words this kanji writes some part of.
   *
   * This is the whole design of the unit, and `kanji.spec.ts` checks every entry
   * against the actual vocabulary: a kanji here must write a word the learner has
   * *already met in kana*. 山 is not "a new character to memorise", it is the way
   * やま — learned back in the first words unit — is really written.
   *
   * Not persisted. It exists to constrain authoring and to keep the pairing
   * honest as vocabulary changes; the schema has nowhere to put it (§5's
   * KanjiEntry has no such field) and inventing one would be a third documented
   * departure for something no endpoint needs.
   */
  writes: string[];
}

export interface KanjiLessonSeed {
  order: number;
  title: string;
  groups: string[];
  exerciseTypes: string[];
}

/**
 * The first kanji unit — 104 characters, and every one of them writes a word the
 * learner already knows.
 *
 * ## Why this unit comes last, and why it is built this way
 *
 * A kanji unit taught the usual way is a memorisation slog: 104 new glyphs, each
 * with two or three readings and a meaning, attached to nothing. This one is
 * placed after all nine kana, vocabulary and grammar units precisely so it can
 * be the opposite — a re-reading of material already learned. Every character
 * here writes something from `vocab-basics`, `vocab-everyday` or the marks-words
 * units: 山 is やま, 食 is the 食 in たべる, 学 and 校 are the two halves of
 * がっこう. `writes` records the pairing and the spec enforces it, so the unit
 * cannot drift into teaching characters for words the course never taught.
 *
 * ## The question this unit asks, and the one it cannot
 *
 * **Kanji → meaning**, never kanji → reading. A kanji has several readings and
 * which applies depends on the word: 山 is やま alone and サン in 火山, both
 * correct. "Which reading is this?" therefore has two right answers — the same
 * defect the grammar unit hit with 「わたしはいき＿。」, where ます, ません and ました
 * are all grammatical (OPEN-ITEMS #26). The meaning is what a kanji has
 * independently of context, so it is the only thing this shape can ask honestly.
 *
 * Readings are still *taught*: `GET /lessons/:id` returns `on` and `kun` on each
 * resolved item, so the lesson screen shows them. They are study material, not
 * an answer key.
 *
 * ## Stroke counts and radicals
 *
 * Both are authored from the standard tables. `strokes` is `required, min: 1` on
 * the schema and `radical` is `required` — §5 asks for both, and a kanji entry
 * without them cannot support the stroke-order or radical-search features Phase 1
 * lists, so they are filled in properly now rather than stubbed.
 */
export const KANJI_GROUPS: Record<string, KanjiSeed[]> = {
  nature: [
    { char: '山', on: ['サン'], kun: ['やま'], meanings: ['mountain'], strokes: 3, radical: '山', writes: ['やま'] },
    { char: '海', on: ['カイ'], kun: ['うみ'], meanings: ['sea'], strokes: 9, radical: '水', writes: ['うみ'] },
    { char: '空', on: ['クウ'], kun: ['そら', 'から'], meanings: ['sky', 'empty'], strokes: 8, radical: '穴', writes: ['そら'] },
    { char: '花', on: ['カ'], kun: ['はな'], meanings: ['flower'], strokes: 7, radical: '艸', writes: ['はな'] },
    { char: '雨', on: ['ウ'], kun: ['あめ'], meanings: ['rain'], strokes: 8, radical: '雨', writes: ['あめ'] },
    { char: '雪', on: ['セツ'], kun: ['ゆき'], meanings: ['snow'], strokes: 11, radical: '雨', writes: ['ゆき'] },
    { char: '月', on: ['ゲツ', 'ガツ'], kun: ['つき'], meanings: ['moon', 'month'], strokes: 4, radical: '月', writes: ['つき'] },
    { char: '星', on: ['セイ'], kun: ['ほし'], meanings: ['star'], strokes: 9, radical: '日', writes: ['ほし'] },
    { char: '日', on: ['ニチ', 'ジツ'], kun: ['ひ', 'か'], meanings: ['sun', 'day'], strokes: 4, radical: '日', writes: ['まいにち'] },
    { char: '天', on: ['テン'], kun: ['あま'], meanings: ['heaven'], strokes: 4, radical: '大', writes: ['てんき'] },
  ],
  time: [
    { char: '時', on: ['ジ'], kun: ['とき'], meanings: ['time', 'hour'], strokes: 10, radical: '日', writes: ['とけい', 'じかん'] },
    { char: '分', on: ['フン', 'ブン'], kun: ['わ.かる'], meanings: ['minute', 'to divide'], strokes: 4, radical: '刀', writes: ['ふん', 'わかる'] },
    { char: '年', on: ['ネン'], kun: ['とし'], meanings: ['year'], strokes: 6, radical: '干', writes: ['とし'] },
    { char: '朝', on: ['チョウ'], kun: ['あさ'], meanings: ['morning'], strokes: 12, radical: '月', writes: ['あさ', 'あさごはん'] },
    { char: '夜', on: ['ヤ'], kun: ['よる', 'よ'], meanings: ['night'], strokes: 8, radical: '夕', writes: ['よる'] },
    { char: '昼', on: ['チュウ'], kun: ['ひる'], meanings: ['noon', 'daytime'], strokes: 9, radical: '日', writes: ['ひる'] },
    { char: '今', on: ['コン', 'キン'], kun: ['いま'], meanings: ['now'], strokes: 4, radical: '人', writes: ['いま'] },
    { char: '毎', on: ['マイ'], kun: [], meanings: ['every'], strokes: 6, radical: '母', writes: ['まいにち'] },
    { char: '週', on: ['シュウ'], kun: [], meanings: ['week'], strokes: 11, radical: '辵', writes: ['しゅうまつ'] },
    { char: '間', on: ['カン', 'ケン'], kun: ['あいだ'], meanings: ['interval', 'between'], strokes: 12, radical: '門', writes: ['じかん'] },
  ],
  people: [
    { char: '人', on: ['ジン', 'ニン'], kun: ['ひと'], meanings: ['person'], strokes: 2, radical: '人', writes: ['ひと', 'かいしゃいん'] },
    { char: '私', on: ['シ'], kun: ['わたし'], meanings: ['I', 'me'], strokes: 7, radical: '禾', writes: ['わたし'] },
    { char: '男', on: ['ダン', 'ナン'], kun: ['おとこ'], meanings: ['man'], strokes: 7, radical: '田', writes: ['おとこ'] },
    { char: '女', on: ['ジョ'], kun: ['おんな'], meanings: ['woman'], strokes: 3, radical: '女', writes: ['おんな'] },
    { char: '子', on: ['シ'], kun: ['こ'], meanings: ['child'], strokes: 3, radical: '子', writes: ['こども'] },
    { char: '父', on: ['フ'], kun: ['ちち'], meanings: ['father'], strokes: 4, radical: '父', writes: ['ちち', 'おとうさん'] },
    { char: '母', on: ['ボ'], kun: ['はは'], meanings: ['mother'], strokes: 5, radical: '母', writes: ['はは', 'おかあさん'] },
    { char: '兄', on: ['キョウ'], kun: ['あに'], meanings: ['older brother'], strokes: 5, radical: '儿', writes: ['あに', 'おにいさん'] },
    { char: '姉', on: ['シ'], kun: ['あね'], meanings: ['older sister'], strokes: 8, radical: '女', writes: ['あね', 'おねえさん'] },
    { char: '友', on: ['ユウ'], kun: ['とも'], meanings: ['friend'], strokes: 4, radical: '又', writes: ['ともだち'] },
  ],
  body: [
    { char: '目', on: ['モク'], kun: ['め'], meanings: ['eye'], strokes: 5, radical: '目', writes: ['め'] },
    { char: '耳', on: ['ジ'], kun: ['みみ'], meanings: ['ear'], strokes: 6, radical: '耳', writes: ['みみ'] },
    { char: '口', on: ['コウ'], kun: ['くち'], meanings: ['mouth'], strokes: 3, radical: '口', writes: ['くち'] },
    { char: '手', on: ['シュ'], kun: ['て'], meanings: ['hand'], strokes: 4, radical: '手', writes: ['て', 'てぶくろ'] },
    { char: '足', on: ['ソク'], kun: ['あし'], meanings: ['leg', 'foot'], strokes: 7, radical: '足', writes: ['あし'] },
    { char: '体', on: ['タイ'], kun: ['からだ'], meanings: ['body'], strokes: 7, radical: '人', writes: ['からだ'] },
    { char: '頭', on: ['トウ'], kun: ['あたま'], meanings: ['head'], strokes: 16, radical: '頁', writes: ['あたま'] },
    { char: '顔', on: ['ガン'], kun: ['かお'], meanings: ['face'], strokes: 18, radical: '頁', writes: ['かお'] },
    { char: '元', on: ['ゲン', 'ガン'], kun: ['もと'], meanings: ['origin'], strokes: 4, radical: '儿', writes: ['げんき'] },
    { char: '気', on: ['キ'], kun: [], meanings: ['spirit', 'air'], strokes: 6, radical: '气', writes: ['げんき', 'てんき'] },
  ],
  food: [
    { char: '食', on: ['ショク'], kun: ['た.べる'], meanings: ['to eat', 'food'], strokes: 9, radical: '食', writes: ['たべる'] },
    { char: '飲', on: ['イン'], kun: ['の.む'], meanings: ['to drink'], strokes: 12, radical: '食', writes: ['のむ'] },
    { char: '水', on: ['スイ'], kun: ['みず'], meanings: ['water'], strokes: 4, radical: '水', writes: ['みず'] },
    { char: '牛', on: ['ギュウ'], kun: ['うし'], meanings: ['cow'], strokes: 4, radical: '牛', writes: ['ぎゅうにゅう'] },
    { char: '魚', on: ['ギョ'], kun: ['さかな', 'うお'], meanings: ['fish'], strokes: 11, radical: '魚', writes: ['さかな'] },
    { char: '肉', on: ['ニク'], kun: [], meanings: ['meat'], strokes: 6, radical: '肉', writes: ['にく'] },
    { char: '野', on: ['ヤ'], kun: ['の'], meanings: ['field', 'plain'], strokes: 11, radical: '里', writes: ['やさい'] },
    { char: '茶', on: ['チャ', 'サ'], kun: [], meanings: ['tea'], strokes: 9, radical: '艸', writes: ['おちゃ'] },
    { char: '物', on: ['ブツ', 'モツ'], kun: ['もの'], meanings: ['thing', 'object'], strokes: 8, radical: '牛', writes: ['くだもの'] },
    { char: '卵', on: ['ラン'], kun: ['たまご'], meanings: ['egg'], strokes: 7, radical: '卩', writes: ['たまご'] },
  ],
  places: [
    { char: '家', on: ['カ', 'ケ'], kun: ['いえ', 'うち'], meanings: ['house', 'home'], strokes: 10, radical: '宀', writes: ['いえ'] },
    { char: '店', on: ['テン'], kun: ['みせ'], meanings: ['shop'], strokes: 8, radical: '广', writes: ['みせ', 'きっさてん'] },
    { char: '町', on: ['チョウ'], kun: ['まち'], meanings: ['town'], strokes: 7, radical: '田', writes: ['まち'] },
    { char: '駅', on: ['エキ'], kun: [], meanings: ['station'], strokes: 14, radical: '馬', writes: ['えき'] },
    { char: '学', on: ['ガク'], kun: ['まな.ぶ'], meanings: ['study', 'learning'], strokes: 8, radical: '子', writes: ['がっこう', 'がくせい', 'だいがく'] },
    { char: '校', on: ['コウ'], kun: [], meanings: ['school building'], strokes: 10, radical: '木', writes: ['がっこう'] },
    { char: '銀', on: ['ギン'], kun: [], meanings: ['silver'], strokes: 14, radical: '金', writes: ['ぎんこう'] },
    { char: '道', on: ['ドウ'], kun: ['みち'], meanings: ['road', 'way'], strokes: 12, radical: '辵', writes: ['みち'] },
    { char: '部', on: ['ブ'], kun: [], meanings: ['part', 'section'], strokes: 11, radical: '邑', writes: ['へや'] },
    { char: '屋', on: ['オク'], kun: ['や'], meanings: ['roof', 'dwelling'], strokes: 9, radical: '尸', writes: ['へや'] },
  ],
  verbs: [
    { char: '見', on: ['ケン'], kun: ['み.る'], meanings: ['to see'], strokes: 7, radical: '見', writes: ['みる'] },
    { char: '聞', on: ['ブン'], kun: ['き.く'], meanings: ['to hear', 'to ask'], strokes: 14, radical: '耳', writes: ['きく'] },
    { char: '話', on: ['ワ'], kun: ['はな.す'], meanings: ['to speak', 'story'], strokes: 13, radical: '言', writes: ['はなす', 'でんわ'] },
    { char: '読', on: ['ドク'], kun: ['よ.む'], meanings: ['to read'], strokes: 14, radical: '言', writes: ['よむ'] },
    { char: '書', on: ['ショ'], kun: ['か.く'], meanings: ['to write'], strokes: 10, radical: '曰', writes: ['かく', 'じしょ'] },
    { char: '行', on: ['コウ'], kun: ['い.く'], meanings: ['to go'], strokes: 6, radical: '行', writes: ['いく', 'ぎんこう', 'りょこう'] },
    { char: '来', on: ['ライ'], kun: ['く.る'], meanings: ['to come'], strokes: 7, radical: '木', writes: ['くる'] },
    { char: '買', on: ['バイ'], kun: ['か.う'], meanings: ['to buy'], strokes: 12, radical: '貝', writes: ['かう'] },
    { char: '売', on: ['バイ'], kun: ['う.る'], meanings: ['to sell'], strokes: 7, radical: '士', writes: ['うる'] },
    { char: '待', on: ['タイ'], kun: ['ま.つ'], meanings: ['to wait'], strokes: 9, radical: '彳', writes: ['まつ'] },
    { char: '座', on: ['ザ'], kun: ['すわ.る'], meanings: ['to sit'], strokes: 10, radical: '广', writes: ['すわる'] },
    { char: '帰', on: ['キ'], kun: ['かえ.る'], meanings: ['to return home'], strokes: 10, radical: '巾', writes: ['かえる'] },
  ],
  commuting: [
    { char: '車', on: ['シャ'], kun: ['くるま'], meanings: ['car', 'vehicle'], strokes: 7, radical: '車', writes: ['くるま', 'でんしゃ', 'じてんしゃ'] },
    { char: '電', on: ['デン'], kun: [], meanings: ['electricity'], strokes: 13, radical: '雨', writes: ['でんき', 'でんしゃ', 'でんわ'] },
    { char: '会', on: ['カイ'], kun: ['あ.う'], meanings: ['to meet'], strokes: 6, radical: '人', writes: ['あう', 'かいしゃ', 'かいぎ'] },
    { char: '社', on: ['シャ'], kun: ['やしろ'], meanings: ['company', 'shrine'], strokes: 7, radical: '示', writes: ['かいしゃ', 'しゃちょう'] },
    { char: '出', on: ['シュツ'], kun: ['で.る', 'だ.す'], meanings: ['to exit', 'to put out'], strokes: 5, radical: '凵', writes: ['だす'] },
    { char: '入', on: ['ニュウ'], kun: ['い.れる', 'はい.る'], meanings: ['to enter'], strokes: 2, radical: '入', writes: ['いれる'] },
    { char: '休', on: ['キュウ'], kun: ['やす.む'], meanings: ['to rest'], strokes: 6, radical: '人', writes: ['やすみ'] },
    { char: '歩', on: ['ホ'], kun: ['ある.く'], meanings: ['to walk'], strokes: 8, radical: '止', writes: ['あるく'] },
    { char: '走', on: ['ソウ'], kun: ['はし.る'], meanings: ['to run'], strokes: 7, radical: '走', writes: ['はしる'] },
    { char: '金', on: ['キン'], kun: ['かね'], meanings: ['gold', 'money'], strokes: 8, radical: '金', writes: ['おかね'] },
  ],
  descriptions: [
    { char: '大', on: ['ダイ', 'タイ'], kun: ['おお.きい'], meanings: ['big'], strokes: 3, radical: '大', writes: ['おおきい', 'だいがく'] },
    { char: '小', on: ['ショウ'], kun: ['ちい.さい'], meanings: ['small'], strokes: 3, radical: '小', writes: ['ちいさい'] },
    { char: '高', on: ['コウ'], kun: ['たか.い'], meanings: ['tall', 'expensive'], strokes: 10, radical: '高', writes: ['たかい'] },
    { char: '安', on: ['アン'], kun: ['やす.い'], meanings: ['cheap', 'safe'], strokes: 6, radical: '宀', writes: ['やすい'] },
    { char: '新', on: ['シン'], kun: ['あたら.しい'], meanings: ['new'], strokes: 13, radical: '斤', writes: ['あたらしい'] },
    { char: '古', on: ['コ'], kun: ['ふる.い'], meanings: ['old'], strokes: 5, radical: '口', writes: ['ふるい'] },
    { char: '長', on: ['チョウ'], kun: ['なが.い'], meanings: ['long'], strokes: 8, radical: '長', writes: ['ながい', 'しゃちょう'] },
    { char: '短', on: ['タン'], kun: ['みじか.い'], meanings: ['short'], strokes: 12, radical: '矢', writes: ['みじかい'] },
    { char: '少', on: ['ショウ'], kun: ['すこ.し'], meanings: ['few', 'a little'], strokes: 4, radical: '小', writes: ['すこし'] },
  ],
  numbers: [
    { char: '一', on: ['イチ'], kun: ['ひと.つ'], meanings: ['one'], strokes: 1, radical: '一', writes: ['いち'] },
    { char: '二', on: ['ニ'], kun: ['ふた.つ'], meanings: ['two'], strokes: 2, radical: '二', writes: ['に'] },
    { char: '三', on: ['サン'], kun: ['み.つ'], meanings: ['three'], strokes: 3, radical: '一', writes: ['さん'] },
    { char: '四', on: ['シ'], kun: ['よん', 'よ.つ'], meanings: ['four'], strokes: 5, radical: '囗', writes: ['よん'] },
    { char: '五', on: ['ゴ'], kun: ['いつ.つ'], meanings: ['five'], strokes: 4, radical: '二', writes: ['ご'] },
    { char: '六', on: ['ロク'], kun: ['む.つ'], meanings: ['six'], strokes: 4, radical: '八', writes: ['ろく'] },
    { char: '七', on: ['シチ'], kun: ['なな'], meanings: ['seven'], strokes: 2, radical: '一', writes: ['なな'] },
    { char: '八', on: ['ハチ'], kun: ['や.つ'], meanings: ['eight'], strokes: 2, radical: '八', writes: ['はち'] },
    { char: '九', on: ['キュウ', 'ク'], kun: ['ここの.つ'], meanings: ['nine'], strokes: 2, radical: '乙', writes: ['きゅう'] },
    { char: '十', on: ['ジュウ'], kun: ['とお'], meanings: ['ten'], strokes: 2, radical: '十', writes: ['じゅう'] },
    { char: '百', on: ['ヒャク'], kun: [], meanings: ['hundred'], strokes: 6, radical: '白', writes: ['ひゃく'] },
    { char: '千', on: ['セン'], kun: ['ち'], meanings: ['thousand'], strokes: 3, radical: '十', writes: ['せん'] },
    { char: '万', on: ['マン', 'バン'], kun: [], meanings: ['ten thousand'], strokes: 3, radical: '一', writes: ['まん'] },
  ],
};

export const KANJI_UNIT = 'kanji-basics';

/**
 * Ten lessons, themed to mirror the vocabulary units they draw on — so the
 * "nature" kanji lesson re-reads the same words the "nature and time" words
 * lesson taught, rather than arriving as an unrelated block of glyphs.
 *
 * Ten characters a lesson, which is fewer than the 15 of `vocab-everyday` on
 * purpose: a kanji carries a meaning, a stroke count and two reading sets, so ten
 * is already more to absorb than fifteen words whose readings are written on the
 * page.
 */
export const KANJI_LESSONS: KanjiLessonSeed[] = [
  { order: 0, title: 'Kanji: nature and weather', groups: ['nature'], exerciseTypes: ['multipleChoice'] },
  { order: 1, title: 'Kanji: time and the calendar', groups: ['time'], exerciseTypes: ['multipleChoice'] },
  { order: 2, title: 'Kanji: people and family', groups: ['people'], exerciseTypes: ['multipleChoice'] },
  { order: 3, title: 'Kanji: the body and health', groups: ['body'], exerciseTypes: ['multipleChoice'] },
  { order: 4, title: 'Kanji: food and drink', groups: ['food'], exerciseTypes: ['multipleChoice'] },
  { order: 5, title: 'Kanji: places', groups: ['places'], exerciseTypes: ['multipleChoice'] },
  { order: 6, title: 'Kanji: verbs you already know', groups: ['verbs'], exerciseTypes: ['multipleChoice'] },
  { order: 7, title: 'Kanji: commuting and work', groups: ['commuting'], exerciseTypes: ['multipleChoice'] },
  { order: 8, title: 'Kanji: describing things', groups: ['descriptions'], exerciseTypes: ['multipleChoice'] },
  { order: 9, title: 'Kanji: numbers', groups: ['numbers'], exerciseTypes: ['multipleChoice'] },
];

import type { VocabSeed, VocabLessonSeed } from './vocab';

/**
 * The second vocabulary unit — 220 words across 14 themed lessons.
 *
 * ## Why this unit can exist and the first one could not
 *
 * `vocab.ts` was capped at 58 words by a hard constraint: a learner reaching it
 * knew only the 92 base gojūon characters, so every word had to be spelled
 * without dakuten, handakuten, yōon, っ or ー. That rule is why たべる, ともだち,
 * がくせい, みず and every katakana loanword worth knowing were *missing* from a
 * beginner vocabulary unit — each needs a mark that had not been taught.
 *
 * This unit sits after all four marks units, so the learner now knows **151
 * distinct characters** — effectively the whole kana inventory. The absences
 * that embarrassed the first unit are the first thing this one fixes: たべる,
 * ともだち, がくせい, みず, おかあさん, ぎゅうにゅう and a proper set of loanwords
 * are all readable here.
 *
 * ## What is still out of reach, and why
 *
 * **Small vowels — ぁぃぅぇぉ / ァィゥェォ — and ヴ are never taught.** They are
 * not part of the gojūon and no unit introduces them, so any word needing one
 * is still unspellable. That rules out a whole class of otherwise-obvious
 * loanwords: フォーク (fork), パーティー (party), ファミリー, テレビ is fine but
 * ティー is not, and コンピューター needs ュー which is fine but ヴ words are out.
 * `vocab-everyday.spec.ts` enforces the character rule, so a word needing an
 * untaught glyph fails the build rather than shipping an unreadable card.
 *
 * **っ followed by ち is avoided.** The transliterator in `romaji.spec.ts`
 * doubles the *first letter* of the next chunk, so っ + ちゃ yields `ccha` —
 * but Hepburn writes まっちゃ as `matcha`, with a t. Rather than teach a
 * spelling the checker disagrees with, this unit simply contains no っち word.
 * きっぷ (`kippu`) and きっさてん (`kissaten`) are fine: there the doubled letter
 * is the same one Hepburn uses.
 *
 * ## Orthography
 *
 * `lemma` and `reading` are identical throughout, exactly as in the first unit
 * — kana-only spelling is how these words are presented until kanji are taught,
 * and `reading` is then already correct when `lemma` gains a kanji spelling.
 *
 * All N5. Long vowels are written as the kana spell them (`ou`, not `ō`), which
 * is what the mechanical transliterator produces and what the first unit
 * already does: おはよう is `ohayou`.
 */
export const VOCAB_EVERYDAY_GROUPS: Record<string, VocabSeed[]> = {
  food: [
    { lemma: 'ごはん', reading: 'ごはん', romaji: 'gohan', gloss: 'cooked rice, a meal', pos: 'noun' },
    { lemma: 'パン', reading: 'パン', romaji: 'pan', gloss: 'bread', pos: 'noun' },
    { lemma: 'みず', reading: 'みず', romaji: 'mizu', gloss: 'water', pos: 'noun' },
    { lemma: 'おちゃ', reading: 'おちゃ', romaji: 'ocha', gloss: 'green tea', pos: 'noun' },
    { lemma: 'にく', reading: 'にく', romaji: 'niku', gloss: 'meat', pos: 'noun' },
    { lemma: 'さかな', reading: 'さかな', romaji: 'sakana', gloss: 'fish', pos: 'noun' },
    { lemma: 'やさい', reading: 'やさい', romaji: 'yasai', gloss: 'vegetable', pos: 'noun' },
    { lemma: 'くだもの', reading: 'くだもの', romaji: 'kudamono', gloss: 'fruit', pos: 'noun' },
    { lemma: 'たまご', reading: 'たまご', romaji: 'tamago', gloss: 'egg', pos: 'noun' },
    { lemma: 'ぎゅうにゅう', reading: 'ぎゅうにゅう', romaji: 'gyuunyuu', gloss: 'milk', pos: 'noun' },
    { lemma: 'チーズ', reading: 'チーズ', romaji: 'chiizu', gloss: 'cheese', pos: 'noun' },
    { lemma: 'おかし', reading: 'おかし', romaji: 'okashi', gloss: 'sweets, snacks', pos: 'noun' },
    { lemma: 'あさごはん', reading: 'あさごはん', romaji: 'asagohan', gloss: 'breakfast', pos: 'noun' },
    { lemma: 'ばんごはん', reading: 'ばんごはん', romaji: 'bangohan', gloss: 'dinner', pos: 'noun' },
    // The word the first unit could not spell. べ needs a dakuten, so たべる —
    // the verb every beginner course opens with — waited four units for this one.
    { lemma: 'たべる', reading: 'たべる', romaji: 'taberu', gloss: 'to eat', pos: 'verb' },
  ],
  family: [
    // The polite forms, for *someone else's* family. The first unit taught the
    // humble forms ちち and はは because おとうさん needs と+う and おかあさん
    // needs か+あ — spellable then — but the あに/あね pair and every word with
    // a dakuten had to wait.
    { lemma: 'おとうさん', reading: 'おとうさん', romaji: 'otousan', gloss: 'father (polite)', pos: 'noun' },
    { lemma: 'おかあさん', reading: 'おかあさん', romaji: 'okaasan', gloss: 'mother (polite)', pos: 'noun' },
    { lemma: 'おにいさん', reading: 'おにいさん', romaji: 'oniisan', gloss: 'older brother (polite)', pos: 'noun' },
    { lemma: 'おねえさん', reading: 'おねえさん', romaji: 'oneesan', gloss: 'older sister (polite)', pos: 'noun' },
    { lemma: 'あに', reading: 'あに', romaji: 'ani', gloss: 'my older brother', pos: 'noun' },
    { lemma: 'あね', reading: 'あね', romaji: 'ane', gloss: 'my older sister', pos: 'noun' },
    { lemma: 'おとうと', reading: 'おとうと', romaji: 'otouto', gloss: 'younger brother', pos: 'noun' },
    { lemma: 'かぞく', reading: 'かぞく', romaji: 'kazoku', gloss: 'family', pos: 'noun' },
    { lemma: 'こども', reading: 'こども', romaji: 'kodomo', gloss: 'child', pos: 'noun' },
    { lemma: 'おじいさん', reading: 'おじいさん', romaji: 'ojiisan', gloss: 'grandfather', pos: 'noun' },
    { lemma: 'おばあさん', reading: 'おばあさん', romaji: 'obaasan', gloss: 'grandmother', pos: 'noun' },
    { lemma: 'しゅじん', reading: 'しゅじん', romaji: 'shujin', gloss: 'husband', pos: 'noun' },
    { lemma: 'おくさん', reading: 'おくさん', romaji: 'okusan', gloss: 'wife', pos: 'noun' },
    { lemma: 'ともだち', reading: 'ともだち', romaji: 'tomodachi', gloss: 'friend', pos: 'noun' },
    { lemma: 'あかちゃん', reading: 'あかちゃん', romaji: 'akachan', gloss: 'baby', pos: 'noun' },
  ],
  body: [
    { lemma: 'あたま', reading: 'あたま', romaji: 'atama', gloss: 'head', pos: 'noun' },
    { lemma: 'かお', reading: 'かお', romaji: 'kao', gloss: 'face', pos: 'noun' },
    { lemma: 'め', reading: 'め', romaji: 'me', gloss: 'eye', pos: 'noun' },
    // Not はな for "nose": the first unit already owns はな as "flower", and
    // `lemma` is the natural key the seed upserts on, so the two would collide
    // into one document. Japanese homographs are a real problem for this schema
    // and this is the first place it bites.
    { lemma: 'みみ', reading: 'みみ', romaji: 'mimi', gloss: 'ear', pos: 'noun' },
    { lemma: 'くち', reading: 'くち', romaji: 'kuchi', gloss: 'mouth', pos: 'noun' },
    { lemma: 'て', reading: 'て', romaji: 'te', gloss: 'hand', pos: 'noun' },
    { lemma: 'あし', reading: 'あし', romaji: 'ashi', gloss: 'leg, foot', pos: 'noun' },
    { lemma: 'からだ', reading: 'からだ', romaji: 'karada', gloss: 'body', pos: 'noun' },
    { lemma: 'せなか', reading: 'せなか', romaji: 'senaka', gloss: 'back (of the body)', pos: 'noun' },
    { lemma: 'おなか', reading: 'おなか', romaji: 'onaka', gloss: 'stomach, belly', pos: 'noun' },
    { lemma: 'びょうき', reading: 'びょうき', romaji: 'byouki', gloss: 'illness', pos: 'noun' },
    { lemma: 'くすり', reading: 'くすり', romaji: 'kusuri', gloss: 'medicine', pos: 'noun' },
    { lemma: 'いしゃ', reading: 'いしゃ', romaji: 'isha', gloss: 'doctor', pos: 'noun' },
    { lemma: 'びょういん', reading: 'びょういん', romaji: 'byouin', gloss: 'hospital', pos: 'noun' },
    { lemma: 'げんき', reading: 'げんき', romaji: 'genki', gloss: 'healthy, energetic', pos: 'adjective' },
  ],
  home: [
    { lemma: 'へや', reading: 'へや', romaji: 'heya', gloss: 'room', pos: 'noun' },
    { lemma: 'だいどころ', reading: 'だいどころ', romaji: 'daidokoro', gloss: 'kitchen', pos: 'noun' },
    { lemma: 'おふろ', reading: 'おふろ', romaji: 'ofuro', gloss: 'bath', pos: 'noun' },
    { lemma: 'トイレ', reading: 'トイレ', romaji: 'toire', gloss: 'toilet', pos: 'noun' },
    { lemma: 'まど', reading: 'まど', romaji: 'mado', gloss: 'window', pos: 'noun' },
    { lemma: 'ドア', reading: 'ドア', romaji: 'doa', gloss: 'door', pos: 'noun' },
    { lemma: 'でんき', reading: 'でんき', romaji: 'denki', gloss: 'electricity, a light', pos: 'noun' },
    { lemma: 'れいぞうこ', reading: 'れいぞうこ', romaji: 'reizouko', gloss: 'refrigerator', pos: 'noun' },
    { lemma: 'そうじ', reading: 'そうじ', romaji: 'souji', gloss: 'cleaning', pos: 'noun' },
    { lemma: 'せんたく', reading: 'せんたく', romaji: 'sentaku', gloss: 'laundry', pos: 'noun' },
    { lemma: 'かぎ', reading: 'かぎ', romaji: 'kagi', gloss: 'key', pos: 'noun' },
    { lemma: 'にわ', reading: 'にわ', romaji: 'niwa', gloss: 'garden', pos: 'noun' },
    { lemma: 'かべ', reading: 'かべ', romaji: 'kabe', gloss: 'wall', pos: 'noun' },
    { lemma: 'ゆか', reading: 'ゆか', romaji: 'yuka', gloss: 'floor', pos: 'noun' },
    { lemma: 'かいだん', reading: 'かいだん', romaji: 'kaidan', gloss: 'stairs', pos: 'noun' },
  ],
  clothes: [
    { lemma: 'ふく', reading: 'ふく', romaji: 'fuku', gloss: 'clothes', pos: 'noun' },
    { lemma: 'シャツ', reading: 'シャツ', romaji: 'shatsu', gloss: 'shirt', pos: 'noun' },
    { lemma: 'ズボン', reading: 'ズボン', romaji: 'zubon', gloss: 'trousers', pos: 'noun' },
    { lemma: 'スカート', reading: 'スカート', romaji: 'sukaato', gloss: 'skirt', pos: 'noun' },
    { lemma: 'セーター', reading: 'セーター', romaji: 'seetaa', gloss: 'sweater', pos: 'noun' },
    { lemma: 'コート', reading: 'コート', romaji: 'kooto', gloss: 'coat', pos: 'noun' },
    { lemma: 'ぼうし', reading: 'ぼうし', romaji: 'boushi', gloss: 'hat, cap', pos: 'noun' },
    { lemma: 'くつした', reading: 'くつした', romaji: 'kutsushita', gloss: 'socks', pos: 'noun' },
    { lemma: 'めがね', reading: 'めがね', romaji: 'megane', gloss: 'glasses', pos: 'noun' },
    { lemma: 'ゆびわ', reading: 'ゆびわ', romaji: 'yubiwa', gloss: 'ring', pos: 'noun' },
    { lemma: 'かばん', reading: 'かばん', romaji: 'kaban', gloss: 'bag', pos: 'noun' },
    { lemma: 'さいふ', reading: 'さいふ', romaji: 'saifu', gloss: 'wallet', pos: 'noun' },
    { lemma: 'ハンカチ', reading: 'ハンカチ', romaji: 'hankachi', gloss: 'handkerchief', pos: 'noun' },
    { lemma: 'ネクタイ', reading: 'ネクタイ', romaji: 'nekutai', gloss: 'necktie', pos: 'noun' },
    { lemma: 'てぶくろ', reading: 'てぶくろ', romaji: 'tebukuro', gloss: 'gloves', pos: 'noun' },
  ],
  town: [
    { lemma: 'まち', reading: 'まち', romaji: 'machi', gloss: 'town', pos: 'noun' },
    { lemma: 'えき', reading: 'えき', romaji: 'eki', gloss: 'station', pos: 'noun' },
    { lemma: 'ぎんこう', reading: 'ぎんこう', romaji: 'ginkou', gloss: 'bank', pos: 'noun' },
    { lemma: 'ゆうびんきょく', reading: 'ゆうびんきょく', romaji: 'yuubinkyoku', gloss: 'post office', pos: 'noun' },
    { lemma: 'こうえん', reading: 'こうえん', romaji: 'kouen', gloss: 'park', pos: 'noun' },
    { lemma: 'としょかん', reading: 'としょかん', romaji: 'toshokan', gloss: 'library', pos: 'noun' },
    { lemma: 'だいがく', reading: 'だいがく', romaji: 'daigaku', gloss: 'university', pos: 'noun' },
    { lemma: 'レストラン', reading: 'レストラン', romaji: 'resutoran', gloss: 'restaurant', pos: 'noun' },
    { lemma: 'スーパー', reading: 'スーパー', romaji: 'suupaa', gloss: 'supermarket', pos: 'noun' },
    { lemma: 'デパート', reading: 'デパート', romaji: 'depaato', gloss: 'department store', pos: 'noun' },
    { lemma: 'ホテル', reading: 'ホテル', romaji: 'hoteru', gloss: 'hotel', pos: 'noun' },
    { lemma: 'くうこう', reading: 'くうこう', romaji: 'kuukou', gloss: 'airport', pos: 'noun' },
    { lemma: 'はし', reading: 'はし', romaji: 'hashi', gloss: 'bridge', pos: 'noun' },
    { lemma: 'みち', reading: 'みち', romaji: 'michi', gloss: 'road', pos: 'noun' },
    { lemma: 'きっさてん', reading: 'きっさてん', romaji: 'kissaten', gloss: 'coffee shop', pos: 'noun' },
  ],
  transport: [
    { lemma: 'でんしゃ', reading: 'でんしゃ', romaji: 'densha', gloss: 'train', pos: 'noun' },
    { lemma: 'バス', reading: 'バス', romaji: 'basu', gloss: 'bus', pos: 'noun' },
    { lemma: 'タクシー', reading: 'タクシー', romaji: 'takushii', gloss: 'taxi', pos: 'noun' },
    { lemma: 'ひこうき', reading: 'ひこうき', romaji: 'hikouki', gloss: 'airplane', pos: 'noun' },
    { lemma: 'じてんしゃ', reading: 'じてんしゃ', romaji: 'jitensha', gloss: 'bicycle', pos: 'noun' },
    { lemma: 'ちかてつ', reading: 'ちかてつ', romaji: 'chikatetsu', gloss: 'subway', pos: 'noun' },
    { lemma: 'きっぷ', reading: 'きっぷ', romaji: 'kippu', gloss: 'ticket', pos: 'noun' },
    { lemma: 'りょこう', reading: 'りょこう', romaji: 'ryokou', gloss: 'travel, a trip', pos: 'noun' },
    { lemma: 'みなと', reading: 'みなと', romaji: 'minato', gloss: 'harbour', pos: 'noun' },
    { lemma: 'ふね', reading: 'ふね', romaji: 'fune', gloss: 'boat, ship', pos: 'noun' },
    { lemma: 'のる', reading: 'のる', romaji: 'noru', gloss: 'to ride, to board', pos: 'verb' },
    { lemma: 'おりる', reading: 'おりる', romaji: 'oriru', gloss: 'to get off', pos: 'verb' },
    { lemma: 'あるく', reading: 'あるく', romaji: 'aruku', gloss: 'to walk', pos: 'verb' },
    { lemma: 'はしる', reading: 'はしる', romaji: 'hashiru', gloss: 'to run', pos: 'verb' },
    { lemma: 'とまる', reading: 'とまる', romaji: 'tomaru', gloss: 'to stop, to stay over', pos: 'verb' },
  ],
  school: [
    { lemma: 'べんきょう', reading: 'べんきょう', romaji: 'benkyou', gloss: 'study', pos: 'noun' },
    { lemma: 'しゅくだい', reading: 'しゅくだい', romaji: 'shukudai', gloss: 'homework', pos: 'noun' },
    { lemma: 'テスト', reading: 'テスト', romaji: 'tesuto', gloss: 'test', pos: 'noun' },
    { lemma: 'じゅぎょう', reading: 'じゅぎょう', romaji: 'jugyou', gloss: 'class, a lesson', pos: 'noun' },
    { lemma: 'せいと', reading: 'せいと', romaji: 'seito', gloss: 'pupil', pos: 'noun' },
    { lemma: 'がくせい', reading: 'がくせい', romaji: 'gakusei', gloss: 'student', pos: 'noun' },
    { lemma: 'きょうしつ', reading: 'きょうしつ', romaji: 'kyoushitsu', gloss: 'classroom', pos: 'noun' },
    { lemma: 'こくばん', reading: 'こくばん', romaji: 'kokuban', gloss: 'blackboard', pos: 'noun' },
    { lemma: 'えんぴつ', reading: 'えんぴつ', romaji: 'enpitsu', gloss: 'pencil', pos: 'noun' },
    { lemma: 'ペン', reading: 'ペン', romaji: 'pen', gloss: 'pen', pos: 'noun' },
    { lemma: 'ノート', reading: 'ノート', romaji: 'nooto', gloss: 'notebook', pos: 'noun' },
    { lemma: 'じしょ', reading: 'じしょ', romaji: 'jisho', gloss: 'dictionary', pos: 'noun' },
    { lemma: 'しつもん', reading: 'しつもん', romaji: 'shitsumon', gloss: 'a question', pos: 'noun' },
    { lemma: 'こたえ', reading: 'こたえ', romaji: 'kotae', gloss: 'an answer', pos: 'noun' },
    { lemma: 'ならう', reading: 'ならう', romaji: 'narau', gloss: 'to learn', pos: 'verb' },
  ],
  work: [
    { lemma: 'しごと', reading: 'しごと', romaji: 'shigoto', gloss: 'work, a job', pos: 'noun' },
    { lemma: 'かいしゃ', reading: 'かいしゃ', romaji: 'kaisha', gloss: 'company', pos: 'noun' },
    { lemma: 'かいしゃいん', reading: 'かいしゃいん', romaji: 'kaishain', gloss: 'company employee', pos: 'noun' },
    { lemma: 'おかね', reading: 'おかね', romaji: 'okane', gloss: 'money', pos: 'noun' },
    { lemma: 'ねだん', reading: 'ねだん', romaji: 'nedan', gloss: 'price', pos: 'noun' },
    { lemma: 'やすみ', reading: 'やすみ', romaji: 'yasumi', gloss: 'a rest, a holiday', pos: 'noun' },
    { lemma: 'でんわ', reading: 'でんわ', romaji: 'denwa', gloss: 'telephone', pos: 'noun' },
    { lemma: 'パソコン', reading: 'パソコン', romaji: 'pasokon', gloss: 'computer', pos: 'noun' },
    { lemma: 'かいぎ', reading: 'かいぎ', romaji: 'kaigi', gloss: 'a meeting', pos: 'noun' },
    { lemma: 'めいし', reading: 'めいし', romaji: 'meishi', gloss: 'business card', pos: 'noun' },
    { lemma: 'しゃちょう', reading: 'しゃちょう', romaji: 'shachou', gloss: 'company president', pos: 'noun' },
    { lemma: 'ざんぎょう', reading: 'ざんぎょう', romaji: 'zangyou', gloss: 'overtime', pos: 'noun' },
    { lemma: 'きゅうりょう', reading: 'きゅうりょう', romaji: 'kyuuryou', gloss: 'salary', pos: 'noun' },
    { lemma: 'はたらく', reading: 'はたらく', romaji: 'hataraku', gloss: 'to work', pos: 'verb' },
    { lemma: 'うる', reading: 'うる', romaji: 'uru', gloss: 'to sell', pos: 'verb' },
  ],
  time: [
    { lemma: 'いま', reading: 'いま', romaji: 'ima', gloss: 'now', pos: 'noun' },
    { lemma: 'きょう', reading: 'きょう', romaji: 'kyou', gloss: 'today', pos: 'noun' },
    { lemma: 'あした', reading: 'あした', romaji: 'ashita', gloss: 'tomorrow', pos: 'noun' },
    { lemma: 'きのう', reading: 'きのう', romaji: 'kinou', gloss: 'yesterday', pos: 'noun' },
    { lemma: 'ひる', reading: 'ひる', romaji: 'hiru', gloss: 'noon, daytime', pos: 'noun' },
    { lemma: 'ばん', reading: 'ばん', romaji: 'ban', gloss: 'evening', pos: 'noun' },
    { lemma: 'しゅうまつ', reading: 'しゅうまつ', romaji: 'shuumatsu', gloss: 'weekend', pos: 'noun' },
    { lemma: 'まいにち', reading: 'まいにち', romaji: 'mainichi', gloss: 'every day', pos: 'noun' },
    { lemma: 'じかん', reading: 'じかん', romaji: 'jikan', gloss: 'time, an hour', pos: 'noun' },
    { lemma: 'ふん', reading: 'ふん', romaji: 'fun', gloss: 'minute', pos: 'noun' },
    { lemma: 'とし', reading: 'とし', romaji: 'toshi', gloss: 'year, age', pos: 'noun' },
    { lemma: 'つぎ', reading: 'つぎ', romaji: 'tsugi', gloss: 'next', pos: 'noun' },
    { lemma: 'まえ', reading: 'まえ', romaji: 'mae', gloss: 'before, in front', pos: 'noun' },
    { lemma: 'あと', reading: 'あと', romaji: 'ato', gloss: 'after, later', pos: 'noun' },
    { lemma: 'ときどき', reading: 'ときどき', romaji: 'tokidoki', gloss: 'sometimes', pos: 'adverb' },
  ],
  weather: [
    { lemma: 'てんき', reading: 'てんき', romaji: 'tenki', gloss: 'weather', pos: 'noun' },
    { lemma: 'はれ', reading: 'はれ', romaji: 'hare', gloss: 'clear weather', pos: 'noun' },
    { lemma: 'くもり', reading: 'くもり', romaji: 'kumori', gloss: 'cloudy weather', pos: 'noun' },
    { lemma: 'かぜ', reading: 'かぜ', romaji: 'kaze', gloss: 'wind', pos: 'noun' },
    { lemma: 'たいふう', reading: 'たいふう', romaji: 'taifuu', gloss: 'typhoon', pos: 'noun' },
    { lemma: 'はる', reading: 'はる', romaji: 'haru', gloss: 'spring', pos: 'noun' },
    { lemma: 'なつ', reading: 'なつ', romaji: 'natsu', gloss: 'summer', pos: 'noun' },
    { lemma: 'あき', reading: 'あき', romaji: 'aki', gloss: 'autumn', pos: 'noun' },
    { lemma: 'ふゆ', reading: 'ふゆ', romaji: 'fuyu', gloss: 'winter', pos: 'noun' },
    { lemma: 'きせつ', reading: 'きせつ', romaji: 'kisetsu', gloss: 'season', pos: 'noun' },
    // あつい and さむい belong to the first unit. These are the words that unit
    // could not reach, and they are genuinely different: つめたい is cold to the
    // touch, さむい is cold weather.
    { lemma: 'あたたかい', reading: 'あたたかい', romaji: 'atatakai', gloss: 'warm', pos: 'adjective' },
    { lemma: 'つめたい', reading: 'つめたい', romaji: 'tsumetai', gloss: 'cold to the touch', pos: 'adjective' },
    { lemma: 'すずしい', reading: 'すずしい', romaji: 'suzushii', gloss: 'cool, refreshing', pos: 'adjective' },
    { lemma: 'くもる', reading: 'くもる', romaji: 'kumoru', gloss: 'to become cloudy', pos: 'verb' },
    { lemma: 'ふる', reading: 'ふる', romaji: 'furu', gloss: 'to fall (rain or snow)', pos: 'verb' },
  ],
  numbers: [
    { lemma: 'いち', reading: 'いち', romaji: 'ichi', gloss: 'one', pos: 'number' },
    { lemma: 'に', reading: 'に', romaji: 'ni', gloss: 'two', pos: 'number' },
    { lemma: 'さん', reading: 'さん', romaji: 'san', gloss: 'three', pos: 'number' },
    { lemma: 'よん', reading: 'よん', romaji: 'yon', gloss: 'four', pos: 'number' },
    { lemma: 'ご', reading: 'ご', romaji: 'go', gloss: 'five', pos: 'number' },
    { lemma: 'ろく', reading: 'ろく', romaji: 'roku', gloss: 'six', pos: 'number' },
    { lemma: 'なな', reading: 'なな', romaji: 'nana', gloss: 'seven', pos: 'number' },
    { lemma: 'はち', reading: 'はち', romaji: 'hachi', gloss: 'eight', pos: 'number' },
    { lemma: 'きゅう', reading: 'きゅう', romaji: 'kyuu', gloss: 'nine', pos: 'number' },
    { lemma: 'じゅう', reading: 'じゅう', romaji: 'juu', gloss: 'ten', pos: 'number' },
    { lemma: 'ひゃく', reading: 'ひゃく', romaji: 'hyaku', gloss: 'hundred', pos: 'number' },
    { lemma: 'せん', reading: 'せん', romaji: 'sen', gloss: 'thousand', pos: 'number' },
    { lemma: 'まん', reading: 'まん', romaji: 'man', gloss: 'ten thousand', pos: 'number' },
    { lemma: 'いくつ', reading: 'いくつ', romaji: 'ikutsu', gloss: 'how many', pos: 'expression' },
    { lemma: 'いくら', reading: 'いくら', romaji: 'ikura', gloss: 'how much', pos: 'expression' },
  ],
  verbs: [
    { lemma: 'あう', reading: 'あう', romaji: 'au', gloss: 'to meet', pos: 'verb' },
    { lemma: 'まつ', reading: 'まつ', romaji: 'matsu', gloss: 'to wait', pos: 'verb' },
    { lemma: 'かえる', reading: 'かえる', romaji: 'kaeru', gloss: 'to return home', pos: 'verb' },
    { lemma: 'おきる', reading: 'おきる', romaji: 'okiru', gloss: 'to get up', pos: 'verb' },
    { lemma: 'ねる', reading: 'ねる', romaji: 'neru', gloss: 'to sleep', pos: 'verb' },
    { lemma: 'あそぶ', reading: 'あそぶ', romaji: 'asobu', gloss: 'to play', pos: 'verb' },
    { lemma: 'およぐ', reading: 'およぐ', romaji: 'oyogu', gloss: 'to swim', pos: 'verb' },
    { lemma: 'うたう', reading: 'うたう', romaji: 'utau', gloss: 'to sing', pos: 'verb' },
    { lemma: 'つくる', reading: 'つくる', romaji: 'tsukuru', gloss: 'to make', pos: 'verb' },
    { lemma: 'もらう', reading: 'もらう', romaji: 'morau', gloss: 'to receive', pos: 'verb' },
    { lemma: 'あげる', reading: 'あげる', romaji: 'ageru', gloss: 'to give', pos: 'verb' },
    { lemma: 'おしえる', reading: 'おしえる', romaji: 'oshieru', gloss: 'to teach', pos: 'verb' },
    { lemma: 'おぼえる', reading: 'おぼえる', romaji: 'oboeru', gloss: 'to memorise', pos: 'verb' },
    { lemma: 'わかる', reading: 'わかる', romaji: 'wakaru', gloss: 'to understand', pos: 'verb' },
    { lemma: 'しる', reading: 'しる', romaji: 'shiru', gloss: 'to know', pos: 'verb' },
    { lemma: 'つかう', reading: 'つかう', romaji: 'tsukau', gloss: 'to use', pos: 'verb' },
    { lemma: 'あらう', reading: 'あらう', romaji: 'arau', gloss: 'to wash', pos: 'verb' },
    { lemma: 'いれる', reading: 'いれる', romaji: 'ireru', gloss: 'to put in', pos: 'verb' },
    { lemma: 'だす', reading: 'だす', romaji: 'dasu', gloss: 'to take out, to send', pos: 'verb' },
    { lemma: 'すわる', reading: 'すわる', romaji: 'suwaru', gloss: 'to sit', pos: 'verb' },
  ],
  descriptions: [
    { lemma: 'ながい', reading: 'ながい', romaji: 'nagai', gloss: 'long', pos: 'adjective' },
    { lemma: 'みじかい', reading: 'みじかい', romaji: 'mijikai', gloss: 'short', pos: 'adjective' },
    { lemma: 'ひろい', reading: 'ひろい', romaji: 'hiroi', gloss: 'spacious, wide', pos: 'adjective' },
    { lemma: 'せまい', reading: 'せまい', romaji: 'semai', gloss: 'narrow, cramped', pos: 'adjective' },
    { lemma: 'おもい', reading: 'おもい', romaji: 'omoi', gloss: 'heavy', pos: 'adjective' },
    { lemma: 'かるい', reading: 'かるい', romaji: 'karui', gloss: 'light in weight', pos: 'adjective' },
    { lemma: 'はやい', reading: 'はやい', romaji: 'hayai', gloss: 'fast, early', pos: 'adjective' },
    { lemma: 'おそい', reading: 'おそい', romaji: 'osoi', gloss: 'slow, late', pos: 'adjective' },
    { lemma: 'つよい', reading: 'つよい', romaji: 'tsuyoi', gloss: 'strong', pos: 'adjective' },
    { lemma: 'よわい', reading: 'よわい', romaji: 'yowai', gloss: 'weak', pos: 'adjective' },
    { lemma: 'あかるい', reading: 'あかるい', romaji: 'akarui', gloss: 'bright', pos: 'adjective' },
    { lemma: 'くらい', reading: 'くらい', romaji: 'kurai', gloss: 'dark', pos: 'adjective' },
    { lemma: 'しずか', reading: 'しずか', romaji: 'shizuka', gloss: 'quiet', pos: 'adjective' },
    { lemma: 'にぎやか', reading: 'にぎやか', romaji: 'nigiyaka', gloss: 'lively, bustling', pos: 'adjective' },
    { lemma: 'きれい', reading: 'きれい', romaji: 'kirei', gloss: 'pretty, clean', pos: 'adjective' },
    { lemma: 'ゆうめい', reading: 'ゆうめい', romaji: 'yuumei', gloss: 'famous', pos: 'adjective' },
    { lemma: 'とても', reading: 'とても', romaji: 'totemo', gloss: 'very', pos: 'adverb' },
    { lemma: 'すこし', reading: 'すこし', romaji: 'sukoshi', gloss: 'a little', pos: 'adverb' },
    { lemma: 'たくさん', reading: 'たくさん', romaji: 'takusan', gloss: 'a lot', pos: 'adverb' },
    { lemma: 'ぜんぜん', reading: 'ぜんぜん', romaji: 'zenzen', gloss: 'not at all', pos: 'adverb' },
  ],
};

export const VOCAB_EVERYDAY_UNIT = 'vocab-everyday';

/**
 * Fourteen lessons, one theme each, same as the first unit's shape — a lesson
 * about the kitchen is one thing to learn, a lesson of fifteen unrelated words
 * is fifteen.
 *
 * Fifteen words per lesson rather than the first unit's ten. The first unit was
 * someone's first contact with Japanese words at all; by here a learner has
 * finished 34 lessons and reads all of kana, so the pace can pick up. The last
 * two lessons carry twenty, because verbs and adjectives are the two groups
 * where having *more* to compare is what makes each one stick.
 *
 * `multipleChoice` throughout: these are word → meaning, the same recognition
 * direction the first unit uses. The typing exercise stays with the marks-words
 * units, where producing the exact romaji is the point.
 */
export const VOCAB_EVERYDAY_LESSONS: VocabLessonSeed[] = [
  { order: 0, title: 'Words: food and drink', groups: ['food'], exerciseTypes: ['multipleChoice'] },
  { order: 1, title: 'Words: family, politely', groups: ['family'], exerciseTypes: ['multipleChoice'] },
  { order: 2, title: 'Words: the body and health', groups: ['body'], exerciseTypes: ['multipleChoice'] },
  { order: 3, title: 'Words: around the house', groups: ['home'], exerciseTypes: ['multipleChoice'] },
  { order: 4, title: 'Words: clothes', groups: ['clothes'], exerciseTypes: ['multipleChoice'] },
  { order: 5, title: 'Words: around town', groups: ['town'], exerciseTypes: ['multipleChoice'] },
  { order: 6, title: 'Words: getting around', groups: ['transport'], exerciseTypes: ['multipleChoice'] },
  { order: 7, title: 'Words: school and study', groups: ['school'], exerciseTypes: ['multipleChoice'] },
  { order: 8, title: 'Words: work and money', groups: ['work'], exerciseTypes: ['multipleChoice'] },
  { order: 9, title: 'Words: time and the calendar', groups: ['time'], exerciseTypes: ['multipleChoice'] },
  { order: 10, title: 'Words: weather and seasons', groups: ['weather'], exerciseTypes: ['multipleChoice'] },
  { order: 11, title: 'Words: numbers and counting', groups: ['numbers'], exerciseTypes: ['multipleChoice'] },
  { order: 12, title: 'Words: more everyday verbs', groups: ['verbs'], exerciseTypes: ['multipleChoice'] },
  { order: 13, title: 'Words: describing things', groups: ['descriptions'], exerciseTypes: ['multipleChoice'] },
];

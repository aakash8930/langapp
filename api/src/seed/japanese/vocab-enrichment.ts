/**
 * Enrichment data: example sentences, synonyms, and antonyms
 * for the seeded vocabulary. Applied by `npm run seed:enrich-vocab`.
 *
 * Each entry is keyed by lemma and updates the existing document
 * — it never creates new vocab items.
 */

interface VocabEnrichment {
  lemma: string;
  examples?: { sentence: string; reading?: string; romaji?: string; gloss: string }[];
  synonyms?: string[];
  antonyms?: string[];
}

export const VOCAB_ENRICHMENTS: VocabEnrichment[] = [
  // ---- people ----
  {
    lemma: 'わたし',
    examples: [
      { sentence: 'わたしは　がくせいです。', romaji: 'watashi wa gakusei desu.', gloss: 'I am a student.' },
    ],
    synonyms: ['ぼく', 'おれ'],
    antonyms: ['あなた'],
  },
  {
    lemma: 'あなた',
    examples: [
      { sentence: 'あなたの　なまえは？', romaji: 'anata no namae wa?', gloss: 'What is your name?' },
    ],
    synonyms: ['きみ'],
    antonyms: ['わたし'],
  },
  {
    lemma: 'ひと',
    examples: [
      { sentence: 'あの　ひとは　せんせいです。', romaji: 'ano hito wa sensei desu.', gloss: 'That person is a teacher.' },
    ],
    synonyms: ['にんげん'],
    antonyms: [],
  },
  {
    lemma: 'おとこ',
    examples: [
      { sentence: 'おとこの　こが　います。', romaji: 'otoko no ko ga imasu.', gloss: 'There is a boy.' },
    ],
    synonyms: ['だんせい', 'おとこのこ'],
    antonyms: ['おんな'],
  },
  {
    lemma: 'おんな',
    examples: [
      { sentence: 'おんなの　こが　います。', romaji: 'onna no ko ga imasu.', gloss: 'There is a girl.' },
    ],
    synonyms: ['じょせい', 'おんなのこ'],
    antonyms: ['おとこ'],
  },
  {
    lemma: 'せんせい',
    examples: [
      { sentence: 'せんせいは　やさしいです。', romaji: 'sensei wa yasashii desu.', gloss: 'The teacher is kind.' },
    ],
    synonyms: ['きょうし'],
    antonyms: ['がくせい'],
  },
  {
    lemma: 'なまえ',
    examples: [
      { sentence: 'なまえを　かいて　ください。', romaji: 'namae o kaite kudasai.', gloss: 'Please write your name.' },
    ],
    synonyms: [],
    antonyms: [],
  },
  {
    lemma: 'ちち',
    examples: [
      { sentence: 'ちちは　かいしゃいんです。', romaji: 'chichi wa kaishain desu.', gloss: 'My father is a company employee.' },
    ],
    synonyms: ['おとうさん'],
    antonyms: ['はは'],
  },
  {
    lemma: 'はは',
    examples: [
      { sentence: 'ははは　りょうりが　じょうずです。', romaji: 'haha wa ryouri ga jouzu desu.', gloss: 'My mother is good at cooking.' },
    ],
    synonyms: ['おかあさん'],
    antonyms: ['ちち'],
  },

  // ---- things ----
  {
    lemma: 'ほん',
    examples: [
      { sentence: 'この　ほんは　おもしろいです。', romaji: 'kono hon wa omoshiroi desu.', gloss: 'This book is interesting.' },
    ],
    synonyms: ['しょせき'],
    antonyms: [],
  },
  {
    lemma: 'くるま',
    examples: [
      { sentence: 'あかい　くるまが　あります。', romaji: 'akai kuruma ga arimasu.', gloss: 'There is a red car.' },
    ],
    synonyms: ['じどうしゃ'],
    antonyms: [],
  },
  {
    lemma: 'いえ',
    examples: [
      { sentence: 'おおきい　いえですね。', romaji: 'ookii ie desu ne.', gloss: 'That is a big house, isn\'t it?' },
    ],
    synonyms: ['じゅうたく', 'うち'],
    antonyms: [],
  },

  // ---- nature ----
  {
    lemma: 'やま',
    examples: [
      { sentence: 'やまに　のぼります。', romaji: 'yama ni noborimasu.', gloss: 'I climb the mountain.' },
    ],
    synonyms: [],
    antonyms: ['うみ'],
  },
  {
    lemma: 'うみ',
    examples: [
      { sentence: 'うみで　およぎます。', romaji: 'umi de oyogimasu.', gloss: 'I swim in the sea.' },
    ],
    synonyms: [],
    antonyms: ['やま'],
  },
  {
    lemma: 'そら',
    examples: [
      { sentence: 'そらが　あおいです。', romaji: 'sora ga aoi desu.', gloss: 'The sky is blue.' },
    ],
    synonyms: ['てん'],
    antonyms: [],
  },
  {
    lemma: 'あめ',
    examples: [
      { sentence: 'きょうは　あめです。', romaji: 'kyou wa ame desu.', gloss: 'It is raining today.' },
    ],
    synonyms: [],
    antonyms: ['はれ'],
  },
  {
    lemma: 'あさ',
    examples: [
      { sentence: 'あさ　ごはんを　たべます。', romaji: 'asa gohan o tabemasu.', gloss: 'I eat breakfast.' },
    ],
    synonyms: [],
    antonyms: ['よる'],
  },
  {
    lemma: 'よる',
    examples: [
      { sentence: 'よる　ねます。', romaji: 'yoru nemasu.', gloss: 'I sleep at night.' },
    ],
    synonyms: [],
    antonyms: ['あさ'],
  },

  // ---- verbs ----
  {
    lemma: 'のむ',
    examples: [
      { sentence: 'みずを　のみます。', romaji: 'mizu o nomimasu.', gloss: 'I drink water.' },
    ],
    synonyms: [],
    antonyms: ['たべる'],
  },
  {
    lemma: 'かう',
    examples: [
      { sentence: 'みせで　ほんを　かいます。', romaji: 'mise de hon o kaimasu.', gloss: 'I buy a book at the shop.' },
    ],
    synonyms: ['こうにゅうする'],
    antonyms: ['うる'],
  },
  {
    lemma: 'みる',
    examples: [
      { sentence: 'テレビを　みます。', romaji: 'terebi o mimasu.', gloss: 'I watch TV.' },
    ],
    synonyms: ['けんぶつする'],
    antonyms: [],
  },
  {
    lemma: 'きく',
    examples: [
      { sentence: 'おんがくを　ききます。', romaji: 'ongaku o kikimasu.', gloss: 'I listen to music.' },
    ],
    synonyms: [],
    antonyms: ['はなす'],
  },
  {
    lemma: 'はなす',
    examples: [
      { sentence: 'にほんごを　はなします。', romaji: 'nihongo o hanashimasu.', gloss: 'I speak Japanese.' },
    ],
    synonyms: ['しゃべる'],
    antonyms: ['きく'],
  },
  {
    lemma: 'よむ',
    examples: [
      { sentence: 'まいにち　ほんを　よみます。', romaji: 'mainichi hon o yomimasu.', gloss: 'I read a book every day.' },
    ],
    synonyms: [],
    antonyms: ['かく'],
  },
  {
    lemma: 'かく',
    examples: [
      { sentence: 'てがみを　かきます。', romaji: 'tegami o kakimasu.', gloss: 'I write a letter.' },
    ],
    synonyms: [],
    antonyms: ['よむ'],
  },
  {
    lemma: 'いく',
    examples: [
      { sentence: 'がっこうに　いきます。', romaji: 'gakkou ni ikimasu.', gloss: 'I go to school.' },
    ],
    synonyms: [],
    antonyms: ['くる'],
  },
  {
    lemma: 'くる',
    examples: [
      { sentence: 'ともだちが　きます。', romaji: 'tomodachi ga kimasu.', gloss: 'A friend is coming.' },
    ],
    synonyms: [],
    antonyms: ['いく'],
  },
  {
    lemma: 'する',
    examples: [
      { sentence: 'しゅくだいを　します。', romaji: 'shukudai o shimasu.', gloss: 'I do homework.' },
    ],
    synonyms: ['やる'],
    antonyms: [],
  },

  // ---- adjectives ----
  {
    lemma: 'おおきい',
    examples: [
      { sentence: 'おおきい　ねこです。', romaji: 'ookii neko desu.', gloss: 'It is a big cat.' },
    ],
    synonyms: ['でかい'],
    antonyms: ['ちいさい'],
  },
  {
    lemma: 'ちいさい',
    examples: [
      { sentence: 'ちいさい　いぬです。', romaji: 'chiisai inu desu.', gloss: 'It is a small dog.' },
    ],
    synonyms: [],
    antonyms: ['おおきい'],
  },
  {
    lemma: 'たかい',
    examples: [
      { sentence: 'たかい　やまです。', romaji: 'takai yama desu.', gloss: 'It is a tall mountain.' },
    ],
    synonyms: ['こうか'],
    antonyms: ['やすい'],
  },
  {
    lemma: 'やすい',
    examples: [
      { sentence: 'この　ほんは　やすいです。', romaji: 'kono hon wa yasui desu.', gloss: 'This book is cheap.' },
    ],
    synonyms: [],
    antonyms: ['たかい'],
  },
  {
    lemma: 'あつい',
    examples: [
      { sentence: 'きょうは　あついですね。', romaji: 'kyou wa atsui desu ne.', gloss: 'It is hot today, isn\'t it?' },
    ],
    synonyms: ['しょねつ'],
    antonyms: ['さむい'],
  },
  {
    lemma: 'さむい',
    examples: [
      { sentence: 'ふゆは　さむいです。', romaji: 'fuyu wa samui desu.', gloss: 'Winter is cold.' },
    ],
    synonyms: [],
    antonyms: ['あつい'],
  },
  {
    lemma: 'あたらしい',
    examples: [
      { sentence: 'あたらしい　くるまです。', romaji: 'atarashii kuruma desu.', gloss: 'It is a new car.' },
    ],
    synonyms: ['しんせん'],
    antonyms: ['ふるい'],
  },
  {
    lemma: 'ふるい',
    examples: [
      { sentence: 'ふるい　とけいです。', romaji: 'furui tokei desu.', gloss: 'It is an old clock.' },
    ],
    synonyms: [],
    antonyms: ['あたらしい'],
  },
  {
    lemma: 'おいしい',
    examples: [
      { sentence: 'この　りょうりは　おいしいです。', romaji: 'kono ryouri wa oishii desu.', gloss: 'This food is delicious.' },
    ],
    synonyms: ['うまい'],
    antonyms: ['まずい'],
  },
  {
    lemma: 'たのしい',
    examples: [
      { sentence: 'たのしい　いちにちでした。', romaji: 'tanoshii ichinichi deshita.', gloss: 'It was a fun day.' },
    ],
    synonyms: ['ゆかい', 'おもしろい'],
    antonyms: ['つまらない'],
  },

  // ---- greetings ----
  {
    lemma: 'こんにちは',
    examples: [
      { sentence: 'こんにちは、おげんきですか。', romaji: 'konnichiwa, ogenki desu ka.', gloss: 'Hello, how are you?' },
    ],
    synonyms: [],
    antonyms: ['さようなら'],
  },
  {
    lemma: 'おはよう',
    examples: [
      { sentence: 'おはよう　ございます。', romaji: 'ohayou gozaimasu.', gloss: 'Good morning.' },
    ],
    synonyms: [],
    antonyms: ['おやすみ'],
  },
  {
    lemma: 'おやすみ',
    examples: [
      { sentence: 'おやすみ　なさい。', romaji: 'oyasumi nasai.', gloss: 'Good night.' },
    ],
    synonyms: [],
    antonyms: ['おはよう'],
  },
  {
    lemma: 'さようなら',
    examples: [
      { sentence: 'さようなら、また　あした。', romaji: 'sayounara, mata ashita.', gloss: 'Goodbye, see you tomorrow.' },
    ],
    synonyms: ['じゃあね', 'バイバイ'],
    antonyms: ['こんにちは'],
  },
  {
    lemma: 'すみません',
    examples: [
      { sentence: 'すみません、とけいは　どこですか。', romaji: 'sumimasen, tokei wa doko desu ka.', gloss: 'Excuse me, where is the clock?' },
    ],
    synonyms: ['ごめんなさい'],
    antonyms: [],
  },
  {
    lemma: 'はい',
    examples: [
      { sentence: 'はい、わかりました。', romaji: 'hai, wakarimashita.', gloss: 'Yes, I understand.' },
    ],
    synonyms: ['ええ'],
    antonyms: ['いいえ'],
  },
  {
    lemma: 'いいえ',
    examples: [
      { sentence: 'いいえ、ちがいます。', romaji: 'iie, chigaimasu.', gloss: 'No, that is wrong.' },
    ],
    synonyms: [],
    antonyms: ['はい'],
  },

  // ---- nature extras ----
  {
    lemma: 'はな',
    examples: [
      { sentence: 'きれいな　はなですね。', romaji: 'kirei na hana desu ne.', gloss: 'Beautiful flowers, aren\'t they?' },
    ],
    synonyms: [],
    antonyms: [],
  },
  {
    lemma: 'ゆき',
    examples: [
      { sentence: 'ゆきが　ふっています。', romaji: 'yuki ga futte imasu.', gloss: 'It is snowing.' },
    ],
    synonyms: [],
    antonyms: [],
  },
  {
    lemma: 'つき',
    examples: [
      { sentence: 'つきが　きれいです。', romaji: 'tsuki ga kirei desu.', gloss: 'The moon is beautiful.' },
    ],
    synonyms: [],
    antonyms: ['たいよう'],
  },
  {
    lemma: 'ほし',
    examples: [
      { sentence: 'ほしが　たくさん　あります。', romaji: 'hoshi ga takusan arimasu.', gloss: 'There are many stars.' },
    ],
    synonyms: [],
    antonyms: [],
  },

  // ---- things extras ----
  {
    lemma: 'みせ',
    examples: [
      { sentence: 'みせは　あそこです。', romaji: 'mise wa asoko desu.', gloss: 'The shop is over there.' },
    ],
    synonyms: ['しょうてん'],
    antonyms: [],
  },
  {
    lemma: 'とけい',
    examples: [
      { sentence: 'とけいを　みて　ください。', romaji: 'tokei o mite kudasai.', gloss: 'Please look at the clock.' },
    ],
    synonyms: [],
    antonyms: [],
  },
];

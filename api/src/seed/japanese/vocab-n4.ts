import type { VocabSeed, VocabLessonSeed } from './vocab';

/**
 * The first N4 vocabulary unit — 127 words that move past the N5 pack's
 * concrete, everyday nouns into the more abstract register N4 asks for:
 * opinions, causes and results, workplace language, and the connective
 * adverbs a learner needs to talk about anything more complex than "I eat
 * an apple."
 *
 * ## Why kana-only, matching the N5 packs
 *
 * `lemma` equals `reading` here, the same choice `vocab.ts` and `vocab-n5.ts`
 * made and for the same reason: kanji spelling is a Phase 3+ concern (see the
 * note on `VocabItem.constituentKana`), and mixing scripts now would be a
 * second, unrelated departure bundled into this one. `kanji-n4.ts` is the
 * kanji re-reading of this same vocabulary, exactly as `kanji.ts` was for N5.
 *
 * ## Why these words and not the "official" ~1500
 *
 * N5 itself started as 58 words in `vocab.ts` and only reached its ~800-word
 * scope later, in `vocab-n5.ts`. This is the same first step for N4: a
 * curated, correctly-levelled starting pack rather than a bulk import, sized
 * so every word could be checked individually — for genuine N4-ness, for no
 * collision with a lemma the N5 packs already own (checked mechanically
 * against all four earlier vocab units), and for romaji that actually
 * matches its kana (`vocab-n4.spec.ts` and the shared `romaji.spec.ts`
 * transliterator both check this). Extending it the way `vocab-n5.ts`
 * extended `vocab.ts` is the natural next step, not a rewrite.
 *
 * ## A note on register
 *
 * Several groups here are noun/suru-verb pairs (れんらく — "contact", also
 * "to contact" as れんらくする) rather than the noun/verb split N5 used.
 * `pos: 'noun'` follows the precedent already set by しんぱい and きんちょう
 * in `vocab-n5.ts` — tag the citation form, not every way the word inflects.
 */
export const VOCAB_N4_GROUPS: Record<string, VocabSeed[]> = {
  time_frequency: [
    { lemma: 'さいきん', reading: 'さいきん', romaji: 'saikin', gloss: 'recently, lately', pos: 'adverb' },
    { lemma: 'まいばん', reading: 'まいばん', romaji: 'maiban', gloss: 'every night', pos: 'adverb' },
    { lemma: 'しばらく', reading: 'しばらく', romaji: 'shibaraku', gloss: 'for a while', pos: 'adverb' },
    { lemma: 'とつぜん', reading: 'とつぜん', romaji: 'totsuzen', gloss: 'suddenly', pos: 'adverb' },
    { lemma: 'もうすぐ', reading: 'もうすぐ', romaji: 'mousugu', gloss: 'soon, before long', pos: 'adverb' },
    { lemma: 'そろそろ', reading: 'そろそろ', romaji: 'sorosoro', gloss: 'soon, it is about time', pos: 'adverb' },
    { lemma: 'このごろ', reading: 'このごろ', romaji: 'konogoro', gloss: 'these days', pos: 'adverb' },
    { lemma: 'いつか', reading: 'いつか', romaji: 'itsuka', gloss: 'someday', pos: 'adverb' },
    { lemma: 'いつのまにか', reading: 'いつのまにか', romaji: 'itsunomanika', gloss: 'before one knows it', pos: 'adverb' },
    { lemma: 'とうとう', reading: 'とうとう', romaji: 'toutou', gloss: 'finally, at last', pos: 'adverb' },
    { lemma: 'しょっちゅう', reading: 'しょっちゅう', romaji: 'shocchuu', gloss: 'constantly, all the time', pos: 'adverb' },
    { lemma: 'めったに', reading: 'めったに', romaji: 'mettani', gloss: 'rarely, seldom', pos: 'adverb' },
  ],
  feelings_reactions: [
    { lemma: 'あきらめる', reading: 'あきらめる', romaji: 'akirameru', gloss: 'to give up', pos: 'verb' },
    { lemma: 'がっかりする', reading: 'がっかりする', romaji: 'gakkarisuru', gloss: 'to be disappointed', pos: 'verb' },
    { lemma: 'かんどうする', reading: 'かんどうする', romaji: 'kandousuru', gloss: 'to be moved, touched', pos: 'verb' },
    { lemma: 'こうかいする', reading: 'こうかいする', romaji: 'koukaisuru', gloss: 'to regret', pos: 'verb' },
    { lemma: 'きにする', reading: 'きにする', romaji: 'kinisuru', gloss: 'to mind, worry about', pos: 'verb' },
    { lemma: 'まんぞくする', reading: 'まんぞくする', romaji: 'manzokusuru', gloss: 'to be satisfied', pos: 'verb' },
    { lemma: 'なやむ', reading: 'なやむ', romaji: 'nayamu', gloss: 'to agonize, worry over', pos: 'verb' },
    { lemma: 'しんらい', reading: 'しんらい', romaji: 'shinrai', gloss: 'trust', pos: 'noun' },
    { lemma: 'ゆうじょう', reading: 'ゆうじょう', romaji: 'yuujou', gloss: 'friendship', pos: 'noun' },
    { lemma: 'きたい', reading: 'きたい', romaji: 'kitai', gloss: 'expectation, hope', pos: 'noun' },
    { lemma: 'ふあん', reading: 'ふあん', romaji: 'fuan', gloss: 'anxiety, unease', pos: 'adjective' },
    { lemma: 'ざんねん', reading: 'ざんねん', romaji: 'zannen', gloss: 'regrettable, a pity', pos: 'adjective' },
  ],
  daily_life_verbs: [
    { lemma: 'えらぶ', reading: 'えらぶ', romaji: 'erabu', gloss: 'to choose', pos: 'verb' },
    { lemma: 'くらべる', reading: 'くらべる', romaji: 'kuraberu', gloss: 'to compare', pos: 'verb' },
    { lemma: 'かわる', reading: 'かわる', romaji: 'kawaru', gloss: 'to change (intransitive)', pos: 'verb' },
    { lemma: 'つたわる', reading: 'つたわる', romaji: 'tsutawaru', gloss: 'to be conveyed, transmitted', pos: 'verb' },
    { lemma: 'そだつ', reading: 'そだつ', romaji: 'sodatsu', gloss: 'to grow up (intransitive)', pos: 'verb' },
    { lemma: 'そだてる', reading: 'そだてる', romaji: 'sodateru', gloss: 'to raise, bring up', pos: 'verb' },
    { lemma: 'まもる', reading: 'まもる', romaji: 'mamoru', gloss: 'to protect, keep (a promise)', pos: 'verb' },
    { lemma: 'ゆるす', reading: 'ゆるす', romaji: 'yurusu', gloss: 'to forgive, allow', pos: 'verb' },
    { lemma: 'しらせる', reading: 'しらせる', romaji: 'shiraseru', gloss: 'to inform, let know', pos: 'verb' },
    { lemma: 'つづける', reading: 'つづける', romaji: 'tsuzukeru', gloss: 'to continue (something)', pos: 'verb' },
    { lemma: 'がんばる', reading: 'がんばる', romaji: 'ganbaru', gloss: 'to do one\'s best, persevere', pos: 'verb' },
    { lemma: 'やせる', reading: 'やせる', romaji: 'yaseru', gloss: 'to lose weight', pos: 'verb' },
    { lemma: 'ふとる', reading: 'ふとる', romaji: 'futoru', gloss: 'to gain weight', pos: 'verb' },
  ],
  work_school: [
    { lemma: 'きんむ', reading: 'きんむ', romaji: 'kinmu', gloss: 'employment, work duty', pos: 'noun' },
    { lemma: 'しゅっちょう', reading: 'しゅっちょう', romaji: 'shucchou', gloss: 'business trip', pos: 'noun' },
    { lemma: 'たんとう', reading: 'たんとう', romaji: 'tantou', gloss: 'person in charge', pos: 'noun' },
    { lemma: 'せきにん', reading: 'せきにん', romaji: 'sekinin', gloss: 'responsibility', pos: 'noun' },
    { lemma: 'きろく', reading: 'きろく', romaji: 'kiroku', gloss: 'record', pos: 'noun' },
    { lemma: 'ていあん', reading: 'ていあん', romaji: 'teian', gloss: 'proposal', pos: 'noun' },
    { lemma: 'ていしゅつ', reading: 'ていしゅつ', romaji: 'teishutsu', gloss: 'submission', pos: 'noun' },
    { lemma: 'かいけつ', reading: 'かいけつ', romaji: 'kaiketsu', gloss: 'solution, resolution', pos: 'noun' },
    { lemma: 'もくひょう', reading: 'もくひょう', romaji: 'mokuhyou', gloss: 'goal, target', pos: 'noun' },
    { lemma: 'どりょく', reading: 'どりょく', romaji: 'doryoku', gloss: 'effort', pos: 'noun' },
    { lemma: 'せいこう', reading: 'せいこう', romaji: 'seikou', gloss: 'success', pos: 'noun' },
    { lemma: 'しっぱい', reading: 'しっぱい', romaji: 'shippai', gloss: 'failure', pos: 'noun' },
  ],
  abstract_concepts: [
    { lemma: 'げんいん', reading: 'げんいん', romaji: 'genin', gloss: 'cause', pos: 'noun' },
    { lemma: 'えいきょう', reading: 'えいきょう', romaji: 'eikyou', gloss: 'influence', pos: 'noun' },
    { lemma: 'とくちょう', reading: 'とくちょう', romaji: 'tokuchou', gloss: 'characteristic, feature', pos: 'noun' },
    { lemma: 'じょうたい', reading: 'じょうたい', romaji: 'joutai', gloss: 'condition, state', pos: 'noun' },
    { lemma: 'ばあい', reading: 'ばあい', romaji: 'baai', gloss: 'case, situation', pos: 'noun' },
    { lemma: 'わりあい', reading: 'わりあい', romaji: 'wariai', gloss: 'proportion, percentage', pos: 'noun' },
    { lemma: 'へいきん', reading: 'へいきん', romaji: 'heikin', gloss: 'average', pos: 'noun' },
    { lemma: 'ごうけい', reading: 'ごうけい', romaji: 'goukei', gloss: 'total, sum', pos: 'noun' },
    { lemma: 'きょうつう', reading: 'きょうつう', romaji: 'kyoutsuu', gloss: 'common, shared', pos: 'noun' },
    { lemma: 'かんけい', reading: 'かんけい', romaji: 'kankei', gloss: 'relationship, connection', pos: 'noun' },
    { lemma: 'かんせい', reading: 'かんせい', romaji: 'kansei', gloss: 'completion', pos: 'noun' },
    { lemma: 'はったつ', reading: 'はったつ', romaji: 'hattatsu', gloss: 'development', pos: 'noun' },
  ],
  shopping_service: [
    { lemma: 'うけつけ', reading: 'うけつけ', romaji: 'uketsuke', gloss: 'reception desk', pos: 'noun' },
    { lemma: 'りょうきん', reading: 'りょうきん', romaji: 'ryoukin', gloss: 'fee, charge', pos: 'noun' },
    { lemma: 'へんぴん', reading: 'へんぴん', romaji: 'henpin', gloss: 'return of goods', pos: 'noun' },
    { lemma: 'こうかん', reading: 'こうかん', romaji: 'koukan', gloss: 'exchange', pos: 'noun' },
    { lemma: 'しちゃく', reading: 'しちゃく', romaji: 'shichaku', gloss: 'trying on (clothes)', pos: 'noun' },
    { lemma: 'ちゅうもん', reading: 'ちゅうもん', romaji: 'chuumon', gloss: 'order (at a shop)', pos: 'noun' },
    { lemma: 'せいきゅうしょ', reading: 'せいきゅうしょ', romaji: 'seikyuusho', gloss: 'invoice, bill', pos: 'noun' },
    { lemma: 'かでん', reading: 'かでん', romaji: 'kaden', gloss: 'home appliances', pos: 'noun' },
  ],
  health_body: [
    { lemma: 'たいいん', reading: 'たいいん', romaji: 'taiin', gloss: 'discharge from hospital', pos: 'noun' },
    { lemma: 'にゅういん', reading: 'にゅういん', romaji: 'nyuuin', gloss: 'hospitalization', pos: 'noun' },
    { lemma: 'ちりょう', reading: 'ちりょう', romaji: 'chiryou', gloss: 'medical treatment', pos: 'noun' },
    { lemma: 'たいじゅう', reading: 'たいじゅう', romaji: 'taijuu', gloss: 'body weight', pos: 'noun' },
    { lemma: 'しんちょう', reading: 'しんちょう', romaji: 'shinchou', gloss: 'height, stature', pos: 'noun' },
    { lemma: 'けんこう', reading: 'けんこう', romaji: 'kenkou', gloss: 'health', pos: 'noun' },
    { lemma: 'かんごし', reading: 'かんごし', romaji: 'kangoshi', gloss: 'nurse', pos: 'noun' },
    { lemma: 'ちゅうしゃ', reading: 'ちゅうしゃ', romaji: 'chuusha', gloss: 'injection', pos: 'noun' },
  ],
  weather_extended: [
    { lemma: 'てんきよほう', reading: 'てんきよほう', romaji: 'tenkiyohou', gloss: 'weather forecast', pos: 'noun' },
    { lemma: 'かみなり', reading: 'かみなり', romaji: 'kaminari', gloss: 'thunder', pos: 'noun' },
    { lemma: 'にじ', reading: 'にじ', romaji: 'niji', gloss: 'rainbow', pos: 'noun' },
    { lemma: 'むしあつい', reading: 'むしあつい', romaji: 'mushiatsui', gloss: 'hot and humid', pos: 'adjective' },
    { lemma: 'かんそう', reading: 'かんそう', romaji: 'kansou', gloss: 'dryness', pos: 'noun' },
    { lemma: 'しつど', reading: 'しつど', romaji: 'shitsudo', gloss: 'humidity', pos: 'noun' },
    { lemma: 'おんど', reading: 'おんど', romaji: 'ondo', gloss: 'temperature', pos: 'noun' },
    { lemma: 'きおん', reading: 'きおん', romaji: 'kion', gloss: 'air temperature', pos: 'noun' },
    { lemma: 'つゆ', reading: 'つゆ', romaji: 'tsuyu', gloss: 'the rainy season', pos: 'noun' },
  ],
  town_transport: [
    { lemma: 'おうだんほどう', reading: 'おうだんほどう', romaji: 'oudanhodou', gloss: 'pedestrian crossing', pos: 'noun' },
    { lemma: 'ちかみち', reading: 'ちかみち', romaji: 'chikamichi', gloss: 'shortcut', pos: 'noun' },
    { lemma: 'とおまわり', reading: 'とおまわり', romaji: 'toomawari', gloss: 'detour, roundabout way', pos: 'noun' },
    { lemma: 'みちじゅん', reading: 'みちじゅん', romaji: 'michijun', gloss: 'route, directions', pos: 'noun' },
    { lemma: 'のりかえ', reading: 'のりかえ', romaji: 'norikae', gloss: 'transfer (trains)', pos: 'noun' },
    { lemma: 'ふみきり', reading: 'ふみきり', romaji: 'fumikiri', gloss: 'railway crossing', pos: 'noun' },
    { lemma: 'とっきゅう', reading: 'とっきゅう', romaji: 'tokkyuu', gloss: 'limited express train', pos: 'noun' },
    { lemma: 'きゅうこう', reading: 'きゅうこう', romaji: 'kyuukou', gloss: 'rapid train', pos: 'noun' },
    { lemma: 'みぎがわ', reading: 'みぎがわ', romaji: 'migigawa', gloss: 'right side', pos: 'noun' },
    { lemma: 'ひだりがわ', reading: 'ひだりがわ', romaji: 'hidarigawa', gloss: 'left side', pos: 'noun' },
    { lemma: 'ふつう', reading: 'ふつう', romaji: 'futsuu', gloss: 'normal, usually', pos: 'adjective' },
    { lemma: 'きんじょ', reading: 'きんじょ', romaji: 'kinjo', gloss: 'neighborhood', pos: 'noun' },
    { lemma: 'やちん', reading: 'やちん', romaji: 'yachin', gloss: 'rent', pos: 'noun' },
    { lemma: 'ひっこし', reading: 'ひっこし', romaji: 'hikkoshi', gloss: 'moving house', pos: 'noun' },
  ],
  adverbs_degree: [
    { lemma: 'かならず', reading: 'かならず', romaji: 'kanarazu', gloss: 'certainly, without fail', pos: 'adverb' },
    { lemma: 'かなり', reading: 'かなり', romaji: 'kanari', gloss: 'fairly, considerably', pos: 'adverb' },
    { lemma: 'だいたい', reading: 'だいたい', romaji: 'daitai', gloss: 'roughly, mostly', pos: 'adverb' },
    { lemma: 'ずいぶん', reading: 'ずいぶん', romaji: 'zuibun', gloss: 'quite a lot, considerably', pos: 'adverb' },
    { lemma: 'たしかに', reading: 'たしかに', romaji: 'tashikani', gloss: 'certainly, indeed', pos: 'adverb' },
    { lemma: 'とくに', reading: 'とくに', romaji: 'tokuni', gloss: 'especially', pos: 'adverb' },
    { lemma: 'べつに', reading: 'べつに', romaji: 'betsuni', gloss: 'not particularly', pos: 'adverb' },
    { lemma: 'わりと', reading: 'わりと', romaji: 'warito', gloss: 'relatively', pos: 'adverb' },
    { lemma: 'のんびり', reading: 'のんびり', romaji: 'nonbiri', gloss: 'leisurely, at ease', pos: 'adverb' },
    { lemma: 'しっかり', reading: 'しっかり', romaji: 'shikkari', gloss: 'firmly, steadily', pos: 'adverb' },
    { lemma: 'やっぱり', reading: 'やっぱり', romaji: 'yappari', gloss: 'as expected, after all', pos: 'adverb' },
    { lemma: 'もしも', reading: 'もしも', romaji: 'moshimo', gloss: 'if, in case', pos: 'adverb' },
    { lemma: 'とりあえず', reading: 'とりあえず', romaji: 'toriaezu', gloss: 'for now, first of all', pos: 'adverb' },
  ],
  comparison_difficulty: [
    { lemma: 'おなじ', reading: 'おなじ', romaji: 'onaji', gloss: 'same', pos: 'adjective' },
    { lemma: 'ちがう', reading: 'ちがう', romaji: 'chigau', gloss: 'to differ, be wrong', pos: 'verb' },
    { lemma: 'きぶん', reading: 'きぶん', romaji: 'kibun', gloss: 'mood, feeling', pos: 'noun' },
    { lemma: 'かんたん', reading: 'かんたん', romaji: 'kantan', gloss: 'simple, easy', pos: 'adjective' },
    { lemma: 'むずかしい', reading: 'むずかしい', romaji: 'muzukashii', gloss: 'difficult', pos: 'adjective' },
    { lemma: 'あぶない', reading: 'あぶない', romaji: 'abunai', gloss: 'dangerous', pos: 'adjective' },
    { lemma: 'きけん', reading: 'きけん', romaji: 'kiken', gloss: 'danger', pos: 'adjective' },
    { lemma: 'きゅうに', reading: 'きゅうに', romaji: 'kyuuni', gloss: 'suddenly, abruptly', pos: 'adverb' },
    { lemma: 'とくべつ', reading: 'とくべつ', romaji: 'tokubetsu', gloss: 'special', pos: 'adjective' },
    { lemma: 'わかれる', reading: 'わかれる', romaji: 'wakareru', gloss: 'to part, separate', pos: 'verb' },
    { lemma: 'はなれる', reading: 'はなれる', romaji: 'hanareru', gloss: 'to leave, be distant from', pos: 'verb' },
    { lemma: 'きょうそう', reading: 'きょうそう', romaji: 'kyousou', gloss: 'competition', pos: 'noun' },
    { lemma: 'しゅっぱつ', reading: 'しゅっぱつ', romaji: 'shuppatsu', gloss: 'departure', pos: 'noun' },
    { lemma: 'とうちゃく', reading: 'とうちゃく', romaji: 'touchaku', gloss: 'arrival', pos: 'noun' },
  ],
};

export const VOCAB_N4_UNIT = 'vocab-n4';

export const VOCAB_N4_LESSONS: VocabLessonSeed[] = [
  { order: 0, title: 'N4 words: talking about time', groups: ['time_frequency'], exerciseTypes: ['wordReading'] },
  { order: 1, title: 'N4 words: feelings and reactions', groups: ['feelings_reactions'], exerciseTypes: ['wordReading'] },
  { order: 2, title: 'N4 words: everyday verbs', groups: ['daily_life_verbs'], exerciseTypes: ['wordReading'] },
  { order: 3, title: 'N4 words: work and school', groups: ['work_school'], exerciseTypes: ['wordReading'] },
  { order: 4, title: 'N4 words: abstract ideas', groups: ['abstract_concepts'], exerciseTypes: ['wordReading'] },
  { order: 5, title: 'N4 words: shops and services', groups: ['shopping_service'], exerciseTypes: ['wordReading'] },
  { order: 6, title: 'N4 words: health and the body', groups: ['health_body'], exerciseTypes: ['wordReading'] },
  { order: 7, title: 'N4 words: weather in detail', groups: ['weather_extended'], exerciseTypes: ['wordReading'] },
  { order: 8, title: 'N4 words: getting around town', groups: ['town_transport'], exerciseTypes: ['wordReading'] },
  { order: 9, title: 'N4 words: degree and certainty', groups: ['adverbs_degree'], exerciseTypes: ['wordReading'] },
  { order: 10, title: 'N4 words: comparing and describing difficulty', groups: ['comparison_difficulty'], exerciseTypes: ['wordReading'] },
];

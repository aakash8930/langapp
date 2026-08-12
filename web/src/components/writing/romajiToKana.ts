export type KanaScript = 'hiragana' | 'katakana';

export type RomajiConversion = {
  text: string;
  pending: boolean;
  invalid: boolean;
};

const ROMAJI: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ',
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wi: 'うぃ', we: 'うぇ', wo: 'を',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  da: 'だ', di: 'ぢ', dji: 'ぢ', du: 'づ', dzu: 'づ', de: 'で', do: 'ど',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ', sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  she: 'しぇ', je: 'じぇ', che: 'ちぇ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
  va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
  tsa: 'つぁ', tsi: 'つぃ', tse: 'つぇ', tso: 'つぉ',
  tcha: 'っちゃ', tchu: 'っちゅ', tcho: 'っちょ',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ',
  la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ',
  xtsu: 'っ', ltsu: 'っ',
};

const KEYS = Object.keys(ROMAJI).sort((left, right) => right.length - left.length);
const PREFIXES = new Set(KEYS.flatMap((key) => Array.from({ length: key.length - 1 }, (_, index) => key.slice(0, index + 1))));
const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);

function toKatakana(value: string): string {
  return [...value].map((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 0x3041 && code <= 0x3096 ? String.fromCodePoint(code + 0x60) : character;
  }).join('');
}

function scriptValue(value: string, script: KanaScript): string {
  return script === 'katakana' ? toKatakana(value) : value;
}

function parseRun(run: string, script: KanaScript, finalize: boolean): RomajiConversion {
  const lower = run.toLocaleLowerCase();
  let index = 0;
  let output = '';
  let pending = false;

  while (index < lower.length) {
    const rest = lower.slice(index);
    const current = rest[0] ?? '';
    const next = rest[1];

    if (current === 'n') {
      if (next === "'") {
        output += scriptValue('ん', script);
        index += 2;
        continue;
      }
      if (next === 'n') {
        output += scriptValue('ん', script);
        index += 1;
        continue;
      }
      if (next && !VOWELS.has(next) && next !== 'y') {
        output += scriptValue('ん', script);
        index += 1;
        continue;
      }
      if (!next) {
        if (finalize) output += scriptValue('ん', script);
        else {
          output += run.slice(index);
          pending = true;
        }
        index = lower.length;
        continue;
      }
    }

    if (next === current && !VOWELS.has(current) && current !== 'n') {
      output += scriptValue('っ', script);
      index += 1;
      continue;
    }

    const key = KEYS.find((candidate) => rest.startsWith(candidate));
    if (key) {
      output += scriptValue(ROMAJI[key] ?? '', script);
      index += key.length;
      continue;
    }

    if (!finalize && PREFIXES.has(rest)) {
      output += run.slice(index);
      pending = true;
      index = lower.length;
      continue;
    }

    return { text: run, pending: false, invalid: true };
  }

  return { text: output, pending, invalid: false };
}

/**
 * Converts complete, valid Hepburn-style romaji runs to kana. An invalid Latin
 * run is left untouched as a whole, so typing an English word does not produce
 * a half-English, half-kana fragment. A valid unfinished syllable remains Latin
 * until enough letters have been entered.
 */
export function convertRomajiToKana(value: string, script: KanaScript = 'hiragana', finalize = false): RomajiConversion {
  const matches = [...value.matchAll(/[A-Za-z']+/g)];
  if (matches.length === 0) return { text: value, pending: false, invalid: false };

  let output = '';
  let cursor = 0;
  let pending = false;
  let invalid = false;

  for (const match of matches) {
    const start = match.index ?? 0;
    const run = match[0];
    output += value.slice(cursor, start);
    const runEndsAtValueEnd = start + run.length === value.length;
    const converted = parseRun(run, script, finalize || !runEndsAtValueEnd);
    output += converted.text;
    pending ||= converted.pending;
    invalid ||= converted.invalid;
    cursor = start + run.length;
  }

  output += value.slice(cursor);
  return { text: output, pending, invalid };
}

export function countJapaneseCharacters(value: string): number {
  return [...value].filter((character) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々ー]/u.test(character)).length;
}

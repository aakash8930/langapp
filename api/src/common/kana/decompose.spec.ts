import { decomposeIntoKana } from './decompose';

describe('decomposeIntoKana', () => {
  describe('hiragana', () => {
    it('returns base hiragana in order, de-duplicated', () => {
      expect([...decomposeIntoKana('あいうえお')]).toEqual(['あ', 'い', 'う', 'え', 'お']);
    });

    it('preserves dakuten and handakuten as their own characters', () => {
      // が is U+304C, distinct from か. The filter wants each as itself, not
      // decomposed into `か` + dakuten mark, because learners are taught them
      // separately (Phase 0 #1: dakuten/handakuten/yōon come in later units).
      expect([...decomposeIntoKana('がぱ')]).toEqual(['が', 'ぱ']);
    });

    it('collapses repeated characters but keeps a single representative', () => {
      expect([...decomposeIntoKana('こここ')]).toEqual(['こ']);
    });

    it('treats yōon composita as their constituent codepoints, not a single glyph', () => {
      // `きょう` is three codepoints — `き` (U+304D) + `ょ` (U+3087) + `う` (U+3046).
      // There is no `きょ` codepoint in Unicode; yōon is a digraph at the
      // *glyph* level but two characters at the *data* level. Phase 0 keeps the
      // flat decomposition because the storage is per-character and the
      // constrained-filter (Phase 1 #5) checks membership per character.
      // A yōon-aware constraint (filter by yōon-membership) is OPEN-ITEMS P0-2.
      expect([...decomposeIntoKana('きょう')]).toEqual(['き', 'ょ', 'う']);
    });
  });

  describe('katakana', () => {
    it('returns katakana in order', () => {
      expect([...decomposeIntoKana('アイウエオ')]).toEqual(['ア', 'イ', 'ウ', 'エ', 'オ']);
    });

    it('treats the prolonged-sound mark as kana (collapses repeats to the first occurrence)', () => {
      // The prolonged-sound mark `ー` appears twice in `コーヒー` (between each
      // syllable pair) but only its first occurrence wins the dedup; the
      // composition-level question is "what characters does this word use",
      // and `ー` is one character used twice.
      expect([...decomposeIntoKana('コーヒー')]).toEqual(['コ', 'ー', 'ヒ']);
    });

    it('does not collapse base vs. dakuten katakana', () => {
      expect([...decomposeIntoKana('ガパ')]).toEqual(['ガ', 'パ']);
    });

    it('does collapse repeated base katakana (consistent with the dedup contract)', () => {
      expect([...decomposeIntoKana('カサ')]).toEqual(['カ', 'サ']);
    });
  });

  describe('mixed-script words', () => {
    it('drops kanji silently — returns only the kana composition', () => {
      expect([...decomposeIntoKana('食べる')]).toEqual(['べ', 'る']);
    });

    it('returns [] for a kanji-only word', () => {
      expect([...decomposeIntoKana('今日')]).toEqual([]);
    });

    it('returns all kana for a word with no kanji', () => {
      expect([...decomposeIntoKana('こんにちは')]).toEqual(['こ', 'ん', 'に', 'ち', 'は']);
    });

    it('strips whitespace and punctuation', () => {
      expect([...decomposeIntoKana('  ありがとう! ')]).toEqual(['あ', 'り', 'が', 'と', 'う']);
    });
  });

  describe('edge cases', () => {
    it('returns [] for an empty string', () => {
      expect([...decomposeIntoKana('')]).toEqual([]);
    });

    it('returns [] for a string of only non-kana characters', () => {
      expect([...decomposeIntoKana('hello 123')]).toEqual([]);
    });

    it('returns the same in-order contents across repeated calls (deterministic)', () => {
      const a = [...decomposeIntoKana('あいう')];
      const b = [...decomposeIntoKana('あいう')];
      expect(a).toEqual(b);
      expect(a).toEqual(['あ', 'い', 'う']);
    });
  });

  describe('order stability', () => {
    it('preserves first-occurrence order across scripts, even with repeats', () => {
      // Dedup runs on first occurrence only, so `カタカナ` is collapsed to
      // カ タ ナ, not the colloquial reading `カ タ カ ナ`. The first occurrence
      // of each character wins, and the union keeps its place.
      expect([...decomposeIntoKana('カタカナとひらがな')]).toEqual([
        'カ',
        'タ',
        'ナ',
        'と',
        'ひ',
        'ら',
        'が',
        'な',
      ]);
    });
  });
});

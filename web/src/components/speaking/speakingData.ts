import type { VocabItem } from '../library/useCorpus';

export function normalizeJapanese(value: string): string {
  return value
    .normalize('NFKC')
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : character;
    })
    .join('')
    .toLocaleLowerCase()
    .replace(/[\s\u3000。、！？!?.,'"「」『』・ー-]/g, '');
}

export function transcriptMatches(item: VocabItem, transcript: string): boolean {
  const heard = normalizeJapanese(transcript);
  return heard.length > 0 && [item.reading, item.lemma]
    .map(normalizeJapanese)
    .some((target) => target.length > 0 && heard === target);
}

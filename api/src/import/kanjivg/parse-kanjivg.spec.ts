import { codepointToChar, parseKanjiVgFile } from './parse-kanjivg';

function svg(pathsXml: string, viewBox = '0 0 109 109'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="${viewBox}" xmlns:kvg="https://kanjivg.tagaini.net/">
${pathsXml}
</svg>`;
}

describe('codepointToChar', () => {
  it('converts a hex codepoint to the character', () => {
    expect(codepointToChar('3042')).toBe('あ');
    expect(codepointToChar('098df')).toBe('食');
  });
});

describe('parseKanjiVgFile', () => {
  it('extracts char, viewBox and paths from a flat structure', () => {
    const xml = svg(`
<g id="kvg:StrokePaths_04e00">
<path id="kvg:04e00-s1" kvg:type="㇐" d="M10,54 L90,54"/>
</g>`);
    const result = parseKanjiVgFile('04e00', xml);
    expect(result.char).toBe('一');
    expect(result.viewBox).toBe('0 0 109 109');
    expect(result.paths).toEqual(['M10,54 L90,54']);
  });

  it('orders paths by the stroke number in their id, not by document position', () => {
    // Deliberately out of document order — s3 appears before s1.
    const xml = svg(`
<g id="kvg:StrokePaths_098df">
<g id="kvg:098df-g1">
<path id="kvg:098df-s3" d="THIRD"/>
</g>
<path id="kvg:098df-s1" d="FIRST"/>
<g id="kvg:098df-g2">
<g id="kvg:098df-g3">
<path id="kvg:098df-s2" d="SECOND"/>
</g>
</g>
</g>`);
    const result = parseKanjiVgFile('098df', xml);
    expect(result.paths).toEqual(['FIRST', 'SECOND', 'THIRD']);
  });

  it('handles double-digit stroke counts correctly (numeric, not lexicographic, sort)', () => {
    const xml = svg(`
<g id="kvg:StrokePaths_06f22">
<path id="kvg:06f22-s10" d="TEN"/>
<path id="kvg:06f22-s2" d="TWO"/>
<path id="kvg:06f22-s1" d="ONE"/>
</g>`);
    const result = parseKanjiVgFile('06f22', xml);
    // A lexicographic sort would put "s10" before "s2" — must not do that.
    expect(result.paths).toEqual(['ONE', 'TWO', 'TEN']);
  });

  it('collects paths nested arbitrarily deep inside <g> groups', () => {
    const xml = svg(`
<g id="a"><g id="b"><g id="c">
<path id="kvg:04e00-s1" d="DEEP"/>
</g></g></g>`);
    const result = parseKanjiVgFile('04e00', xml);
    expect(result.paths).toEqual(['DEEP']);
  });

  it('throws if a path id does not match the expected -sN suffix', () => {
    const xml = svg(`<g><path id="kvg:04e00-weird" d="X"/></g>`);
    expect(() => parseKanjiVgFile('04e00', xml)).toThrow(/-sN suffix/);
  });

  it('throws if there are no paths at all', () => {
    const xml = svg('');
    expect(() => parseKanjiVgFile('04e00', xml)).toThrow(/No stroke paths/);
  });
});

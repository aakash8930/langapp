import { expandCustomEntities, extractEntities } from './custom-entities';

describe('extractEntities', () => {
  it('reads name/value pairs out of a DOCTYPE internal subset', () => {
    const doctype = `<!DOCTYPE JMdict [
<!ENTITY n "noun (common) (futsuumeishi)">
<!ENTITY v5k "Godan verb - Iku/Yuku special class">
]>`;
    const entities = extractEntities(doctype);
    expect(entities.get('n')).toBe('noun (common) (futsuumeishi)');
    expect(entities.get('v5k')).toBe('Godan verb - Iku/Yuku special class');
    expect(entities.size).toBe(2);
  });

  it('returns an empty map when there is no DOCTYPE', () => {
    expect(extractEntities('<root><child/></root>').size).toBe(0);
  });
});

describe('expandCustomEntities', () => {
  const doc = `<!DOCTYPE JMdict [
<!ENTITY n "noun (common) (futsuumeishi)">
<!ENTITY uk "word usually written using kana alone">
]>
<JMdict><entry><pos>&n;</pos><misc>&uk;</misc></entry></JMdict>`;

  it('replaces every entity reference with its declared expansion', () => {
    const expanded = expandCustomEntities(doc);
    expect(expanded).toContain('<pos>noun (common) (futsuumeishi)</pos>');
    expect(expanded).toContain('<misc>word usually written using kana alone</misc>');
    expect(expanded).not.toMatch(/&n;|&uk;/);
  });

  it('leaves standard XML entities (&amp; &lt; &gt;) untouched', () => {
    const withStandardEntities = `<!DOCTYPE JMdict [<!ENTITY n "noun">]><JMdict><entry><gloss>fish &amp; chips</gloss><pos>&n;</pos></entry></JMdict>`;
    const expanded = expandCustomEntities(withStandardEntities);
    expect(expanded).toContain('fish &amp; chips');
    expect(expanded).toContain('<pos>noun</pos>');
  });

  it('escapes a bare "&" that appears inside an expansion so the result stays well-formed XML', () => {
    const doc2 = `<!DOCTYPE JMdict [<!ENTITY co "Company & Co">]><JMdict><entry><misc>&co;</misc></entry></JMdict>`;
    const expanded = expandCustomEntities(doc2);
    expect(expanded).toContain('<misc>Company &amp; Co</misc>');
  });

  it('is a no-op when the document has no DOCTYPE at all', () => {
    const plain = '<root><child>text</child></root>';
    expect(expandCustomEntities(plain)).toBe(plain);
  });
});

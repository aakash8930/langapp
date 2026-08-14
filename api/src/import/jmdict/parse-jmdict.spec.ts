import { mapEntryElement, parseJMdict } from './parse-jmdict';

describe('parseJMdict', () => {
  it('parses a full document end-to-end: entity expansion, multiple k_ele/r_ele/sense, priority tags', () => {
    const doc = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE JMdict [
<!ENTITY n "noun (common) (futsuumeishi)">
<!ENTITY v1 "Ichidan verb">
<!ENTITY uk "word usually written using kana alone">
]>
<JMdict>
<entry>
<ent_seq>1358280</ent_seq>
<k_ele>
<keb>食べる</keb>
<ke_pri>ichi1</ke_pri>
<ke_pri>news1</ke_pri>
</k_ele>
<r_ele>
<reb>たべる</reb>
<re_pri>ichi1</re_pri>
<re_pri>news1</re_pri>
</r_ele>
<sense>
<pos>&v1;</pos>
<pos>&n;</pos>
<misc>&uk;</misc>
<gloss>to eat</gloss>
<gloss>to live on (e.g. a salary)</gloss>
</sense>
</entry>
</JMdict>`;

    const [entry] = parseJMdict(doc);

    expect(entry.jmdictSeq).toBe(1358280);
    expect(entry.kanjiForms).toEqual([{ text: '食べる', info: [], priority: ['ichi1', 'news1'] }]);
    expect(entry.readings).toEqual([
      { text: 'たべる', noKanji: false, restrictedTo: [], info: [], priority: ['ichi1', 'news1'] },
    ]);
    expect(entry.senses).toEqual([
      {
        partOfSpeech: ['Ichidan verb', 'noun (common) (futsuumeishi)'],
        fields: [],
        misc: ['word usually written using kana alone'],
        dialects: [],
        glosses: ['to eat', 'to live on (e.g. a salary)'],
        note: undefined,
        appliesToKanji: [],
        appliesToReading: [],
      },
    ]);
    expect(entry.isCommon).toBe(true);
  });

  it('parses multiple <entry> elements into multiple results', () => {
    const doc = `<!DOCTYPE JMdict [<!ENTITY n "noun">]><JMdict>
<entry><ent_seq>1</ent_seq><r_ele><reb>あ</reb></r_ele><sense><pos>&n;</pos><gloss>a</gloss></sense></entry>
<entry><ent_seq>2</ent_seq><r_ele><reb>い</reb></r_ele><sense><pos>&n;</pos><gloss>i</gloss></sense></entry>
</JMdict>`;
    const entries = parseJMdict(doc);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.jmdictSeq)).toEqual([1, 2]);
  });
});

describe('mapEntryElement', () => {
  it('treats an entry with no priority tags anywhere as not common', () => {
    const entry = mapEntryElement({
      ent_seq: '1000000',
      r_ele: { reb: 'あー' },
      sense: { pos: 'interjection', gloss: 'ah' },
    });
    expect(entry.isCommon).toBe(false);
  });

  it('detects re_nokanji as present via an empty self-closing tag', () => {
    // fast-xml-parser represents `<re_nokanji/>` as an empty string, not undefined.
    const entry = mapEntryElement({
      ent_seq: '1',
      k_ele: { keb: '一' },
      r_ele: { reb: 'いち', re_nokanji: '' },
      sense: { gloss: 'one' },
    });
    expect(entry.readings[0].noKanji).toBe(true);
  });

  it('omits noKanji when re_nokanji is absent', () => {
    const entry = mapEntryElement({
      ent_seq: '1',
      r_ele: { reb: 'いち' },
      sense: { gloss: 'one' },
    });
    expect(entry.readings[0].noKanji).toBe(false);
  });

  it('carries stagk/stagr sense restrictions and re_restr reading restrictions', () => {
    const entry = mapEntryElement({
      ent_seq: '1',
      k_ele: [{ keb: '早い' }, { keb: '速い' }],
      r_ele: { reb: 'はやい', re_restr: '早い' },
      sense: [
        { stagk: '早い', gloss: 'early' },
        { stagk: '速い', gloss: 'fast' },
      ],
    });
    expect(entry.readings[0].restrictedTo).toEqual(['早い']);
    expect(entry.senses[0].appliesToKanji).toEqual(['早い']);
    expect(entry.senses[1].appliesToKanji).toEqual(['速い']);
  });

  it('drops an empty gloss but keeps real ones', () => {
    const entry = mapEntryElement({
      ent_seq: '1',
      r_ele: { reb: 'あ' },
      sense: { gloss: ['', 'a', ''] },
    });
    expect(entry.senses[0].glosses).toEqual(['a']);
  });

  it('reads a gloss with an xml:lang attribute (object form) the same as a plain string gloss', () => {
    const entry = mapEntryElement({
      ent_seq: '1',
      r_ele: { reb: 'あ' },
      sense: { gloss: { '@_xml:lang': 'eng', '#text': 'a' } },
    });
    expect(entry.senses[0].glosses).toEqual(['a']);
  });
});

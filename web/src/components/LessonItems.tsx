import type { ResolvedItem } from '../api';
import { showsRomaji } from '../romaji';

/**
 * What a lesson actually teaches, rendered per item kind.
 *
 * The four arms mirror `ResolvedItem` on the server. TypeScript checks the
 * switch is exhaustive, so a new content kind is a compile error here rather
 * than a blank row on the page.
 */
export function LessonItems({ items }: { items: ResolvedItem[] }) {
  if (items.length === 0) return <p className="muted">This lesson has no items yet.</p>;

  const kind = items[0].kind;

  return (
    <ul className={`items items-${kind}`}>
      {items.map((item) => (
        <li key={item.id} className="item">
          <Item item={item} />
        </li>
      ))}
    </ul>
  );
}

/**
 * One item's content, exported so the study walkthrough shows exactly what the
 * curriculum list shows. The two disagreeing about romaji rules or which fields
 * appear would be a way for a learner to be taught one thing and quizzed on
 * another.
 */
export function Item({ item }: { item: ResolvedItem }) {
  switch (item.kind) {
    case 'kana':
      return (
        <>
          {/*
            Two cells for a yōon — きゃ is two glyphs and one syllable, and on
            real manuscript paper it takes two squares. Same rule as the app.
          */}
          <span className="kana-cells" aria-hidden="true">
            {[...item.kana].map((glyph, i) => (
              <span className="cell cell-sm ja" key={`${i}-${glyph}`}>
                {glyph}
              </span>
            ))}
          </span>
          <span className="item-answer">{item.romaji}</span>
          <span className="visually-hidden">
            {item.kana} is read {item.romaji}
          </span>
        </>
      );

    case 'vocab':
      return (
        <>
          <span className="item-word ja">{item.lemma}</span>
          {/* Romaji sits directly under the word, before the meaning — it is
              how you say it, not what it means. */}
          {item.romaji && showsRomaji(item.jlpt) ? (
            <span className="item-romaji">{item.romaji}</span>
          ) : null}
          <span className="item-answer">{item.gloss}</span>
          {/* Identical while the unit is kana-only; a repeat would say nothing. */}
          {item.reading === item.lemma ? null : (
            <span className="item-reading ja">{item.reading}</span>
          )}
        </>
      );

    case 'grammar': {
      const example = item.examples[0];
      return (
        <>
          <span className="item-word ja">{item.title}</span>
          {example ? (
            <span className="item-example">
              <span className="ja">{example.sentence.replace('＿', example.answer)}</span>
              {/* Of the completed sentence — 「あなたはせんせいですか。」 reads
                  "anata wa sensei desu ka", with は as "wa". Safe here because
                  this is the worked example, not a question. */}
              {example.romaji && showsRomaji(item.jlpt) ? (
                <span className="item-romaji">{example.romaji}</span>
              ) : null}
              <span className="item-gloss">{example.gloss}</span>
            </span>
          ) : null}
          <span className="item-explanation">{item.explanation}</span>
        </>
      );
    }

    case 'kanji':
      return (
        <>
          <span className="kana-cells" aria-hidden="true">
            <span className="cell cell-sm ja">{item.char}</span>
          </span>
          <span className="item-answer">{item.meanings.join(', ')}</span>
        </>
      );
  }
}

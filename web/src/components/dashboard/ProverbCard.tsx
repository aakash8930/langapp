/**
 * 継続は力なり.
 *
 * Authored content on the client, for the same reason `mnemonics.ts` and
 * `romaji.ts` are: this is *display*. The server stays the source of truth for
 * what a learner knows and has done; a proverb is neither.
 *
 * It is fixed rather than rotating through a list. A phrase you see every day
 * is one you end up able to read, which is a small piece of teaching; a
 * different one each load is decoration. When there are enough of them to be
 * worth rotating, they belong in content, not in a client-side array.
 *
 * The romaji is there for the same reason it is in the header's greeting: on
 * day one, every learner needs it.
 */
export function ProverbCard() {
  return (
    <section className="card proverb-card glass" aria-labelledby="proverb-heading">
      <h2 className="visually-hidden" id="proverb-heading">
        Today&rsquo;s phrase
      </h2>

      <p className="proverb-ja ja" lang="ja">
        継続は力なり。
      </p>
      <p className="proverb-romaji">Keizoku wa chikara nari.</p>
      <p className="proverb-gloss">Consistency is power.</p>

      <span className="proverb-petals" aria-hidden="true">
        ❀
      </span>
    </section>
  );
}

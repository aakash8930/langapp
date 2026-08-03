import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import { fetchReadableVocab } from '../api';
import { queryKeys } from '../queryKeys';
import { useSession } from '../useSession';

/**
 * Phase 0's deliberately bare reader. It is a proof of the product contract:
 * every word in this feed has already been checked on the server against the
 * learner's known-character set. Comprehension checks and sentence content
 * belong to the next phases; this screen makes decoding possible first.
 */
export const Route = createFileRoute('/read')({
  component: ReadingPage,
});

function ReadingPage() {
  const { session } = useSession();
  const feed = useQuery({
    queryKey: queryKeys.reading.feed,
    queryFn: () => fetchReadableVocab(30),
    enabled: session.state === 'signedIn',
  });

  if (session.state === 'loading') {
    return <main className="reader-page wrap"><p className="note">Loading your reading shelf…</p></main>;
  }

  if (session.state === 'signedOut') {
    return (
      <main className="reader-page wrap">
        <section className="reader-card glass">
          <p className="section-idx">Reading</p>
          <h1>Your characters, in context.</h1>
          <p className="reader-copy">Sign in, complete a kana lesson, then come back to read words built only from characters you have been taught.</p>
          <Link className="btn btn-primary" to="/" hash="start">Sign in to start</Link>
        </section>
      </main>
    );
  }

  const knownCount = session.user.learningState.knownKana.length;

  return (
    <main className="reader-page wrap">
      <section className="reader-intro">
        <div>
          <p className="section-idx">Your reading shelf</p>
          <h1>Read what you’ve learned.</h1>
          <p className="reader-copy">Every character below is already in your lesson history. No surprise kana, no translation matching.</p>
        </div>
        <div className="reader-known" aria-label={`${knownCount} known characters`}>
          <strong>{knownCount}</strong><span>characters known</span>
        </div>
      </section>

      {feed.isPending ? <p className="note">Finding words you can decode…</p> : null}
      {feed.isError ? (
        <section className="reader-card glass">
          <h2>Your reading shelf is unavailable.</h2>
          <p className="reader-copy">Please check your connection and try again.</p>
          <button className="btn btn-secondary" type="button" onClick={() => void feed.refetch()}>Try again</button>
        </section>
      ) : null}
      {!feed.isPending && !feed.isError && feed.data?.length === 0 ? (
        <section className="reader-card glass">
          <p className="reader-empty-mark ja" aria-hidden="true">あ</p>
          <h2>Your shelf opens after your first kana lesson.</h2>
          <p className="reader-copy">Finish a lesson to add its characters to your known set. We’ll only place decodable words here.</p>
          <Link className="btn btn-primary" to="/">Go to lessons</Link>
        </section>
      ) : null}
      {feed.data && feed.data.length > 0 ? (
        <ol className="reading-list">
          {feed.data.map((word) => (
            <li className="reading-word glass" key={word.id}>
              <p className="reading-lemma ja" lang="ja">{word.lemma}</p>
              <p className="reading-romaji">{word.romaji ?? word.reading}</p>
              <p className="reading-gloss">{word.gloss}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </main>
  );
}

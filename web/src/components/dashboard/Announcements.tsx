import { Link } from '@tanstack/react-router';

/**
 * Announcements — a static card for product updates and tips.
 *
 * There is no announcements endpoint and no CMS. Authoring a
 * hard-coded list here is the honest version: the card names what it is,
 * and the content changes when the code changes.
 */
const ANNOUNCEMENTS = [
  {
    id: '1',
    title: 'Welcome to the new dashboard',
    body: 'Your study progress, daily goals, and review queue are all here. Everything updates as you learn.',
    date: '2026-08-01',
  },
  {
    id: '2',
    title: 'JLPT N5 content is now complete',
    body: 'All N5 vocabulary, kanji, and grammar are seeded. The placement test launches next.',
    date: '2026-07-28',
  },
];

export function Announcements() {
  return (
    <section className="card glass" aria-labelledby="announce-heading">
      <div className="card-head">
        <h2 className="card-title" id="announce-heading">
          Announcements
        </h2>
      </div>

      {ANNOUNCEMENTS.map((a, i) => (
        <div key={a.id}>
          {i > 0 ? <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', margin: 'var(--s-md) 0' }} /> : null}
          <h3 style={{ margin: 0, fontSize: 'var(--text-small)', fontWeight: 700 }}>{a.title}</h3>
          <p className="card-note" style={{ marginTop: 'var(--s-xs)' }}>{a.body}</p>
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>{a.date}</span>
        </div>
      ))}

      <p className="card-note" style={{ marginTop: 'var(--s-md)' }}>
        More updates as the product ships.{' '}
        <Link className="card-link" to="/">
          Refresh
        </Link>
      </p>
    </section>
  );
}

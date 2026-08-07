import { createFileRoute, Link } from '@tanstack/react-router';

import { fetchKanaCurriculum } from '../api';
import { KanaLibrary } from '../components/library/KanaLibrary';
import { logError } from '../debug';
import { queryKeys } from '../queryKeys';

/**
 * The katakana chart plus links to every practice mode.
 */
export const Route = createFileRoute('/katakana')({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData({
        queryKey: queryKeys.content.kanaCurriculum,
        queryFn: fetchKanaCurriculum,
      });
    } catch (error: unknown) {
      logError('route', 'katakana loader: kana curriculum failed to load', error);
    }
  },
  component: KatakanaPage,
});

const modes = [
  { to: '/katakana-writing' as const, label: 'Writing', desc: 'Trace each character stroke by stroke.' },
  { to: '/katakana-reading' as const, label: 'Reading', desc: 'See the kana, type its romaji.' },
  { to: '/katakana-listening' as const, label: 'Listening', desc: 'Hear it — pick the right one.' },
  { to: '/katakana-flashcards' as const, label: 'Flashcards', desc: 'Flip and self-grade.' },
  { to: '/katakana-mistakes' as const, label: 'Mistakes', desc: 'Drill the ones you got wrong.' },
];

function KatakanaPage() {
  return (
    <>
      <KanaLibrary script="katakana" />

      <div style={{ marginTop: 'var(--s-2xl)' }}>
        <h2 className="card-note" style={{ marginBottom: 'var(--s-lg)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Practice modes
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--s-md)' }}>
          {modes.map((m) => (
            <Link key={m.to} className="glass panel" to={m.to} style={{ padding: 'var(--s-lg)', textDecoration: 'none', transition: 'transform var(--t-fast) ease' }}>
              <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 'var(--s-xs)' }}>{m.label}</strong>
              <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>{m.desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

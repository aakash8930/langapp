import { createFileRoute, Link, useParams } from '@tanstack/react-router';

import { useCorpus, type GrammarItem } from '../components/library/useCorpus';

export const Route = createFileRoute('/grammar/$id')({
  component: GrammarDetailPage,
});

function GrammarDetailPage() {
  const { id } = useParams({ from: '/grammar/$id' });
  const corpus = useCorpus();
  const items: GrammarItem[] = (corpus.data?.items.filter((i): i is GrammarItem => i.kind === 'grammar') ?? []) as GrammarItem[];
  const item = items.find((i) => i.id === id);

  if (corpus.isPending) {
    return <div className="page"><header className="page-head"><h1 className="page-title">Grammar</h1></header><p className="card-note">Loading…</p></div>;
  }

  if (!item) {
    return (
      <div className="page">
        <header className="page-head"><h1 className="page-title">Grammar</h1></header>
        <div className="glass panel quiz-summary">
          <h2>Point not found</h2>
          <Link className="btn btn-primary" to="/grammar">Back to grammar list</Link>
        </div>
      </div>
    );
  }

  const example = item.examples[0];

  return (
    <div className="page">
      <header className="page-head">
        <p className="card-note" style={{ marginBottom: 'var(--s-xs)' }}>
          <Link className="link-button" to="/grammar">← Grammar</Link>
        </p>
        <h1 className="page-title" style={{ fontSize: 'var(--text-display)' }}>
          {item.title}
        </h1>
        <span className="vocab-tag vocab-tag-jlpt" style={{ display: 'inline-block', marginTop: 'var(--s-sm)' }}>{item.jlpt}</span>
      </header>

      <div className="glass panel" style={{ padding: 'var(--s-xl)', marginTop: 'var(--s-lg)', maxWidth: '720px' }}>
        {/* Explanation */}
        <section style={{ marginBottom: 'var(--s-xl)' }}>
          <h2 style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 var(--s-sm)' }}>Explanation</h2>
          <p style={{ lineHeight: 1.7, fontSize: 'var(--text-body)' }}>{item.explanation}</p>
        </section>

        {/* Example */}
        {example && (
          <section style={{ marginBottom: 'var(--s-xl)', padding: 'var(--s-lg)', background: 'color-mix(in srgb, var(--brand-primary) 5%, transparent)', borderRadius: 'var(--radius-lg)' }}>
            <h2 style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 var(--s-md)' }}>Example</h2>
            <p className="example-sentence ja" lang="ja" style={{ fontSize: '1.5rem', marginBottom: 'var(--s-sm)' }}>
              {example.sentence.replace(/＿/g, '　')}
            </p>
            <p style={{ color: 'var(--brand-primary)', fontWeight: 700, fontSize: 'var(--text-large)', marginTop: 0 }}>→ {example.answer}</p>
            {example.romaji && <p className="example-romaji">{example.romaji}</p>}
            <p className="example-gloss">{example.gloss}</p>
          </section>
        )}

        {/* Usage */}
        {(item as any).usage && (
          <section style={{ marginBottom: 'var(--s-xl)', paddingBottom: 'var(--s-xl)', borderBottom: '1px solid var(--hairline)' }}>
            <h2 style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 var(--s-sm)' }}>Usage notes</h2>
            <p style={{ lineHeight: 1.7 }}>{(item as any).usage}</p>
          </section>
        )}

        {/* Common mistakes */}
        {((item as any).commonMistakes ?? []).length > 0 && (
          <section>
            <h2 style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 var(--s-md)' }}>Common mistakes</h2>
            {((item as any).commonMistakes ?? []).map((m: any, i: number) => (
              <div key={i} style={{ marginBottom: 'var(--s-md)', padding: 'var(--s-md)', borderLeft: '3px solid var(--shu)', background: 'color-mix(in srgb, var(--shu) 5%, transparent)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
                <p style={{ textDecoration: 'line-through', color: 'var(--shu)', margin: '0 0 var(--s-xs)' }}>{m.mistake}</p>
                <p style={{ fontWeight: 700, color: 'var(--brand-success)', margin: '0 0 var(--s-xs)' }}>✓ {m.correction}</p>
                <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', margin: 0 }}>{m.note}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

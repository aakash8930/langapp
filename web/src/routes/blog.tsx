import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

const POSTS = [
  { slug: 'recognition-and-recall', title: 'Why Lessons Need Recognition and Recall', date: '2026-07-15', excerpt: 'How immediate practice turns a short explanation into usable knowledge.' },
  { slug: 'learning-hiragana-fast', title: 'How to Learn Hiragana in One Week', date: '2026-07-01', excerpt: 'A practical guide to mastering the Japanese syllabary quickly and efficiently.' },
  { slug: 'jlpt-n5-guide', title: 'Complete JLPT N5 Study Guide', date: '2026-06-20', excerpt: 'Everything you need to know to pass the N5 exam on your first attempt.' },
];

export const Route = createFileRoute('/blog')({ component: () => (
  <InfoPage title="Blog" backTo="/">
    {POSTS.map((p) => (
      <div key={p.slug} style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: 'var(--s-md)', marginBottom: 'var(--s-md)' }}>
        <h3 style={{ margin: 0 }}>{p.title}</h3>
        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>{p.date}</p>
        <p style={{ margin: 'var(--s-xs) 0 0', fontSize: 'var(--text-small)' }}>{p.excerpt}</p>
      </div>
    ))}
  </InfoPage>
)});

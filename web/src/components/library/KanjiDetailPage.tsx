import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';

import { useKanjiBookmarks } from '../../hooks/useKanjiBookmarks';
import { useStrokes } from '../../strokes';
import { StrokeOrder } from '../StrokeOrder';
import { TraceCanvas } from '../TraceCanvas';
import { Icon } from '../ui/Icon';
import { sortKanjiByLevel } from './kanjiData';
import { KANJI_WRITES } from './kanjiWrites';
import { useCorpus, type KanjiItem, type VocabItem } from './useCorpus';

import './kanji-library.css';

function scrollToSection(section: string) {
  document.getElementById(section)?.scrollIntoView({
    block: 'start',
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

export function KanjiDetailPage({ id }: { id: string }) {
  const corpus = useCorpus();
  const { bookmarks, isBookmarked, toggle } = useKanjiBookmarks();
  const corpusItems = corpus.data?.items;
  const kanji = useMemo(
    () => sortKanjiByLevel(corpusItems?.filter((entry): entry is KanjiItem => entry.kind === 'kanji') ?? []),
    [corpusItems],
  );
  const item = kanji.find((entry) => entry.id === id || entry.char === id);

  if (corpus.isPending) return <div className="page kanji-reference"><div className="kanji-loading glass" role="status"><span className="ja">漢</span><p>Loading kanji details…</p></div></div>;
  if (corpus.isError) return <DetailProblem title="Kanji details could not be loaded" body="The curriculum API is unavailable. Try again or return to the complete list." retry={() => void corpus.refetch()} />;
  if (!item) return <DetailProblem title="Kanji not found" body="That character is not part of the currently available course corpus." />;

  const vocab = corpusItems?.filter((entry): entry is VocabItem => entry.kind === 'vocab') ?? [];
  const linkedReadings = new Set(KANJI_WRITES[item.char] ?? []);
  const examples = vocab.filter((entry) => linkedReadings.has(entry.reading) || linkedReadings.has(entry.lemma));
  const related = kanji.filter((entry) => entry.id !== item.id && entry.radical === item.radical).slice(0, 8);
  const currentIndex = kanji.findIndex((entry) => entry.id === item.id);
  const previous = currentIndex > 0 ? kanji[currentIndex - 1] : undefined;
  const next = currentIndex < kanji.length - 1 ? kanji[currentIndex + 1] : undefined;
  const meaning = item.meanings.join(', ');
  const saved = isBookmarked(item.char);

  return (
    <div className="page kanji-reference kanji-detail-reference">
      <nav className="kanji-detail-crumbs" aria-label="Breadcrumb">
        <Link to="/kanji">Kanji</Link><Icon name="chevron-right" size={13} /><span aria-current="page">{item.char} · {meaning}</span>
      </nav>

      <section className="kanji-detail-hero glass">
        <div className="kanji-detail-character"><span className="ja" lang="ja">{item.char}</span><small>JLPT {item.jlpt}</small></div>
        <div className="kanji-detail-intro">
          <p className="kanji-kicker">KANJI DETAILS</p>
          <h1>{meaning}</h1>
          <div className="kanji-detail-reading-line"><span><b>On-yomi</b>{item.on.join('、') || 'Not provided'}</span><i aria-hidden="true" /><span><b>Kun-yomi</b>{item.kun.join('、') || 'Not provided'}</span></div>
          <dl className="kanji-detail-summary"><div><dt>Radical</dt><dd className="ja">{item.radical || '—'}</dd></div><div><dt>Stroke count</dt><dd className="tabular">{item.strokes}</dd></div><div><dt>Course level</dt><dd>{item.jlpt}</dd></div><div><dt>Course words</dt><dd className="tabular">{examples.length}</dd></div></dl>
        </div>
        <div className="kanji-detail-actions">
          <button type="button" className={`btn ${saved ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggle(item.char, meaning)}><Icon name="star" size={16} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Bookmarked' : 'Bookmark'}</button>
          <Link className="btn btn-primary" to="/kanji-quiz">Start kanji quiz <Icon name="sparkles" size={15} /></Link>
        </div>
      </section>

      <nav className="kanji-detail-jumps glass" aria-label="On this kanji page">
        <button type="button" onClick={() => scrollToSection('kanji-meaning')}>Meaning & readings</button>
        <button type="button" onClick={() => scrollToSection('kanji-strokes')}>Stroke order</button>
        <button type="button" onClick={() => scrollToSection('kanji-examples')}>Examples <span className="tabular">{examples.length}</span></button>
        <button type="button" onClick={() => scrollToSection('kanji-writing')}>Writing practice</button>
        <button type="button" onClick={() => scrollToSection('kanji-related')}>Related kanji <span className="tabular">{related.length}</span></button>
      </nav>

      {corpus.data.failedUnits.length > 0 ? <p className="note kanji-partial"><strong>Partial corpus.</strong><span>Some course units did not load, so examples and related kanji may be incomplete.</span></p> : null}

      <div className="kanji-detail-layout">
        <main className="kanji-detail-main">
          <section className="kanji-detail-section glass" id="kanji-meaning" aria-labelledby="kanji-meaning-heading">
            <SectionHeading kicker="CORE INFORMATION" title="Meaning and readings" id="kanji-meaning-heading" />
            <div className="kanji-meaning-grid">
              <article><span className="kanji-info-icon">EN</span><div><h3>Meanings</h3><p>{item.meanings.join(' · ')}</p><small>{item.meanings.length} curriculum meaning{item.meanings.length === 1 ? '' : 's'}</small></div></article>
              <article><span className="kanji-info-icon ja">音</span><div><h3>On-yomi <small>音読み</small></h3><p className="ja">{item.on.join('、') || '—'}</p><small>Sino-Japanese reading{item.on.length === 1 ? '' : 's'}, often used in compound words.</small></div></article>
              <article><span className="kanji-info-icon ja">訓</span><div><h3>Kun-yomi <small>訓読み</small></h3><p className="ja">{item.kun.join('、') || '—'}</p><small>Native Japanese reading{item.kun.length === 1 ? '' : 's'}, often used alone or with okurigana.</small></div></article>
              <article><span className="kanji-info-icon ja">部</span><div><h3>Radical</h3><p className="ja kanji-radical-glyph">{item.radical || '—'}</p><small>The classifying radical recorded by the course corpus.</small></div></article>
            </div>
          </section>

          <section className="kanji-detail-section glass" id="kanji-strokes" aria-labelledby="kanji-strokes-heading">
            <SectionHeading kicker="KANJIVG STROKE DATA" title="Stroke order and animation" id="kanji-strokes-heading" />
            <StrokePanel item={item} />
          </section>

          <section className="kanji-detail-section glass" id="kanji-examples" aria-labelledby="kanji-examples-heading">
            <SectionHeading kicker="REAL COURSE VOCABULARY" title="Examples" id="kanji-examples-heading" />
            {examples.length === 0 ? <div className="kanji-data-empty"><span className="ja">語</span><div><strong>No linked course words</strong><p>The curriculum does not currently map this kanji to a vocabulary entry. Nothing has been generated to fill the gap.</p></div></div> : <ul className="kanji-example-list">{examples.map((word) => <li key={word.id}><div className="kanji-example-word"><span className="ja">{item.char}</span><small>is used to write</small><strong className="ja">{word.lemma}</strong>{word.romaji ? <em>{word.romaji}</em> : null}</div><div className="kanji-example-meaning"><p>{word.gloss}</p><span>{word.pos} · {word.jlpt}</span></div>{word.examples.length > 0 ? <div className="kanji-example-sentence"><p className="ja">{word.examples[0]?.sentence}</p>{word.examples[0]?.reading ? <small className="ja">{word.examples[0].reading}</small> : null}<p>{word.examples[0]?.gloss}</p></div> : <p className="kanji-example-no-sentence">No sentence is stored for this course word.</p>}</li>)}</ul>}
          </section>

          <section className="kanji-detail-section glass" id="kanji-writing" aria-labelledby="kanji-writing-heading">
            <SectionHeading kicker="PEN, TOUCH, OR MOUSE" title="Writing practice" id="kanji-writing-heading" />
            <WritingPanel item={item} />
          </section>

          <section className="kanji-detail-section glass" id="kanji-related" aria-labelledby="kanji-related-heading">
            <SectionHeading kicker="SAME RECORDED RADICAL" title="Related kanji" id="kanji-related-heading" />
            {related.length === 0 ? <div className="kanji-data-empty"><span className="ja">部</span><div><strong>No related course kanji</strong><p>No other currently loaded character shares the recorded {item.radical} radical.</p></div></div> : <ul className="kanji-related-list">{related.map((entry) => <li key={entry.id}><Link to="/kanji/$id" params={{ id: entry.id }}><span className="ja">{entry.char}</span><span><strong>{entry.meanings.join(', ')}</strong><small>{entry.on.join('、') || entry.kun.join('、')} · {entry.strokes} strokes</small></span><span className="kanji-level-badge">{entry.jlpt}</span></Link></li>)}</ul>}
          </section>

          <nav className="kanji-detail-pager glass" aria-label="Previous and next kanji">
            {previous ? <Link to="/kanji/$id" params={{ id: previous.id }}><Icon name="chevron-left" size={15} /><span><small>Previous in JLPT order</small><strong><b className="ja">{previous.char}</b> {previous.meanings.join(', ')}</strong></span></Link> : <span />}
            {next ? <Link to="/kanji/$id" params={{ id: next.id }}><span><small>Next in JLPT order</small><strong>{next.meanings.join(', ')} <b className="ja">{next.char}</b></strong></span><Icon name="chevron-right" size={15} /></Link> : <span />}
          </nav>
        </main>

        <aside className="kanji-detail-rail" aria-label="Kanji details and study actions">
          <section className="kanji-rail-card glass"><div className="kanji-rail-head"><div><p className="kanji-kicker">AT A GLANCE</p><h2>Character facts</h2></div></div><dl className="kanji-fact-list"><div><dt>Character</dt><dd className="ja">{item.char}</dd></div><div><dt>JLPT level</dt><dd>{item.jlpt}</dd></div><div><dt>Stroke count</dt><dd className="tabular">{item.strokes}</dd></div><div><dt>Radical</dt><dd className="ja">{item.radical}</dd></div><div><dt>On readings</dt><dd className="tabular">{item.on.length}</dd></div><div><dt>Kun readings</dt><dd className="tabular">{item.kun.length}</dd></div></dl></section>
          <section className="kanji-rail-card glass"><div className="kanji-rail-head"><div><p className="kanji-kicker">PRACTICE</p><h2>Continue studying</h2></div></div><ul className="kanji-action-list"><li><Link to="/kanji-writing"><span><Icon name="pen-tool" size={17} /></span><span><strong>Writing library</strong><small>Choose any available kanji</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/kanji-quiz"><span><Icon name="sparkles" size={17} /></span><span><strong>Kanji quiz</strong><small>Test real corpus facts</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/practice-hub"><span><Icon name="refresh-cw" size={17} /></span><span><strong>Practice hub</strong><small>Use course-backed exercises</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/kanji-bookmarks"><span><Icon name="book-marked" size={17} /></span><span><strong>Bookmarks</strong><small>{bookmarks.length} saved on this browser</small></span><Icon name="chevron-right" size={14} /></Link></li></ul></section>
          <p className="kanji-source-note"><Icon name="check" size={13} /> Meanings, readings, radical, stroke count, level, and word links come from the course corpus. Missing information is not generated.</p>
        </aside>
      </div>
    </div>
  );
}

function StrokePanel({ item }: { item: KanjiItem }) {
  const strokes = useStrokes(item.char);
  if (strokes.isPending) return <div className="kanji-stroke-loading" role="status"><span className="ja">{item.char}</span><p>Loading stroke paths…</p></div>;
  if (strokes.isError || strokes.data.paths.length === 0) return <div className="kanji-data-empty"><span className="ja">{item.char}</span><div><strong>Stroke animation unavailable</strong><p>The course records {item.strokes} strokes, but the KanjiVG stroke-path service has no diagram for this character right now.</p></div></div>;
  return <div className="kanji-stroke-panel"><div className="kanji-stroke-stage"><StrokeOrder char={item.char} size={250} /></div><div className="kanji-stroke-copy"><span className="kanji-level-badge">{strokes.data.paths.length} SVG paths</span><h3>Watch each stroke in order</h3><p>The real KanjiVG paths are drawn one at a time. Use Replay below the diagram to restart the animation. With reduced motion enabled, the finished character is shown without animation.</p><dl><div><dt>Corpus count</dt><dd className="tabular">{item.strokes}</dd></div><div><dt>Diagram paths</dt><dd className="tabular">{strokes.data.paths.length}</dd></div></dl></div></div>;
}

function WritingPanel({ item }: { item: KanjiItem }) {
  const strokes = useStrokes(item.char);
  if (strokes.isPending) return <div className="kanji-stroke-loading" role="status"><span className="ja">{item.char}</span><p>Preparing the writing guide…</p></div>;
  if (strokes.isError || strokes.data.paths.length === 0) return <div className="kanji-data-empty"><span className="ja">{item.char}</span><div><strong>Tracing unavailable</strong><p>Writing feedback needs real stroke geometry. It is disabled rather than grading against a fabricated shape.</p><Link className="btn btn-secondary btn-sm" to="/kanji-writing">Choose another kanji</Link></div></div>;
  return <div className="kanji-writing-panel"><div className="kanji-writing-copy"><span className="kanji-level-badge">Local feedback</span><h3>Trace {item.char} stroke by stroke</h3><p>Draw the highlighted line with a pointer, finger, or pen. The next expected KanjiVG path is checked locally; no handwriting leaves your browser.</p><ul><li>Follow the highlighted stroke.</li><li>Draw from the correct starting point.</li><li>After two misses, the next path becomes a stronger hint.</li></ul><Link className="btn btn-secondary btn-sm" to="/kanji-writing">Open the full writing library</Link></div><div className="kanji-trace-stage"><TraceCanvas char={item.char} /></div></div>;
}

function SectionHeading({ kicker, title, id }: { kicker: string; title: string; id: string }) {
  return <div className="kanji-section-head"><div><p className="kanji-kicker">{kicker}</p><h2 id={id}>{title}</h2></div></div>;
}

function DetailProblem({ title, body, retry }: { title: string; body: string; retry?: () => void }) {
  return <div className="page kanji-reference"><div className="kanji-empty glass"><span className="ja">探</span><h1>{title}</h1><p>{body}</p><div className="kanji-problem-actions"><Link className="btn btn-primary" to="/kanji">Back to kanji</Link>{retry ? <button type="button" className="btn btn-secondary" onClick={retry}>Try again</button> : null}</div></div></div>;
}

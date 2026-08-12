import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { useSession } from '../../useSession';
import { useCorpus, type VocabItem } from '../library/useCorpus';
import { Icon } from '../ui/Icon';
import { ListeningAudioPlayer } from './ListeningAudioPlayer';
import { sortListeningItems, spokenText } from './listeningData';
import { ListeningTabs } from './ListeningTabs';
import { ShadowingRecorder } from './ShadowingRecorder';

import './listening.css';

function scrollToSection(section: string) {
  document.getElementById(section)?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

export function ListeningDetailPage({ id }: { id: string }) {
  const corpus = useCorpus();
  const { session } = useSession();
  const [speed, setSpeed] = useState(session.state === 'signedIn' ? session.user.settings.audioSpeed : 1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const corpusItems = corpus.data?.items;
  const items = useMemo(() => sortListeningItems(corpusItems?.filter((entry): entry is VocabItem => entry.kind === 'vocab') ?? []), [corpusItems]);
  const item = items.find((entry) => entry.id === id);

  if (corpus.isPending) return <div className="page listening-reference"><div className="listening-loading glass" role="status"><Icon name="headphones" size={42} /><p>Loading listening lesson…</p></div></div>;
  if (corpus.isError) return <DetailProblem title="Listening lesson could not be loaded" body="The curriculum API is unavailable. Try again or return to the listening library." retry={() => void corpus.refetch()} />;
  if (!item) return <DetailProblem title="Listening lesson not found" body="That vocabulary recording is not part of the currently available course corpus." />;

  const currentIndex = items.findIndex((entry) => entry.id === item.id);
  const previous = currentIndex > 0 ? items[currentIndex - 1] : undefined;
  const next = currentIndex < items.length - 1 ? items[currentIndex + 1] : undefined;
  const reading = spokenText(item);

  return <div className="page listening-reference"><ListeningTabs active="lessons" /><nav className="listening-detail-crumbs" aria-label="Breadcrumb"><Link to="/listening">Listening</Link><Icon name="chevron-right" size={13} /><span aria-current="page">{item.lemma} · {item.gloss}</span></nav><section className="listening-detail-hero glass"><div className="listening-detail-icon"><Icon name="headphones" size={58} /><span className="ja" lang="ja">{item.lemma}</span></div><div className="listening-detail-intro"><p className="listening-kicker">LISTENING LESSON · {item.jlpt}</p><h1>{item.gloss}</h1><p>Listen before revealing the course reading and translation. Then replay at a comfortable speed and shadow the pronunciation aloud.</p><dl><div><dt>Part of speech</dt><dd>{item.pos}</dd></div><div><dt>Context examples</dt><dd className="tabular">{item.examples.length}</dd></div><div><dt>Speed</dt><dd className="tabular">{speed}×</dd></div></dl></div><div className="listening-detail-actions"><button type="button" className="btn btn-primary" onClick={() => scrollToSection('listening-player')}>Open audio player <Icon name="chevron-down" size={15} /></button><Link className="btn btn-secondary" to="/listening-quiz">Quiz listening</Link></div></section>

    {corpus.data.failedUnits.length > 0 ? <p className="note listening-partial"><strong>Partial corpus.</strong><span>Some course units did not load, so adjacent lessons may be incomplete.</span></p> : null}

    <div className="listening-detail-layout"><main className="listening-detail-main"><section className="listening-detail-section glass" id="listening-player" aria-labelledby="listening-player-heading"><div className="listening-section-head"><div><p className="listening-kicker">COURSE AUDIO</p><h2 id="listening-player-heading">Audio player</h2></div><span>Listen first, reveal second</span></div><ListeningAudioPlayer itemId={item.id} text={reading} speed={speed} onSpeedChange={setSpeed} revealText={showTranscript} /><div className="listening-reveal-grid"><article><div><Icon name="captions" size={19} /><h3>Transcript</h3></div>{showTranscript ? <div className="listening-revealed"><p className="ja" lang="ja">{item.lemma}</p>{item.reading !== item.lemma ? <small className="ja">{item.reading}</small> : null}{item.romaji ? <span>{item.romaji}</span> : null}</div> : <p>Keep the Japanese reading hidden while you listen.</p>}<button type="button" onClick={() => setShowTranscript((value) => !value)}><Icon name={showTranscript ? 'eye-off' : 'eye'} size={15} /> {showTranscript ? 'Hide transcript' : 'Reveal transcript'}</button></article><article><div><Icon name="languages" size={19} /><h3>Translation</h3></div>{showTranslation ? <div className="listening-revealed"><p>{item.gloss}</p><small>{item.pos} · {item.jlpt}</small></div> : <p>Test your understanding before showing the English meaning.</p>}<button type="button" onClick={() => setShowTranslation((value) => !value)}><Icon name={showTranslation ? 'eye-off' : 'eye'} size={15} /> {showTranslation ? 'Hide translation' : 'Reveal translation'}</button></article></div></section>

      <section className="listening-detail-section glass" id="listening-context" aria-labelledby="listening-context-heading"><div className="listening-section-head"><div><p className="listening-kicker">REAL COURSE CONTEXT</p><h2 id="listening-context-heading">Examples</h2></div><span className="tabular">{item.examples.length} stored</span></div>{item.examples.length === 0 ? <DataEmpty glyph="例" title="No context example stored" body="The audio lesson still uses the real vocabulary reading and translation. No sentence has been generated to fill this gap." /> : <ul className="listening-context-list">{item.examples.map((example, index) => <li key={`${item.id}-${index}`}><span className="tabular">{String(index + 1).padStart(2, '0')}</span><div><p className="ja" lang="ja">{example.sentence}</p>{example.reading ? <small className="ja" lang="ja">{example.reading}</small> : null}{example.romaji ? <small>{example.romaji}</small> : null}<p>{example.gloss}</p></div></li>)}</ul>}<p className="listening-context-note"><Icon name="check" size={13} /> These sentences provide written context. The current audio route voices the vocabulary reading, not the full example sentence.</p></section>

      <section className="listening-detail-section glass" id="listening-shadowing" aria-labelledby="listening-shadowing-heading"><div className="listening-section-head"><div><p className="listening-kicker">LISTEN · REPEAT · COMPARE</p><h2 id="listening-shadowing-heading">Shadowing</h2></div></div><div className="listening-shadowing-intro"><ol><li><span>1</span><div><strong>Listen</strong><small>Replay the model above at a comfortable speed.</small></div></li><li><span>2</span><div><strong>Repeat</strong><small>Start the microphone and say the reading aloud.</small></div></li><li><span>3</span><div><strong>Compare</strong><small>Compare the browser transcript with the course reading.</small></div></li></ol><ShadowingRecorder target={reading} /></div></section>

      <nav className="listening-detail-pager glass" aria-label="Previous and next listening lessons">{previous ? <Link to="/listening/$id" params={{ id: previous.id }}><Icon name="chevron-left" size={15} /><span><small>Previous listening lesson</small><strong><b className="ja" lang="ja">{previous.lemma}</b> · {previous.gloss}</strong></span></Link> : <span />}{next ? <Link to="/listening/$id" params={{ id: next.id }}><span><small>Next listening lesson</small><strong>{next.gloss} · <b className="ja" lang="ja">{next.lemma}</b></strong></span><Icon name="chevron-right" size={15} /></Link> : <span />}</nav></main>

      <aside className="listening-detail-rail" aria-label="Listening facts and practice"><section className="listening-rail-card glass"><div className="listening-rail-head"><div><p className="listening-kicker">LESSON FACTS</p><h2>At a glance</h2></div></div><dl className="listening-fact-list"><div><dt>Course word</dt><dd className="ja" lang="ja">{item.lemma}</dd></div><div><dt>Reading</dt><dd className="ja" lang="ja">{item.reading}</dd></div><div><dt>JLPT</dt><dd>{item.jlpt}</dd></div><div><dt>Part of speech</dt><dd>{item.pos}</dd></div><div><dt>Examples</dt><dd className="tabular">{item.examples.length}</dd></div></dl></section><section className="listening-rail-card glass"><div className="listening-rail-head"><div><p className="listening-kicker">PRACTICE</p><h2>Continue studying</h2></div></div><ul className="listening-action-list"><li><Link to="/listening-shadowing"><span><Icon name="mic" size={17} /></span><span><strong>Shadowing library</strong><small>Choose any course reading</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/listening-quiz"><span><Icon name="sparkles" size={17} /></span><span><strong>Listening quiz</strong><small>Test audio recognition</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/review"><span><Icon name="refresh-cw" size={17} /></span><span><strong>Review queue</strong><small>Practise due SRS cards</small></span><Icon name="chevron-right" size={14} /></Link></li></ul></section><p className="listening-source-card"><Icon name="check" size={13} /> Transcript, translation, reading, and examples come from the course corpus. The player identifies when it uses a browser voice fallback.</p></aside></div>
  </div>;
}

function DataEmpty({ glyph, title, body }: { glyph: string; title: string; body: string }) {
  return <div className="listening-data-empty"><span className="ja">{glyph}</span><div><strong>{title}</strong><p>{body}</p></div></div>;
}

function DetailProblem({ title, body, retry }: { title: string; body: string; retry?: () => void }) {
  return <div className="page listening-reference"><div className="listening-empty glass"><Icon name="headphones" size={44} /><h1>{title}</h1><p>{body}</p><div className="listening-problem-actions"><Link className="btn btn-primary" to="/listening">Back to listening</Link>{retry ? <button type="button" className="btn btn-secondary" onClick={retry}>Try again</button> : null}</div></div></div>;
}

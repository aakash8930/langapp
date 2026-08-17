import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useSession } from '../../useSession';
import { ListeningAudioPlayer } from '../listening/ListeningAudioPlayer';
import { useBookmarks } from '../../hooks/useBookmarks';
import { useDictionaryHistory } from '../../hooks/useDictionaryHistory';
import { useCorpus, type GrammarItem, type VocabItem } from '../library/useCorpus';
import { Icon } from '../ui/Icon';
import { buildReadingEntries, readingKindLabel, tokenizeWithCourseVocab } from './readingData';
import { ReadingTabs } from './ReadingTabs';
import { useReadingBookmarks } from './useReadingBookmarks';
import { useReadingStats } from './useReadingStats';

import './reading.css';

type ReaderMode = 'study' | 'assisted' | 'immersion';
type FuriganaMode = 'always' | 'tap' | 'hidden';

export function InteractiveReader({ id }: { id: string }) {
  const corpus = useCorpus();
  const { session } = useSession();
  const { isBookmarked, toggle } = useReadingBookmarks();
  const { addQuery } = useDictionaryHistory();
  const { recordOpen, addReadingTime, recordCompletion, recordLookup, stats } = useReadingStats();
  const corpusItems = corpus.data?.items;
  const vocab = useMemo(() => corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? [], [corpusItems]);
  const grammar = useMemo(() => corpusItems?.filter((item): item is GrammarItem => item.kind === 'grammar') ?? [], [corpusItems]);
  const entries = useMemo(() => buildReadingEntries(vocab, grammar), [grammar, vocab]);
  const entry = entries.find((candidate) => candidate.id === id);
  const [mode, setMode] = useState<ReaderMode>('study');
  const [furigana, setFurigana] = useState<FuriganaMode>('always');
  const [showTapReading, setShowTapReading] = useState(false);
  const [showRomaji, setShowRomaji] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [selectedWord, setSelectedWord] = useState<VocabItem | null>(null);
  const [speed, setSpeed] = useState(session.state === 'signedIn' ? session.user.settings.audioSpeed : 1);
  const completed = stats.completions.some((completion) => completion.id === id);
  const activeStartedRef = useRef<number | null>(Date.now());
  const accruedSecondsRef = useRef(0);
  const tokens = useMemo(() => entry ? tokenizeWithCourseVocab(entry.sentence, vocab) : [], [entry, vocab]);
  const sourceVocab = entry?.kind === 'word' || entry?.kind === 'context' ? vocab.find((item) => item.id === entry.sourceId) : undefined;
  const sourceGrammar = entry?.kind === 'grammar' ? grammar.find((item) => item.id === entry.sourceId) : undefined;
  const currentIndex = entry ? entries.findIndex((candidate) => candidate.id === entry.id) : -1;
  const previous = currentIndex > 0 ? entries[currentIndex - 1] : undefined;
  const next = currentIndex >= 0 && currentIndex < entries.length - 1 ? entries[currentIndex + 1] : undefined;

  useEffect(() => {
    recordOpen(id);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && activeStartedRef.current !== null) {
        accruedSecondsRef.current += (Date.now() - activeStartedRef.current) / 1000;
        activeStartedRef.current = null;
      } else if (document.visibilityState === 'visible' && activeStartedRef.current === null) {
        activeStartedRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (activeStartedRef.current !== null) accruedSecondsRef.current += (Date.now() - activeStartedRef.current) / 1000;
      addReadingTime(accruedSecondsRef.current);
    };
  }, [addReadingTime, id, recordOpen]);

  function elapsedSeconds(): number {
    return accruedSecondsRef.current + (activeStartedRef.current === null ? 0 : (Date.now() - activeStartedRef.current) / 1000);
  }

  function chooseMode(nextMode: ReaderMode) {
    setMode(nextMode);
    setSelectedWord(null);
    if (nextMode === 'study') {
      setFurigana('always');
      setShowRomaji(true);
    } else if (nextMode === 'assisted') {
      setFurigana('tap');
      setShowRomaji(false);
    } else {
      setFurigana('hidden');
      setShowRomaji(false);
      setShowTranslation(false);
    }
  }

  function openWord(item: VocabItem) {
    setSelectedWord(item);
    addQuery(item.lemma);
    recordLookup(item.id);
  }

  function markRead() {
    if (!entry || completed) return;
    const wordIds = [...new Set(tokens.filter((token) => token.kind === 'vocab').map((token) => token.item.id))];
    recordCompletion({ id: entry.id, characters: entry.characters, seconds: elapsedSeconds(), wordIds, jlpt: entry.jlpt });
  }

  if (corpus.isPending) return <div className="page reading-reference"><ReadingTabs active="library" /><div className="reading-loading glass" role="status"><Icon name="book-open" size={40} /><p>Opening interactive reader…</p></div></div>;
  if (corpus.isError) return <ReaderProblem title="Reader content could not be loaded" body="The content API may be asleep. Your saved passage snapshots remain in Reading Bookmarks." retry={() => void corpus.refetch()} />;
  if (!entry) return <ReaderProblem title="Reading entry not found" body="This entry is not part of the currently loaded course corpus." />;

  const hasReading = Boolean(entry.reading && entry.reading !== entry.sentence);
  const showReading = furigana === 'always' || furigana === 'tap' && showTapReading;

  return <div className={`page reading-reference reading-reader-page is-${mode}`}><ReadingTabs active="library" /><nav className="reading-crumbs" aria-label="Breadcrumb"><Link to="/read">Reading</Link><Icon name="chevron-right" size={13} /><Link to="/reading-library">Library</Link><Icon name="chevron-right" size={13} /><span aria-current="page">{readingKindLabel(entry.kind)}</span></nav><header className="reading-reader-header glass"><div><span className="reading-type-badge">{readingKindLabel(entry.kind)}</span><p className="reading-kicker">INTERACTIVE READER · {entry.jlpt}</p><h1 className={mode === 'immersion' ? 'ja' : undefined} lang={mode === 'immersion' ? 'ja' : undefined}>{mode === 'immersion' ? entry.sentence : entry.kind === 'word' ? entry.translation : entry.label}</h1><p>{mode === 'immersion' ? 'Immersion reading' : entry.kind === 'word' ? entry.label : `Source: ${entry.sourceTitle}`}</p></div><div className="reading-reader-header-actions"><button type="button" className={isBookmarked(entry.id) ? 'is-saved' : ''} onClick={() => toggle(entry)}><Icon name="book-marked" size={16} fill={isBookmarked(entry.id) ? 'currentColor' : 'none'} /> {isBookmarked(entry.id) ? 'Saved' : 'Save passage'}</button><button type="button" className={completed ? 'is-complete' : ''} onClick={markRead} disabled={completed}><Icon name="check" size={16} /> {completed ? 'Marked as read' : 'Mark as read'}</button></div></header><section className="reading-mode-bar glass" aria-label="Reading mode"><div><button type="button" className={mode === 'study' ? 'is-active' : ''} onClick={() => chooseMode('study')} aria-pressed={mode === 'study'}><strong>Study</strong><small>Furigana, romaji, lookup</small></button><button type="button" className={mode === 'assisted' ? 'is-active' : ''} onClick={() => chooseMode('assisted')} aria-pressed={mode === 'assisted'}><strong>Assisted</strong><small>Reveal support when needed</small></button><button type="button" className={mode === 'immersion' ? 'is-active' : ''} onClick={() => chooseMode('immersion')} aria-pressed={mode === 'immersion'}><strong>Immersion</strong><small>Japanese text only</small></button></div>{mode !== 'immersion' ? <div className="reading-support-controls"><label><span>Furigana</span><select value={furigana} onChange={(event) => { setFurigana(event.target.value as FuriganaMode); setShowTapReading(false); }} disabled={!hasReading}><option value="always">Always show</option><option value="hidden">Hide</option><option value="tap">Show on tap</option><option disabled>Unknown kanji only · unavailable</option></select></label><label><input type="checkbox" checked={showRomaji} onChange={(event) => setShowRomaji(event.target.checked)} disabled={!entry.romaji} /> Romaji</label></div> : <span>Support controls are hidden in immersion mode.</span>}</section>
    <div className="reading-reader-layout"><main className="reading-reader-main"><article className="reading-passage glass"><div className="reading-passage-label"><span>{readingKindLabel(entry.kind)}</span><span className="tabular">{entry.characters} Japanese characters</span></div>{hasReading && furigana === 'tap' ? <button type="button" className="reading-furigana-toggle" onClick={() => setShowTapReading((value) => !value)}><Icon name={showTapReading ? 'eye-off' : 'eye'} size={15} /> {showTapReading ? 'Hide reading' : 'Show reading'}</button> : null}<p className="reading-japanese" lang="ja">{hasReading && showReading ? <ruby>{mode === 'immersion' ? entry.sentence : tokens.map((token) => token.kind === 'vocab' ? <button type="button" key={token.key} className="reading-word-token" onClick={() => openWord(token.item)}>{token.value}</button> : <span key={token.key}>{token.value}</span>)}<rt>{entry.reading}</rt></ruby> : mode === 'immersion' ? entry.sentence : tokens.map((token) => token.kind === 'vocab' ? <button type="button" key={token.key} className="reading-word-token" onClick={() => openWord(token.item)}>{token.value}</button> : <span key={token.key}>{token.value}</span>)}</p>{mode !== 'immersion' && showRomaji && entry.romaji ? <p className="reading-romaji-line">{entry.romaji}</p> : null}{mode !== 'immersion' ? <div className="reading-translation-panel"><div><Icon name="languages" size={18} /><strong>Translation</strong></div>{showTranslation ? <p>{entry.translation}</p> : <p className="is-concealed">Read the Japanese before revealing the English.</p>}<button type="button" onClick={() => setShowTranslation((value) => !value)}><Icon name={showTranslation ? 'eye-off' : 'eye'} size={15} /> {showTranslation ? 'Hide translation' : 'Reveal translation'}</button></div> : null}<p className="reading-interaction-note">{mode === 'immersion' ? 'The passage shows Japanese only; lookup and aid controls are paused.' : tokens.some((token) => token.kind === 'vocab') ? 'Underlined course words can be opened for a dictionary lookup.' : 'No vocabulary span in this sentence could be matched confidently against the course corpus.'}</p></article>{sourceGrammar ? <section className="reading-source-card glass"><div className="reading-section-head"><div><p className="reading-kicker">GRAMMAR CONNECTION</p><h2>{sourceGrammar.title}</h2></div><span>{sourceGrammar.jlpt}</span></div><p>{sourceGrammar.explanation}</p>{sourceGrammar.usage ? <p><strong>Usage:</strong> {sourceGrammar.usage}</p> : null}<Link className="btn btn-secondary btn-sm" to="/grammar/$id" params={{ id: sourceGrammar.id }}>Open full grammar explanation</Link></section> : sourceVocab ? <section className="reading-source-card glass"><div className="reading-section-head"><div><p className="reading-kicker">VOCABULARY CONNECTION</p><h2><span className="ja" lang="ja">{sourceVocab.lemma}</span> · {sourceVocab.gloss}</h2></div><span>{sourceVocab.jlpt}</span></div><dl><div><dt>Reading</dt><dd className="ja" lang="ja">{sourceVocab.reading}</dd></div><div><dt>Part of speech</dt><dd>{sourceVocab.pos}</dd></div><div><dt>Stored examples</dt><dd className="tabular">{sourceVocab.examples.length}</dd></div></dl><Link className="btn btn-secondary btn-sm" to="/vocabulary">Open vocabulary library</Link></section> : null}<nav className="reading-reader-pager glass" aria-label="Previous and next reading entries">{previous ? <Link to="/reading/$id" params={{ id: previous.id }}><Icon name="chevron-left" size={14} /><span><small>Previous</small><strong className="ja" lang="ja">{previous.sentence}</strong></span></Link> : <span />}{next ? <Link to="/reading/$id" params={{ id: next.id }}><span><small>Next</small><strong className="ja" lang="ja">{next.sentence}</strong></span><Icon name="chevron-right" size={14} /></Link> : <span />}</nav></main><aside className="reading-reader-rail"><DictionaryPopup item={selectedWord} speed={speed} onSpeedChange={setSpeed} onClose={() => setSelectedWord(null)} /><section className="reading-rail-card glass"><p className="reading-kicker">READER FACTS</p><h2>About this entry</h2><dl><div><dt>Content</dt><dd>{readingKindLabel(entry.kind)}</dd></div><div><dt>JLPT</dt><dd>{entry.jlpt}</dd></div><div><dt>Japanese characters</dt><dd className="tabular">{entry.characters}</dd></div><div><dt>Course source</dt><dd>{entry.sourceTitle}</dd></div><div><dt>Dictionary spans</dt><dd className="tabular">{tokens.filter((token) => token.kind === 'vocab').length}</dd></div></dl></section><section className="reading-rail-card glass"><p className="reading-kicker">CONTINUE LEARNING</p><h2>From this passage</h2><ul><li><Link to="/dictionary"><Icon name="search" size={15} /><span>Course dictionary</span><Icon name="chevron-right" size={13} /></Link></li><li><Link to="/vocab-bookmarks"><Icon name="book-marked" size={15} /><span>Saved vocabulary</span><Icon name="chevron-right" size={13} /></Link></li><li><Link to="/vocab-practice"><Icon name="sparkles" size={15} /><span>Vocabulary quiz</span><Icon name="chevron-right" size={13} /></Link></li><li><Link to="/kanji"><span className="ja" lang="ja">漢</span><span>Course kanji</span><Icon name="chevron-right" size={13} /></Link></li><li><Link to="/grammar"><Icon name="book-open" size={15} /><span>Grammar library</span><Icon name="chevron-right" size={13} /></Link></li><li><Link to="/practice-hub"><Icon name="refresh-cw" size={15} /><span>Scheduled review</span><Icon name="chevron-right" size={13} /></Link></li><li><Link to="/progress"><Icon name="trending-up" size={15} /><span>Account progress</span><Icon name="chevron-right" size={13} /></Link></li></ul></section></aside></div>
  </div>;
}

function DictionaryPopup({ item, speed, onSpeedChange, onClose }: { item: VocabItem | null; speed: number; onSpeedChange: (speed: number) => void; onClose: () => void }) {
  const { isBookmarked, toggle } = useBookmarks();
  if (!item) return <section className="reading-dictionary-placeholder glass"><Icon name="search" size={25} /><p className="reading-kicker">DICTIONARY POPUP</p><h2>Tap an underlined word</h2><p>Recognised spans open the real course vocabulary entry here. Unmatched text remains plain rather than receiving a guessed definition.</p></section>;
  const saved = isBookmarked(item.id);
  return <section className="reading-dictionary-popup glass" aria-live="polite"><header><div><p className="reading-kicker">COURSE DICTIONARY</p><h2 className="ja" lang="ja">{item.lemma}</h2></div><button type="button" onClick={onClose} aria-label="Close dictionary popup">×</button></header><p className="ja" lang="ja">{item.reading}</p>{item.romaji ? <small>{item.romaji}</small> : null}<strong>{item.gloss}</strong><div className="reading-dictionary-tags"><span>{item.jlpt}</span><span>{item.pos}</span></div><ListeningAudioPlayer itemId={item.id} text={item.reading || item.lemma} speed={speed} onSpeedChange={onSpeedChange} compact /><button type="button" className={`btn ${saved ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggle(item.id, item.lemma, item.reading, item.gloss)}><Icon name="book-marked" size={15} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Remove saved word' : 'Save to vocabulary'}</button>{item.examples.length > 0 ? <details><summary>Stored examples ({item.examples.length})</summary><ul>{item.examples.slice(0, 3).map((example, index) => <li key={`${item.id}-${index}`}><p className="ja" lang="ja">{example.sentence}</p><small>{example.gloss}</small></li>)}</ul></details> : <p className="reading-dictionary-empty">No example is stored for this word.</p>}<p className="reading-dictionary-note">Saving adds this word to the browser&rsquo;s vocabulary bookmarks. Saved words remain browser-local bookmarks.</p></section>;
}

function ReaderProblem({ title, body, retry }: { title: string; body: string; retry?: () => void }) {
  return <div className="page reading-reference"><ReadingTabs active="library" /><section className="reading-empty glass"><Icon name="book-open" size={42} /><h1>{title}</h1><p>{body}</p><div className="reading-problem-actions"><Link className="btn btn-primary" to="/reading-library">Back to library</Link>{retry ? <button type="button" className="btn btn-secondary" onClick={retry}>Try again</button> : null}</div></section></div>;
}

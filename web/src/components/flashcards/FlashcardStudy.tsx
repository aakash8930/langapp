import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useSession } from '../../useSession';
import { ListeningAudioPlayer } from '../listening/ListeningAudioPlayer';
import { Icon } from '../ui/Icon';
import { flashcardKindLabel, type Flashcard, type FlashcardDeck } from './flashcardData';
import { FlashcardTabs } from './FlashcardTabs';
import { useFlashcardCatalog } from './useFlashcardCatalog';
import type { FlashcardStudySession } from './useFlashcardDecks';

import './flashcards.css';

type Grade = keyof FlashcardStudySession['grades'];
type Direction = 'standard' | 'reverse';

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function FlashcardStudy({ deckId }: { deckId: string }) {
  const catalog = useFlashcardCatalog();
  const isCourse = deckId.startsWith('course-');
  const deck = catalog.decks.find((candidate) => candidate.id === deckId);

  if (isCourse && catalog.corpus.isPending) return <StudyShell><section className="flashcard-loading-page glass" role="status"><Icon name="layers" size={42} /><p>Loading course cards…</p></section></StudyShell>;
  if (isCourse && catalog.corpus.isError) return <StudyShell><section className="flashcard-empty glass"><Icon name="wifi-off" size={42} /><h1>Course deck unavailable</h1><p>The content API may be asleep. Custom and connected decks can still be studied.</p><div><button type="button" className="btn btn-secondary" onClick={() => void catalog.corpus.refetch()}>Try again</button><Link className="btn btn-primary" to="/flashcards">Back to decks</Link></div></section></StudyShell>;
  if (!deck) return <StudyShell><section className="flashcard-empty glass"><Icon name="layers" size={42} /><h1>Deck not found</h1><p>This deck is not available in the current course or this browser.</p><Link className="btn btn-primary" to="/flashcards">Back to decks</Link></section></StudyShell>;
  if (deck.cards.length === 0) return <StudyShell><section className="flashcard-empty glass"><span className="ja">空</span><h1>This deck has no cards</h1><p>Add or collect cards before starting a session.</p><Link className="btn btn-primary" to={deck.origin === 'custom' ? '/flashcards-my-decks' : '/flashcards'}>Back to decks</Link></section></StudyShell>;
  return <StudyRunner key={deck.id} deck={deck} onRecord={catalog.local.recordSession} />;
}

function StudyRunner({ deck, onRecord }: { deck: FlashcardDeck; onRecord: ReturnType<typeof useFlashcardCatalog>['local']['recordSession'] }) {
  const { session } = useSession();
  const [direction, setDirection] = useState<Direction>('standard');
  const [shuffle, setShuffle] = useState(true);
  const [limit, setLimit] = useState(Math.min(20, deck.cards.length));
  const [showExamples, setShowExamples] = useState(true);
  const [started, setStarted] = useState(false);
  const [run, setRun] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [complete, setComplete] = useState(false);
  const [speed, setSpeed] = useState(session.state === 'signedIn' ? session.user.settings.audioSpeed : 1);
  const startedAtRef = useRef(0);
  const activeStartedRef = useRef<number | null>(null);
  const accruedRef = useRef(0);
  const current = run[index];
  const counts = useMemo(() => grades.reduce((result, grade) => ({ ...result, [grade]: result[grade] + 1 }), { missed: 0, hard: 0, good: 0, easy: 0 }), [grades]);

  function begin() {
    const ordered = shuffle ? shuffled(deck.cards) : [...deck.cards];
    setRun(ordered.slice(0, limit));
    setIndex(0);
    setGrades([]);
    setRevealed(false);
    setHint(false);
    setComplete(false);
    setStarted(true);
    startedAtRef.current = Date.now();
    activeStartedRef.current = Date.now();
    accruedRef.current = 0;
  }

  function activeSeconds(): number {
    return accruedRef.current + (activeStartedRef.current === null ? 0 : (Date.now() - activeStartedRef.current) / 1000);
  }

  function grade(value: Grade) {
    if (!current || !revealed) return;
    const nextGrades = [...grades, value];
    setGrades(nextGrades);
    if (index >= run.length - 1) {
      const finalCounts = nextGrades.reduce((result, gradeValue) => ({ ...result, [gradeValue]: result[gradeValue] + 1 }), { missed: 0, hard: 0, good: 0, easy: 0 });
      onRecord({ deckId: deck.id, deckTitle: deck.title, startedAt: startedAtRef.current, seconds: Math.max(1, Math.floor(activeSeconds())), studied: nextGrades.length, grades: finalCounts });
      activeStartedRef.current = null;
      setComplete(true);
      return;
    }
    setIndex((valueIndex) => valueIndex + 1);
    setRevealed(false);
    setHint(false);
  }

  function pauseForVisibility() {
    if (!started || complete) return;
    if (document.visibilityState === 'hidden' && activeStartedRef.current !== null) {
      accruedRef.current += (Date.now() - activeStartedRef.current) / 1000;
      activeStartedRef.current = null;
    } else if (document.visibilityState === 'visible' && activeStartedRef.current === null) {
      activeStartedRef.current = Date.now();
    }
  }

  useVisibilityListener(pauseForVisibility);

  if (!started) return <StudyShell><header className="flashcard-page-header"><div><p className="flashcard-kicker">STUDY SESSION SETUP</p><h1>{deck.title}</h1><p>{deck.description}</p></div><span className={`flashcard-origin is-${deck.origin}`}>{deck.origin}</span></header><div className="flashcard-setup-layout"><main className="flashcard-setup-card glass"><div className="flashcard-setup-preview"><span className="flashcard-deck-glyph ja">{deck.glyph}</span><div><p className="flashcard-kicker">{deck.note}</p><h2>{deck.cards.length} available cards</h2><p>Configure this unscheduled practice run. It will not create or move an FSRS due date.</p></div></div><fieldset><legend>Card direction</legend><label><input type="radio" name="direction" checked={direction === 'standard'} onChange={() => setDirection('standard')} /><span><strong>Japanese first</strong><small>Recall the meaning or explanation</small></span></label><label><input type="radio" name="direction" checked={direction === 'reverse'} onChange={() => setDirection('reverse')} /><span><strong>Reverse</strong><small>Recall the Japanese from the answer</small></span></label></fieldset><div className="flashcard-setup-controls"><label><span>Cards in session</span><select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>{[10, 20, 50, deck.cards.length].filter((value, position, values) => value <= deck.cards.length && values.indexOf(value) === position).map((value) => <option key={value} value={value}>{value === deck.cards.length ? `All ${value}` : value}</option>)}</select></label><label><input type="checkbox" checked={shuffle} onChange={(event) => setShuffle(event.target.checked)} /> Shuffle cards</label><label><input type="checkbox" checked={showExamples} onChange={(event) => setShowExamples(event.target.checked)} /> Show stored examples</label></div><button type="button" className="btn btn-primary flashcard-start-session" onClick={begin}><Icon name="play" size={16} /> Start session</button></main><aside className="flashcard-rail-card glass"><p className="flashcard-kicker">SCHEDULING</p><h2>Practice, not due review</h2><p>The confidence buttons in this session create only local activity. To change an account card&rsquo;s schedule, grade it through Review.</p><Link to="/flashcards-review-queue">Open real review queue <Icon name="chevron-right" size={13} /></Link></aside></div></StudyShell>;

  if (complete) {
    const recalled = counts.hard + counts.good + counts.easy;
    return <StudyShell><section className="flashcard-session-summary glass"><Icon name="check-circle-2" size={44} /><p className="flashcard-kicker">LOCAL SESSION COMPLETE</p><h1>{deck.title}</h1><strong className="tabular">{recalled} / {grades.length}</strong><p>Self-recalled cards in this run. This is not an FSRS retention estimate.</p><dl><div><dt>Missed</dt><dd>{counts.missed}</dd></div><div><dt>Hard</dt><dd>{counts.hard}</dd></div><div><dt>Good</dt><dd>{counts.good}</dd></div><div><dt>Easy</dt><dd>{counts.easy}</dd></div></dl><div><button type="button" className="btn btn-primary" onClick={() => setStarted(false)}>Study again</button><Link className="btn btn-secondary" to="/flashcards-statistics">View local statistics</Link>{session.state === 'signedIn' ? <Link className="btn btn-secondary" to="/review-session">Review due cards</Link> : null}</div></section></StudyShell>;
  }

  if (!current) return null;
  const front = direction === 'standard' ? current.front : current.back;
  const back = direction === 'standard' ? current.back : current.front;
  return <StudyShell><header className="flashcard-study-header"><div><Link to="/flashcards"><Icon name="chevron-left" size={14} /> Decks</Link><span>{deck.title}</span></div><span className="tabular">{index + 1} / {run.length}</span></header><div className="flashcard-study-progress" role="progressbar" aria-label="Flashcard session progress" aria-valuemin={0} aria-valuemax={run.length} aria-valuenow={index}><span style={{ width: `${index / run.length * 100}%` }} /></div><div className="flashcard-study-layout"><main><article className={`flashcard-study-card glass ${revealed ? 'is-revealed' : ''}`}><div className="flashcard-study-card-top"><span className="flashcard-kind-badge">{flashcardKindLabel(current.kind)}</span><span>{current.tags.slice(0, 2).join(' · ')}</span></div><div className="flashcard-face"><p className={direction === 'standard' || revealed ? 'ja' : ''} lang={direction === 'standard' || revealed ? 'ja' : undefined}>{revealed ? back : front}</p>{!revealed && hint && current.reading ? <span className="ja" lang="ja">{current.reading}</span> : null}{revealed ? <>{current.reading && direction === 'standard' ? <span className="ja" lang="ja">{current.reading}</span> : null}{current.detail ? <small>{current.detail}</small> : null}{showExamples && current.example ? <blockquote className="ja" lang="ja">{current.example}</blockquote> : null}</> : null}</div>{revealed && current.kind === 'vocabulary' && current.sourceItemId ? <ListeningAudioPlayer itemId={current.sourceItemId} text={current.reading || current.front} speed={speed} onSpeedChange={setSpeed} compact /> : null}<p className="flashcard-study-tip">{revealed ? 'Choose how recall felt. This rating stays in local deck statistics.' : 'Recall before revealing. Hints show the stored reading when one exists.'}</p></article>{!revealed ? <div className="flashcard-reveal-actions"><button type="button" className="btn btn-secondary" onClick={() => setHint((value) => !value)} disabled={!current.reading}><Icon name={hint ? 'eye-off' : 'eye'} size={15} /> {hint ? 'Hide hint' : 'Show hint'}</button><button type="button" className="btn btn-primary" onClick={() => setRevealed(true)}><Icon name="repeat" size={15} /> Reveal answer</button></div> : <div className="flashcard-confidence" aria-label="Rate your recall for local statistics"><button type="button" className="is-missed" onClick={() => grade('missed')}><Icon name="x" size={20} /><strong>Missed</strong><small>Could not recall</small></button><button type="button" className="is-hard" onClick={() => grade('hard')}><Icon name="circle-alert" size={20} /><strong>Hard</strong><small>Recalled with effort</small></button><button type="button" className="is-good" onClick={() => grade('good')}><Icon name="check" size={20} /><strong>Good</strong><small>Recalled clearly</small></button><button type="button" className="is-easy" onClick={() => grade('easy')}><Icon name="sparkles" size={20} /><strong>Easy</strong><small>Immediate recall</small></button></div>}</main><aside className="flashcard-study-rail"><section className="flashcard-rail-card glass"><p className="flashcard-kicker">RUN SETTINGS</p><h2>{direction === 'standard' ? 'Japanese → answer' : 'Answer → Japanese'}</h2><dl><div><dt>Order</dt><dd>{shuffle ? 'Shuffled' : 'Deck order'}</dd></div><div><dt>Examples</dt><dd>{showExamples ? 'Shown on back' : 'Hidden'}</dd></div><div><dt>Scheduling</dt><dd>Unchanged</dd></div></dl></section><section className="flashcard-rail-card glass"><p className="flashcard-kicker">THIS RUN</p><h2>Confidence checks</h2><dl><div><dt>Missed</dt><dd>{counts.missed}</dd></div><div><dt>Hard</dt><dd>{counts.hard}</dd></div><div><dt>Good</dt><dd>{counts.good}</dd></div><div><dt>Easy</dt><dd>{counts.easy}</dd></div></dl></section></aside></div></StudyShell>;
}

function useVisibilityListener(listener: () => void) {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  useEffect(() => {
    const handler = () => listenerRef.current();
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
}

function StudyShell({ children }: { children: React.ReactNode }) {
  return <div className="page flashcard-reference"><FlashcardTabs active="decks" />{children}</div>;
}

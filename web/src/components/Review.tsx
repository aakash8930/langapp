import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import {
  fetchDueReviews,
  gradeReview,
  REVIEW_GRADES,
  type DueCard,
  type DueReviews,
  type GradeResult,
  type ResolvedItem,
  type ReviewGrade,
} from '../api';
import { queryKeys } from '../queryKeys';
import { showsRomaji } from '../romaji';
import { SpeakButton } from './SpeakButton';
import { XpBurst } from './XpBurst';
import { Icon } from './ui/Icon';
import { formatInterval, reviewItemCopy } from './review/reviewFormatters';

/**
 * The focused, server-backed review loop. The queue is frozen for this mount so
 * query invalidation after a grade cannot remove or reorder the card under the
 * learner. The POST still catches up behind the immediately-advanced UI.
 */
export function Review({ onFinished, audioSpeed }: { onFinished: () => void; audioSpeed: number }) {
  const sessionQuery = useQuery({ queryKey: queryKeys.reviews.due, queryFn: fetchDueReviews });
  if (sessionQuery.isError) return <section className="review-state glass" role="alert"><Icon name="wifi-off" size={42} /><h2>Can&rsquo;t load today&rsquo;s review session</h2><p>The scheduling API may be asleep. No local fallback will change FSRS state.</p><div><button className="btn btn-secondary" type="button" onClick={() => void sessionQuery.refetch()}>Try again</button><Link className="btn btn-primary" to="/review">Back to today</Link></div></section>;
  if (!sessionQuery.data) return <section className="review-state glass" role="status"><Icon name="refresh-cw" size={42} /><h2>Loading the next due batch…</h2></section>;
  return <ReviewRun initial={sessionQuery.data} onFinished={onFinished} audioSpeed={audioSpeed} />;
}

function ReviewRun({ initial, onFinished, audioSpeed }: { initial: DueReviews; onFinished: () => void; audioSpeed: number }) {
  const queryClient = useQueryClient();
  const [session] = useState(initial);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<GradeResult[]>([]);
  const [requeued, setRequeued] = useState<DueCard[]>([]);
  const [lost, setLost] = useState(0);
  const [pendingGrades, setPendingGrades] = useState(0);
  const retriedRef = useRef(new Set<string>());
  const activeMsRef = useRef(0);
  const visibleSinceRef = useRef<number | null>(typeof document === 'undefined' || document.visibilityState === 'visible' ? Date.now() : null);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && visibleSinceRef.current !== null) {
        activeMsRef.current += Date.now() - visibleSinceRef.current;
        visibleSinceRef.current = null;
      } else if (document.visibilityState === 'visible' && visibleSinceRef.current === null) {
        visibleSinceRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const gradeMutation = useMutation({
    mutationFn: ({ cardId, grade, responseTimeMs }: { cardId: string; grade: ReviewGrade; responseTimeMs: number }) => gradeReview(cardId, grade, responseTimeMs),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.progress });
      void queryClient.invalidateQueries({ queryKey: queryKeys.learning.analytics });
      void queryClient.invalidateQueries({ queryKey: queryKeys.learning.memoryModel });
    },
  });

  const full = [...session.cards, ...requeued];
  const newCount = session.cards.filter((entry) => entry.state === 'new').length;
  const dueCount = session.cards.length - newCount;
  const card = full[index];
  const sessionOver = full.length > 0 && index >= full.length;
  const latest = results.at(-1);

  if (full.length === 0) return <section className="review-state glass"><Icon name="check-circle-2" size={44} /><h2>Nothing remains in today&rsquo;s session</h2><p>Cards return only when their server due time arrives. Continue learning or inspect the upcoming forecast.</p><div><Link className="btn btn-primary" to="/courses">Continue learning</Link><Link className="btn btn-secondary" to="/review-forecast">View forecast</Link></div></section>;

  if (sessionOver) {
    const grades = { again: 0, hard: 0, good: 0, easy: 0 };
    results.forEach((result) => { grades[result.grade] += 1; });
    const xp = results.reduce((sum, result) => sum + result.xpAwarded, 0);
    return <section className="review-session-summary glass"><Icon name="check-circle-2" size={46} /><p className="review-kicker">SERVER-BACKED SESSION COMPLETE</p><h2>{pendingGrades > 0 ? `Saving ${pendingGrades} final grade${pendingGrades === 1 ? '' : 's'}…` : 'Review complete'}</h2><XpBurst xp={xp} /><strong className="tabular">{results.length}</strong><span>confirmed reviews</span><dl><div><dt>Again</dt><dd>{grades.again}</dd></div><div><dt>Hard</dt><dd>{grades.hard}</dd></div><div><dt>Good</dt><dd>{grades.good}</dd></div><div><dt>Easy</dt><dd>{grades.easy}</dd></div></dl>{lost > 0 ? <p className="review-save-error">{lost} grade{lost === 1 ? '' : 's'} could not be saved. Those cards remain governed by their previous server due state.</p> : null}<p>XP shown here is only the amount returned by successful due-card grade requests.</p><div><Link className="btn btn-primary" to="/review">Back to today</Link><Link className="btn btn-secondary" to="/review-history">Review history</Link></div></section>;
  }

  function submit(grade: ReviewGrade) {
    if (!card || !revealed) return;
    const wasLast = index === full.length - 1;
    const graded = card;
    const responseTimeMs = Math.max(0, Math.round(activeMsRef.current + (visibleSinceRef.current === null ? 0 : Date.now() - visibleSinceRef.current)));
    setIndex((value) => value + 1);
    setRevealed(false);
    setPendingGrades((value) => value + 1);
    activeMsRef.current = 0;
    visibleSinceRef.current = document.visibilityState === 'visible' ? Date.now() : null;
    void gradeMutation.mutateAsync({ cardId: graded.cardId, grade, responseTimeMs })
      .then((result) => {
        setResults((current) => [...current, result]);
        onFinished();
      })
      .catch(() => {
        if (wasLast || retriedRef.current.has(graded.cardId)) {
          setLost((value) => value + 1);
          return;
        }
        retriedRef.current.add(graded.cardId);
        setRequeued((current) => [...current, graded]);
      })
      .finally(() => setPendingGrades((value) => Math.max(0, value - 1)));
  }

  const copy = reviewItemCopy(card.item);
  return <div className="review-session-layout"><main><header className="review-session-head"><div><Link to="/review"><Icon name="chevron-left" size={14} /> Leave session</Link><span>{newCount} new · {dueCount} learning/review in this frozen batch</span></div><strong className="tabular">{index + 1} / {full.length}{session.totalDue > full.length ? ` of ${session.totalDue} due` : ''}</strong></header><div className="review-session-progress" role="progressbar" aria-label="Review session progress" aria-valuemin={0} aria-valuemax={full.length} aria-valuenow={index}><span style={{ width: `${index / full.length * 100}%` }} /></div><article className={`review-session-card glass ${revealed ? 'is-revealed' : ''}`}><div className="review-session-card-meta"><span className="review-kind-badge">{copy.kind}</span><span>{card.state} · {card.mastery}</span></div><div className="review-session-face"><CardFront item={card.item} />{revealed ? <CardBack item={card.item} audioSpeed={audioSpeed} /> : <p>Recall the answer before revealing it.</p>}</div></article>{!revealed ? <button className="btn btn-primary review-show-answer" type="button" onClick={() => setRevealed(true)}><Icon name="eye" size={16} /> Show answer</button> : <div className="review-grade-grid" aria-label="How well did you remember this card?">{REVIEW_GRADES.map((grade) => <button key={grade} type="button" className={`is-${grade}`} onClick={() => submit(grade)}><Icon name={grade === 'again' ? 'repeat' : grade === 'hard' ? 'circle-alert' : grade === 'good' ? 'check' : 'sparkles'} size={20} /><strong>{grade}</strong><small>{grade === 'again' ? 'Forgot' : grade === 'hard' ? 'Difficult' : grade === 'good' ? 'Remembered' : 'Immediate'}</small></button>)}</div>}</main><aside className="review-session-rail"><section className="review-rail-card glass"><p className="review-kicker">CURRENT CARD</p><h2>Server scheduling state</h2><dl><div><dt>State</dt><dd>{card.state}</dd></div><div><dt>Mastery band</dt><dd>{card.mastery}</dd></div><div><dt>Prior reviews</dt><dd>{card.totalReviews}</dd></div><div><dt>Lapses</dt><dd>{card.lapses}</dd></div></dl></section><section className="review-rail-card glass"><p className="review-kicker">LAST CONFIRMED GRADE</p>{latest ? <><h2 className="review-latest-grade">{latest.grade}</h2><dl><div><dt>Next interval</dt><dd>{formatInterval(latest.intervalMinutes)}</dd></div><div><dt>New state</dt><dd>{latest.state}</dd></div><div><dt>XP returned</dt><dd>+{latest.xpAwarded}</dd></div></dl></> : <><h2>No saved grade yet</h2><p>The server&rsquo;s returned interval appears here after the first response.</p></>}</section><section className="review-rail-card glass"><p className="review-kicker">FSRS BOUNDARY</p><h2>No client interval guesses</h2><p>Grade buttons intentionally show no promised “1m” or “4d” labels. The actual next interval depends on server FSRS state and is known only after grading.</p></section></aside></div>;
}

function CardFront({ item }: { item: ResolvedItem }) {
  if (item.kind === 'kana') return <p className="review-card-prompt ja" lang="ja">{item.kana}</p>;
  if (item.kind === 'kanji') return <p className="review-card-prompt ja" lang="ja">{item.char}</p>;
  if (item.kind === 'vocab') return <p className="review-card-prompt ja" lang="ja">{item.lemma}</p>;
  return <p className="review-card-prompt ja" lang="ja">{item.title}</p>;
}

function CardBack({ item, audioSpeed }: { item: ResolvedItem; audioSpeed: number }) {
  const lines = backLines(item);
  return <div className="review-card-back">{lines.map((line, position) => <p key={`${position}-${line}`} className={position === 0 ? 'review-card-answer ja' : 'review-card-detail'}>{line}</p>)}{item.kind === 'vocab' ? (
    <SpeakButton
      vocabId={item.id}
      text={item.reading || item.lemma}
      speed={audioSpeed}
      label="Hear it"
    />
  ) : null}</div>;
}

function backLines(item: ResolvedItem): string[] {
  if (item.kind === 'kana') return [item.romaji];
  if (item.kind === 'kanji') return [[item.on.join('、'), item.kun.join('、')].filter(Boolean).join('  ·  '), item.meanings.join(', ')].filter(Boolean);
  if (item.kind === 'vocab') {
    const reading = item.reading === item.lemma ? [] : [item.reading];
    const romaji = item.romaji && showsRomaji(item.jlpt) ? [item.romaji] : [];
    return [...reading, ...romaji, item.gloss];
  }
  const example = item.examples[0];
  if (!example) return [item.explanation];
  return [example.sentence.replace(/[＿_]+/, example.answer), ...(example.romaji && showsRomaji(item.jlpt) ? [example.romaji] : []), example.gloss, item.explanation];
}

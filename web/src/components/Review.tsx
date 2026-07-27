import { useEffect, useState } from 'react';

import {
  fetchDueReviews,
  gradeReview,
  REVIEW_GRADES,
  type DueCard,
  type GradeResult,
  type ResolvedItem,
  type ReviewGrade,
} from '../api';
import { showsRomaji } from '../romaji';
import { SpeakButton } from './SpeakButton';
import { goBack } from '../useRoute';

/**
 * The review session — the half of the loop the site was missing.
 *
 * The design constraint is that grading twenty cards must not feel like twenty
 * round trips, so the queue is local and the UI never waits: a grade advances
 * the card immediately and the POST catches up behind it.
 *
 * What that costs is a rollback story, which is `requeued` below. This mirrors
 * the Android app's review screen deliberately — same behaviour, same failure
 * handling, because it is the same session on the same data.
 */
export function Review({
  onFinished,
  audioSpeed,
}: {
  onFinished: () => void;
  audioSpeed: number;
}) {
  const [queue, setQueue] = useState<DueCard[] | null>(null);
  const [totalDue, setTotalDue] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  /** Confirmed by the server. A grade whose POST failed is not in here. */
  const [results, setResults] = useState<GradeResult[]>([]);
  /** Cards whose grade failed, appended once for another go. */
  const [requeued, setRequeued] = useState<DueCard[]>([]);
  const [retried, setRetried] = useState<string[]>([]);
  const [lost, setLost] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchDueReviews()
      .then((due) => {
        if (cancelled) return;
        setQueue(due.cards);
        setTotalDue(due.totalDue);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not load your reviews.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="glass panel note note-error" role="alert">
        <strong>Can’t load your reviews.</strong>
        <span>{error}</span>
        <button className="button" type="button" onClick={goBack}>
          Back to the course
        </button>
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="glass panel note" role="status">
        Loading your reviews…
      </div>
    );
  }

  const full = [...queue, ...requeued];
  const card = full[index];
  const sessionOver = full.length > 0 && index >= full.length;

  if (full.length === 0) {
    return (
      <div className="glass panel quiz-summary">
        <h2>Nothing is due yet</h2>
        <p className="summary-note">
          Cards arrive here after you finish a lesson, and come back on their own schedule once
          you have graded them.
        </p>
        <button className="button" type="button" onClick={goBack}>
          Back to the course
        </button>
      </div>
    );
  }

  if (sessionOver) {
    const recalled = results.filter((r) => r.grade !== 'again').length;
    const xp = results.reduce((sum, r) => sum + r.xpAwarded, 0);

    return (
      <div className="glass panel quiz-summary">
        <h2>Session complete</h2>
        <dl className="summary-rows">
          <div>
            <dt>Reviewed</dt>
            <dd className="tabular">{results.length}</dd>
          </div>
          <div>
            <dt>Recalled</dt>
            <dd className="tabular">
              {recalled} of {results.length}
            </dd>
          </div>
          <div>
            <dt>XP earned</dt>
            <dd className="tabular accent">+{xp}</dd>
          </div>
        </dl>
        {lost > 0 ? (
          <p className="form-error">
            {lost} {lost === 1 ? 'grade' : 'grades'} couldn’t be saved. Those cards stay due and
            come back next session.
          </p>
        ) : null}
        <button className="button" type="button" onClick={goBack}>
          Back to the course
        </button>
      </div>
    );
  }

  function submit(grade: ReviewGrade) {
    if (!card || !revealed) return;

    // Decided now, while the queue is still the one being looked at.
    const wasLast = index === full.length - 1;
    const graded = card;

    // Advance first, ask later. Everything below happens while the next card
    // is already on screen.
    setIndex((n) => n + 1);
    setRevealed(false);

    gradeReview(graded.cardId, grade).then(
      (result) => {
        setResults((current) => [...current, result]);
        onFinished();
      },
      () => {
        // Re-queue once, then give up. Re-queueing unconditionally loops
        // forever against an API that is simply down — a normal Tuesday for
        // this project. And never on the last card: by the time the failure
        // lands the summary is already up, and yanking it away to re-ask is
        // worse than telling the truth in the summary.
        if (wasLast || retried.includes(graded.cardId)) {
          setLost((n) => n + 1);
          return;
        }
        setRetried((current) => [...current, graded.cardId]);
        setRequeued((current) => [...current, graded]);
      },
    );
  }

  const failed = requeued.length + lost;

  return (
    <div className="quiz">
      <div className="quiz-head">
        <button className="link-button" type="button" onClick={goBack}>
          ← Leave
        </button>
        <span className="quiz-count tabular">
          {index + 1} / {full.length}
          {totalDue > full.length ? ` of ${totalDue} due` : ''}
        </span>
      </div>

      <div
        className="quiz-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={full.length}
        aria-valuenow={index}
        aria-label="Review progress"
      >
        <span style={{ width: `${(index / full.length) * 100}%` }} />
      </div>

      {failed > 0 ? (
        <p className="form-error">
          {failed} {failed === 1 ? 'grade' : 'grades'} didn’t save.
          {requeued.length > 0 ? ' Those cards are back at the end of this session.' : ''}
        </p>
      ) : null}

      <div className="glass panel quiz-card">
        <CardFront item={card.item} />

        {revealed ? (
          <CardBack item={card.item} audioSpeed={audioSpeed} />
        ) : (
          <button className="button" type="button" onClick={() => setRevealed(true)}>
            Show answer
          </button>
        )}

        {/* Always mounted, disabled until the answer is out — swapping controls
            in would move the targets as the pointer travels toward them. */}
        <div className="grades" aria-label="How well did you know it?">
          {REVIEW_GRADES.map((grade) => (
            <button
              key={grade}
              type="button"
              className={`grade grade-${grade}`}
              onClick={() => submit(grade)}
              disabled={!revealed}
            >
              {grade}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardFront({ item }: { item: ResolvedItem }) {
  switch (item.kind) {
    case 'kana':
      return (
        <p className="quiz-prompt ja quiz-prompt-kana">{item.kana}</p>
      );
    case 'kanji':
      return <p className="quiz-prompt ja quiz-prompt-kana">{item.char}</p>;
    case 'vocab':
      return <p className="quiz-prompt ja quiz-prompt-vocab">{item.lemma}</p>;
    case 'grammar':
      return <p className="quiz-prompt ja quiz-prompt-grammar">{item.title}</p>;
  }
}

/** Reading first, meaning second — the order they are recalled in. */
function CardBack({ item, audioSpeed }: { item: ResolvedItem; audioSpeed: number }) {
  const lines = backLines(item);

  return (
    <div className="card-back">
      {lines.map((line, position) => (
        <p key={position} className={position === 0 ? 'card-back-answer ja' : 'card-back-detail'}>
          {line}
        </p>
      ))}

      {/* Only on the back, and only for vocabulary. Hearing a word before
          recalling it would answer the card — the whole exercise is retrieval,
          and a played recording is a hint delivered before the attempt. */}
      {item.kind === 'vocab' ? (
        <SpeakButton vocabId={item.id} speed={audioSpeed} label="Hear it" />
      ) : null}
    </div>
  );
}

function backLines(item: ResolvedItem): string[] {
  switch (item.kind) {
    case 'kana':
      return [item.romaji];
    case 'kanji':
      return [
        [item.on.join('、'), item.kun.join('、')].filter(Boolean).join('  ·  '),
        item.meanings.join(', '),
      ].filter(Boolean);
    case 'vocab': {
      // A word written in kana *is* its own reading; repeating the front of the
      // card says nothing. Once kanji arrive the two differ and it earns a line.
      const reading = item.reading === item.lemma ? [] : [item.reading];
      const romaji = item.romaji && showsRomaji(item.jlpt) ? [item.romaji] : [];
      return [...reading, ...romaji, item.gloss];
    }
    case 'grammar': {
      const example = item.examples[0];
      if (!example) return [item.explanation];
      return [
        example.sentence.replace('＿', example.answer),
        ...(example.romaji && showsRomaji(item.jlpt) ? [example.romaji] : []),
        example.gloss,
        item.explanation,
      ];
    }
  }
}

import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { fetchDueReviews, type ResolvedItem } from '../../api';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { Icon } from '../ui/Icon';
import { FlashcardTabs } from './FlashcardTabs';

import './flashcards.css';

function itemText(item: ResolvedItem): { front: string; back: string; kind: string } {
  if (item.kind === 'kana') return { front: item.kana, back: item.romaji, kind: item.script };
  if (item.kind === 'vocab') return { front: item.lemma, back: item.gloss, kind: 'vocabulary' };
  if (item.kind === 'kanji') return { front: item.char, back: item.meanings.join(', '), kind: 'kanji' };
  return { front: item.title, back: item.explanation, kind: 'grammar' };
}

function overdueLabel(due: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(due).getTime()) / 60_000));
  if (minutes < 1) return 'Due now';
  if (minutes < 60) return `Due for ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Due for ${hours}h`;
  return `Due for ${Math.floor(hours / 24)}d`;
}

export function ReviewQueue() {
  const { session } = useSession();
  const signedIn = session.state === 'signedIn';
  const due = useQuery({ queryKey: queryKeys.reviews.due, queryFn: fetchDueReviews, enabled: signedIn });

  return <div className="page flashcard-reference"><FlashcardTabs active="queue" /><header className="flashcard-page-header"><div><p className="flashcard-kicker">ACCOUNT-BACKED FSRS / SRS</p><h1>Review Queue</h1><p>The existing Review API is the only scheduling authority. This page inspects cards already due; deck study does not create a second queue.</p></div>{signedIn && due.data && due.data.totalDue > 0 ? <Link className="btn btn-primary" to="/review-session"><Icon name="play" size={15} /> Start real review</Link> : null}</header>{session.state === 'loading' ? <section className="flashcard-loading-page glass" role="status"><Icon name="refresh-cw" size={40} /><p>Checking your account…</p></section> : !signedIn ? <section className="flashcard-empty glass"><Icon name="lock" size={42} /><h2>Sign in to inspect scheduled cards</h2><p>Course and custom deck study remain available without an account, but due dates belong to your account.</p><div><Link className="btn btn-primary" to="/signin">Sign in</Link><Link className="btn btn-secondary" to="/flashcards">Browse decks</Link></div></section> : due.isPending ? <section className="flashcard-loading-page glass" role="status"><Icon name="refresh-cw" size={40} /><p>Loading cards that are due now…</p></section> : due.isError ? <section className="flashcard-empty glass"><Icon name="wifi-off" size={42} /><h2>Review queue unavailable</h2><p>The account API may be asleep. No fallback due cards are invented.</p><button type="button" className="btn btn-secondary" onClick={() => void due.refetch()}>Try again</button></section> : due.data.totalDue === 0 ? <section className="flashcard-empty glass"><Icon name="check-circle-2" size={42} /><h2>Nothing is due now</h2><p>Cards return according to the account scheduler after course learning and earlier reviews.</p><Link className="btn btn-primary" to="/flashcards">Use unscheduled deck study</Link></section> : <><section className="flashcard-queue-summary"><article className="glass"><span>Total due now</span><strong className="tabular">{due.data.totalDue}</strong><small>Authority: Review API</small></article><article className="glass"><span>Loaded batch</span><strong className="tabular">{due.data.cards.length}</strong><small>API cap {due.data.cap}</small></article><article className="glass"><span>New state</span><strong className="tabular">{due.data.cards.filter((card) => card.state === 'new').length}</strong><small>Among loaded cards</small></article><article className="glass"><span>Learning / relearning</span><strong className="tabular">{due.data.cards.filter((card) => card.state === 'learning' || card.state === 'relearning').length}</strong><small>Among loaded cards</small></article></section><div className="flashcard-queue-layout"><main className="flashcard-queue-list glass"><div className="flashcard-section-head"><div><p className="flashcard-kicker">DUE AT OR BEFORE NOW</p><h2>Loaded review batch</h2></div><span>{due.data.cards.length} cards</span></div><ol>{due.data.cards.map((card, index) => { const item = itemText(card.item); return <li key={card.cardId}><span className="flashcard-queue-index tabular">{String(index + 1).padStart(2, '0')}</span><span className="flashcard-kind-badge">{item.kind}</span><span><strong className="ja" lang="ja">{item.front}</strong><small>{item.back}</small></span><span><strong>{card.state}</strong><small>{card.reps} reviews · {card.lapses} lapses</small></span><time dateTime={card.due}>{overdueLabel(card.due)}</time></li>; })}</ol><div className="flashcard-queue-start"><p>{due.data.totalDue > due.data.cards.length ? `${due.data.totalDue - due.data.cards.length} additional due cards are outside this loaded batch.` : 'The loaded batch contains every card currently reported due.'}</p><Link className="btn btn-primary" to="/review-session">Start Review session <Icon name="chevron-right" size={14} /></Link></div></main><aside className="flashcard-queue-rail"><section className="flashcard-rail-card glass"><p className="flashcard-kicker">WHAT CHANGES SCHEDULES</p><h2>Only Review grades</h2><p>Again, Hard, Good, and Easy are sent to the existing grade endpoint. The server returns the new due interval and owns FSRS state.</p></section><section className="flashcard-rail-card glass"><p className="flashcard-kicker">DECK LIMITATION</p><h2>No deck assignment on SRS cards</h2><p>The due-card contract carries a content item but no deck identifier. Per-deck due counts would be invented, so this queue groups nothing by deck.</p></section><section className="flashcard-rail-card glass"><p className="flashcard-kicker">ANALYTICS</p><h2>Retention and forecast</h2><p>Account-level review performance remains in Progress and Flashcard Statistics.</p><Link to="/flashcards-statistics">Open statistics <Icon name="chevron-right" size={13} /></Link></section></aside></div></>}</div>;
}

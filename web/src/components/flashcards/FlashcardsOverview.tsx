import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { Icon } from '../ui/Icon';
import { FlashcardTabs } from './FlashcardTabs';
import { useFlashcardCatalog } from './useFlashcardCatalog';
import './flashcards.css';

export function FlashcardsOverview() {
  const catalog = useFlashcardCatalog();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const visibleCourse = catalog.courseDecks.filter((deck) => !needle || `${deck.title} ${deck.description}`.toLocaleLowerCase().includes(needle));
  const visibleConnected = catalog.connectedDecks.filter((deck) => !needle || `${deck.title} ${deck.description}`.toLocaleLowerCase().includes(needle));
  const courseCards = catalog.courseDecks.reduce((total, deck) => total + deck.cards.length, 0);

  return (
    <div className="page flashcard-reference">
      <section className="flashcard-hero glass">
        <div><p className="flashcard-kicker">SELF-DIRECTED STUDY</p><h1>Flashcards <Icon name="layers" size={42} /></h1><p>Choose course content or a personal deck, reveal each answer, and record local session activity.</p><div className="flashcard-hero-actions"><Link className="btn btn-primary" to="/flashcards-study/$deckId" params={{ deckId: 'course-vocabulary' }}><Icon name="play" size={15} /> Study vocabulary</Link></div></div>
        <span className="flashcard-hero-glyph ja">札</span>
        <dl><div><dt>Course cards</dt><dd>{catalog.corpus.isPending || catalog.corpus.isError ? '—' : courseCards.toLocaleString()}</dd></div><div><dt>Custom decks</dt><dd>{catalog.local.decks.length}</dd></div><div><dt>Local sessions</dt><dd>{catalog.local.sessions.length}</dd></div></dl>
      </section>
      <FlashcardTabs active="decks" />
      <section className="flashcard-toolbar glass"><label><Icon name="search" size={16} /><span className="visually-hidden">Search decks</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search decks…" /></label><div><Link className="btn btn-secondary btn-sm" to="/flashcards-my-decks">My decks</Link><Link className="btn btn-primary btn-sm" to="/flashcards-create">Create deck</Link></div></section>
      {catalog.corpus.isError ? <div className="flashcard-notice is-warning"><p>Course cards are unavailable. Personal decks remain available.</p></div> : null}
      <DeckSection title="Course decks" decks={visibleCourse} loading={catalog.corpus.isPending} />
      <DeckSection title="Connected collections" decks={visibleConnected} />
    </div>
  );
}

function DeckSection({ title, decks, loading = false }: { title: string; decks: ReturnType<typeof useFlashcardCatalog>['decks']; loading?: boolean }) {
  return <section className="flashcard-deck-section glass"><div className="flashcard-section-head"><h2>{title}</h2><span>{loading ? 'Loading…' : `${decks.length} decks`}</span></div>{decks.length === 0 ? <p>No matching deck with available content.</p> : <div className="flashcard-deck-grid">{decks.map((deck) => <article key={deck.id}><div className="flashcard-deck-glyph ja">{deck.glyph}</div><h3>{deck.title}</h3><p>{deck.description}</p><span>{deck.cards.length} cards</span>{deck.cards.length > 0 ? <Link to="/flashcards-study/$deckId" params={{ deckId: deck.id }}>Study deck <Icon name="chevron-right" size={13} /></Link> : null}</article>)}</div>}</section>;
}

import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { useBookmarks } from '../../hooks/useBookmarks';
import { useWritingStore } from '../writing/useWritingStore';
import { Icon } from '../ui/Icon';
import { FlashcardTabs } from './FlashcardTabs';
import { createCustomCard, useFlashcardDecks, type CustomCard } from './useFlashcardDecks';

import './flashcards.css';

function parseTags(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

export function DeckEditor({ deckId }: { deckId?: string }) {
  const navigate = useNavigate();
  const store = useFlashcardDecks();
  const { bookmarks } = useBookmarks();
  const writing = useWritingStore();
  const existing = deckId ? store.decks.find((deck) => deck.id === deckId) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');
  const [cards, setCards] = useState<CustomCard[]>(existing?.cards ?? [createCustomCard()]);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const corrections = writing.records.flatMap((record) => record.feedback.flatMap((feedback) => feedback.corrections.map((correction) => ({ correction, record }))));
  const invalidCards = cards.filter((card) => !card.front.trim() || !card.back.trim()).length;

  if (deckId && !existing) return <div className="page flashcard-reference"><FlashcardTabs active="mine" /><section className="flashcard-empty glass"><Icon name="layers" size={42} /><h1>Custom deck not found</h1><p>This browser does not contain that local deck.</p><Link className="btn btn-primary" to="/flashcards-my-decks">Back to My Decks</Link></section></div>;

  function updateCard(id: string, patch: Partial<CustomCard>) {
    setCards((current) => current.map((card) => card.id === id ? { ...card, ...patch } : card));
    setNotice(null);
  }

  function moveCard(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= cards.length) return;
    setCards((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function importVocabulary() {
    const existingSources = new Set(cards.map((card) => card.sourceItemId).filter(Boolean));
    const imported = bookmarks.filter((bookmark) => !existingSources.has(bookmark.id)).map((bookmark) => createCustomCard({ front: bookmark.lemma, back: bookmark.gloss, reading: bookmark.reading, sourceItemId: bookmark.id, tags: ['saved vocabulary'] }));
    setCards((current) => [...current.filter((card) => card.front || card.back), ...imported]);
    setNotice(imported.length > 0 ? `Imported ${imported.length} saved vocabulary card${imported.length === 1 ? '' : 's'}.` : 'No new saved vocabulary was available to import.');
  }

  function importCorrections() {
    const existingKeys = new Set(cards.map((card) => `${card.front}\n${card.back}`));
    const imported = corrections.filter(({ correction }) => !existingKeys.has(`${correction.span}\n${correction.fix}`)).map(({ correction, record }) => createCustomCard({ front: correction.span, back: correction.fix, detail: correction.note, tags: ['writing correction', record.level] }));
    setCards((current) => [...current.filter((card) => card.front || card.back), ...imported]);
    setNotice(imported.length > 0 ? `Imported ${imported.length} writing correction${imported.length === 1 ? '' : 's'}.` : 'No new writing corrections were available to import.');
  }

  function save() {
    if (!name.trim() || invalidCards > 0 || cards.length === 0) return;
    const input = { name: name.trim(), description: description.trim(), tags: parseTags(tags), cards: cards.map((card) => ({ ...card, front: card.front.trim(), back: card.back.trim(), reading: card.reading?.trim() || undefined, detail: card.detail?.trim() || undefined, example: card.example?.trim() || undefined, tags: card.tags.map((tag) => tag.trim()).filter(Boolean) })) };
    if (existing) {
      store.updateDeck(existing.id, input);
      setNotice('Deck changes saved in this browser.');
    } else {
      const id = store.createDeck(input);
      void navigate({ to: '/flashcards-edit/$deckId', params: { deckId: id } });
    }
  }

  function deleteDeck() {
    if (!existing) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    store.deleteDeck(existing.id);
    void navigate({ to: '/flashcards-my-decks' });
  }

  return <div className="page flashcard-reference"><FlashcardTabs active={existing ? 'mine' : 'create'} /><header className="flashcard-page-header"><div><p className="flashcard-kicker">{existing ? 'EDIT BROWSER-LOCAL CONTENT' : 'BUILD A PERSONAL COLLECTION'}</p><h1>{existing ? `Edit ${existing.name}` : 'Create Deck'}</h1><p>Define Japanese cards manually or import real items already collected from Reading, Dictionary, Vocabulary, and Writing.</p></div>{existing ? <button type="button" className={`flashcard-delete-deck ${deleteArmed ? 'is-armed' : ''}`} onClick={deleteDeck} onBlur={() => setDeleteArmed(false)}><Icon name="trash" size={14} /> {deleteArmed ? 'Press again to delete' : 'Delete deck'}</button> : null}</header><div className="flashcard-editor-layout"><main className="flashcard-editor glass"><section className="flashcard-deck-fields"><div className="flashcard-editor-heading"><div><p className="flashcard-kicker">DECK DETAILS</p><h2>Name and description</h2></div><span>Language · Japanese</span></div><label><span>Deck name</span><input value={name} onChange={(event) => { setName(event.target.value); setNotice(null); }} maxLength={80} placeholder="Words from anime" /></label><label><span>Description</span><textarea value={description} onChange={(event) => { setDescription(event.target.value); setNotice(null); }} maxLength={280} rows={3} placeholder="What belongs in this deck?" /></label><label><span>Deck tags <small>comma-separated</small></span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="anime, verbs, N5" /></label></section><section className="flashcard-card-editor"><div className="flashcard-editor-heading"><div><p className="flashcard-kicker">CARDS</p><h2>Edit card content</h2></div><button type="button" onClick={() => setCards((current) => [...current, createCustomCard()])}><Icon name="pen-square" size={14} /> Add card</button></div><ol>{cards.map((card, index) => <li key={card.id}><div className="flashcard-card-number"><span className="tabular">{index + 1}</span><div><button type="button" onClick={() => moveCard(index, -1)} disabled={index === 0} aria-label="Move card up">↑</button><button type="button" onClick={() => moveCard(index, 1)} disabled={index === cards.length - 1} aria-label="Move card down">↓</button><button type="button" onClick={() => setCards((current) => current.filter((candidate) => candidate.id !== card.id))} aria-label="Remove card"><Icon name="trash" size={13} /></button></div></div><div className="flashcard-card-fields"><label><span>Front</span><textarea className="ja" lang="ja" rows={2} value={card.front} onChange={(event) => updateCard(card.id, { front: event.target.value })} placeholder="食べる" /></label><label><span>Back</span><textarea rows={2} value={card.back} onChange={(event) => updateCard(card.id, { back: event.target.value })} placeholder="to eat" /></label><label><span>Reading <small>optional</small></span><input className="ja" lang="ja" value={card.reading ?? ''} onChange={(event) => updateCard(card.id, { reading: event.target.value })} placeholder="たべる" /></label><label><span>Explanation <small>optional</small></span><input value={card.detail ?? ''} onChange={(event) => updateCard(card.id, { detail: event.target.value })} placeholder="Usage or correction reason" /></label><label className="flashcard-card-tags"><span>Tags <small>comma-separated</small></span><input defaultValue={card.tags.join(', ')} onBlur={(event) => updateCard(card.id, { tags: parseTags(event.target.value) })} placeholder="verb, food" /></label></div></li>)}</ol></section><footer className="flashcard-editor-footer">{notice ? <p role="status"><Icon name="check" size={14} /> {notice}</p> : <span />}{invalidCards > 0 ? <small><Icon name="circle-alert" size={13} /> Complete both sides of {invalidCards} card{invalidCards === 1 ? '' : 's'}.</small> : null}<div><Link className="btn btn-secondary" to="/flashcards-my-decks">Cancel</Link><button type="button" className="btn btn-primary" onClick={save} disabled={!name.trim() || cards.length === 0 || invalidCards > 0}>{existing ? 'Save changes' : 'Create deck'}</button></div></footer></main><aside className="flashcard-editor-rail"><section className="flashcard-rail-card glass"><p className="flashcard-kicker">IMPORT FROM PLATFORM</p><h2>Saved vocabulary</h2><p>{bookmarks.length} word{bookmarks.length === 1 ? '' : 's'} currently saved through the existing vocabulary bookmark system.</p><button type="button" onClick={importVocabulary} disabled={bookmarks.length === 0}>Import vocabulary</button><Link to="/vocab-bookmarks">Open saved words</Link></section><section className="flashcard-rail-card glass"><p className="flashcard-kicker">IMPORT FROM WRITING</p><h2>Returned corrections</h2><p>{corrections.length} exact correction{corrections.length === 1 ? '' : 's'} stored by Writing in this browser.</p><button type="button" onClick={importCorrections} disabled={corrections.length === 0}>Import corrections</button><Link to="/writing-corrections">Open corrections</Link></section></aside></div></div>;
}

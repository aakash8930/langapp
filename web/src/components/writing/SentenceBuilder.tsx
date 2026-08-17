import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { Icon } from '../ui/Icon';
import { WritingTabs } from './WritingTabs';
import { useWritingStore } from './useWritingStore';

import './writing.css';

type Piece = { id: string; text: string };
type BuilderPrompt = {
  id: string;
  level: 'N5' | 'N4';
  gloss: string;
  pieces: string[];
  answer: string[];
  focus: string;
  explanation: string;
  grammarTo?: '/grammar' | '/grammar-exercises';
};

const PROMPTS: BuilderPrompt[] = [
  { id: 'yesterday-movie', level: 'N4', gloss: 'Yesterday, I watched a movie.', pieces: ['私は', '映画を', '昨日、', '見ました。'], answer: ['昨日、', '私は', '映画を', '見ました。'], focus: 'Time · topic · object · verb', explanation: 'A time phrase commonly comes first. は marks the topic, を marks the direct object, and the polite past verb closes the sentence.', grammarTo: '/grammar' },
  { id: 'teacher', level: 'N5', gloss: 'I am a teacher.', pieces: ['です。', '私は', '先生'], answer: ['私は', '先生', 'です。'], focus: 'Topic + noun + です', explanation: 'Japanese places the topic first and the polite copula です at the end.', grammarTo: '/grammar' },
  { id: 'read-book', level: 'N5', gloss: 'I read a book.', pieces: ['読みます。', '本を', '私は'], answer: ['私は', '本を', '読みます。'], focus: 'Topic + object + verb', explanation: 'を marks 本 as the object. Japanese normally places the verb at the end.', grammarTo: '/grammar' },
  { id: 'go-sea', level: 'N5', gloss: 'I go to the sea.', pieces: ['海に', '行きます。', '私は'], answer: ['私は', '海に', '行きます。'], focus: 'Destination particle に', explanation: 'に marks the destination of a movement verb such as 行きます.', grammarTo: '/grammar' },
  { id: 'shop-buy', level: 'N5', gloss: 'I buy it at the shop.', pieces: ['買います。', '店で', '私は'], answer: ['私は', '店で', '買います。'], focus: 'Action location particle で', explanation: 'で marks the place where the action happens. It differs from に, which marks a destination.', grammarTo: '/grammar' },
  { id: 'my-book', level: 'N5', gloss: 'It is my book.', pieces: ['本です。', '私の'], answer: ['私の', '本です。'], focus: 'Possessive particle の', explanation: 'の links two nouns. The first noun describes or possesses the second.', grammarTo: '/grammar' },
  { id: 'sister-too', level: 'N5', gloss: 'My younger sister is also a teacher.', pieces: ['先生です。', '妹も'], answer: ['妹も', '先生です。'], focus: 'Also particle も', explanation: 'も replaces は when the topic is included as “also” or “too.”', grammarTo: '/grammar' },
  { id: 'book-paper', level: 'N5', gloss: 'I buy a book and paper.', pieces: ['買います。', '私は', '本と紙を'], answer: ['私は', '本と紙を', '買います。'], focus: 'Noun linking with と', explanation: 'と joins the two nouns, then を marks the whole noun phrase as the object.', grammarTo: '/grammar' },
];

function shuffledPieces(prompt: BuilderPrompt): Piece[] {
  const pieces = prompt.pieces.map((text, index) => ({ id: `${prompt.id}-${index}`, text }));
  for (let index = pieces.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [pieces[index], pieces[swap]] = [pieces[swap], pieces[index]];
  }
  return pieces;
}

export function SentenceBuilder() {
  const { recordBuilderAttempt, summary } = useWritingStore();
  const [index, setIndex] = useState(0);
  const [available, setAvailable] = useState<Piece[]>(() => shuffledPieces(PROMPTS[0]));
  const [built, setBuilt] = useState<Piece[]>([]);
  const [result, setResult] = useState<'building' | 'correct' | 'wrong'>('building');
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [complete, setComplete] = useState(false);
  const prompt = PROMPTS[index];

  function add(piece: Piece) {
    if (result !== 'building') return;
    setBuilt((current) => [...current, piece]);
    setAvailable((current) => current.filter((candidate) => candidate.id !== piece.id));
  }

  function remove(piece: Piece) {
    if (result !== 'building') return;
    setAvailable((current) => [...current, piece]);
    setBuilt((current) => current.filter((candidate) => candidate.id !== piece.id));
  }

  function check() {
    if (built.length !== prompt.answer.length || result !== 'building') return;
    const isCorrect = built.map((piece) => piece.text).join('') === prompt.answer.join('');
    setResult(isCorrect ? 'correct' : 'wrong');
    setAttempted((value) => value + 1);
    if (isCorrect) setCorrect((value) => value + 1);
    recordBuilderAttempt(prompt.answer.join(''), isCorrect);
  }

  function next() {
    if (index >= PROMPTS.length - 1) {
      setComplete(true);
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setAvailable(shuffledPieces(PROMPTS[nextIndex]));
    setBuilt([]);
    setResult('building');
  }

  function retry() {
    setAvailable(shuffledPieces(prompt));
    setBuilt([]);
    setResult('building');
  }

  function restart() {
    setIndex(0);
    setAvailable(shuffledPieces(PROMPTS[0]));
    setBuilt([]);
    setResult('building');
    setCorrect(0);
    setAttempted(0);
    setComplete(false);
  }

  if (complete) return <div className="page writing-reference"><WritingTabs active="builder" /><section className="writing-builder-summary glass"><Icon name="check-circle-2" size={42} /><p className="writing-kicker">SESSION COMPLETE</p><h1>Sentence Builder</h1><strong className="tabular">{correct} / {attempted}</strong><p>Correct checks in this session. No XP or mastery score is inferred.</p><div><button type="button" className="btn btn-primary" onClick={restart}>Build again</button><Link className="btn btn-secondary" to="/writing">Free writing</Link></div></section></div>;

  return <div className="page writing-reference"><WritingTabs active="builder" /><header className="writing-page-header"><div><p className="writing-kicker">GUIDED WORD ORDER</p><h1>Sentence Builder</h1><p>Arrange authored pieces, check the order, and learn what each particle or ending is doing before moving to free writing.</p></div><span className="writing-header-count"><strong className="tabular">{index + 1}</strong> / {PROMPTS.length}</span></header><div className="writing-builder-layout"><main className="writing-builder-card glass"><div className="writing-builder-progress"><span style={{ width: `${index / PROMPTS.length * 100}%` }} /><i className="visually-hidden">Prompt {index + 1} of {PROMPTS.length}</i></div><div className="writing-builder-prompt"><span className="writing-level-badge">{prompt.level}</span><p>Build the Japanese sentence:</p><h2>{prompt.gloss}</h2></div><section className={`writing-build-zone is-${result}`} aria-label="Your arranged sentence"><p className="writing-kicker">YOUR SENTENCE</p>{built.length === 0 ? <span>Choose pieces below</span> : <div>{built.map((piece) => <button type="button" className="ja" lang="ja" key={piece.id} onClick={() => remove(piece)} disabled={result !== 'building'}>{piece.text}</button>)}</div>}</section><section className="writing-piece-bank" aria-label="Available sentence pieces"><p className="writing-kicker">AVAILABLE PIECES</p><div>{available.map((piece) => <button type="button" className="ja" lang="ja" key={piece.id} onClick={() => add(piece)} disabled={result !== 'building'}>{piece.text}</button>)}</div></section>{result === 'building' ? <button type="button" className="btn btn-primary writing-builder-check" onClick={check} disabled={built.length !== prompt.answer.length}>{built.length === prompt.answer.length ? 'Check word order' : `Choose ${prompt.answer.length - built.length} more`}</button> : <section className={`writing-builder-result is-${result}`} role="status"><Icon name={result === 'correct' ? 'check-circle-2' : 'circle-alert'} size={24} /><div><h2>{result === 'correct' ? 'Correct order' : 'Review the order'}</h2><p className="ja" lang="ja">{prompt.answer.join('')}</p><strong>{prompt.focus}</strong><span>{prompt.explanation}</span></div><div>{result === 'wrong' ? <button type="button" className="btn btn-secondary btn-sm" onClick={retry}><Icon name="refresh-cw" size={14} /> Try again</button> : null}<button type="button" className="btn btn-primary btn-sm" onClick={next}>{index === PROMPTS.length - 1 ? 'See results' : 'Next sentence'} <Icon name="chevron-right" size={14} /></button></div></section>}</main><aside className="writing-builder-rail"><section className="writing-rail-card glass"><p className="writing-kicker">CURRENT PATTERN</p><h2>{prompt.focus}</h2><p>{prompt.explanation}</p>{prompt.grammarTo ? <Link to={prompt.grammarTo}>Study course grammar <Icon name="chevron-right" size={13} /></Link> : null}</section><section className="writing-rail-card glass"><p className="writing-kicker">LOCAL ACTIVITY</p><h2>Builder attempts</h2><dl><div><dt>Stored attempts</dt><dd className="tabular">{summary.builderAttempts}</dd></div><div><dt>Correct checks</dt><dd className="tabular">{summary.builderCorrect}</dd></div><div><dt>This session</dt><dd className="tabular">{correct} / {attempted}</dd></div></dl><p>These counts cover the latest 500 button checks stored in this browser. They are not a persistent mastery score.</p></section><section className="writing-rail-card glass"><p className="writing-kicker">NEXT STEP</p><h2>Use the pattern yourself</h2><p>Move from arranging known pieces to writing your own response with automatic romaji-to-kana input.</p><Link to="/writing">Open Writing Practice <Icon name="chevron-right" size={13} /></Link></section></aside></div></div>;
}

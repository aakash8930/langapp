import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { Icon } from '../ui/Icon';
import {
  completedGrammarSentence,
  shuffleGrammar,
  sortGrammarByLevel,
  splitGrammarTitle,
} from './grammarData';
import { useCorpus, type GrammarItem } from './useCorpus';

import './grammar-library.css';

function scrollToSection(section: string) {
  document.getElementById(section)?.scrollIntoView({
    block: 'start',
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

export function GrammarDetailPage({ id }: { id: string }) {
  const corpus = useCorpus();
  const corpusItems = corpus.data?.items;
  const items = useMemo(
    () => sortGrammarByLevel(corpusItems?.filter((entry): entry is GrammarItem => entry.kind === 'grammar') ?? []),
    [corpusItems],
  );
  const item = items.find((entry) => entry.id === id);

  if (corpus.isPending) return <div className="page grammar-reference"><div className="grammar-loading glass" role="status"><span className="ja">文</span><p>Loading grammar details…</p></div></div>;
  if (corpus.isError) return <DetailProblem title="Grammar details could not be loaded" body="The curriculum API is unavailable. Try again or return to the grammar list." retry={() => void corpus.refetch()} />;
  if (!item) return <DetailProblem title="Grammar topic not found" body="That topic is not part of the currently available course corpus." />;

  const title = splitGrammarTitle(item.title);
  const currentIndex = items.findIndex((entry) => entry.id === item.id);
  const previous = currentIndex > 0 ? items[currentIndex - 1] : undefined;
  const next = currentIndex < items.length - 1 ? items[currentIndex + 1] : undefined;

  return (
    <div className="page grammar-reference">
      <nav className="grammar-detail-crumbs" aria-label="Breadcrumb"><Link to="/grammar">Grammar</Link><Icon name="chevron-right" size={13} /><span aria-current="page">{item.title}</span></nav>

      <section className="grammar-detail-hero glass"><div className="grammar-detail-form ja" lang="ja">{title.form}</div><div className="grammar-detail-intro"><p className="grammar-kicker">GRAMMAR DETAIL · {item.jlpt}</p><h1>{title.label}</h1><p>{item.explanation}</p><dl><div><dt>Worked examples</dt><dd className="tabular">{item.examples.length}</dd></div><div><dt>Usage note</dt><dd>{item.usage ? 'Available' : 'Not stored'}</dd></div><div><dt>Common mistakes</dt><dd className="tabular">{item.commonMistakes.length}</dd></div></dl></div><div className="grammar-detail-actions"><Link className="btn btn-primary" to="/grammar-exercises">Practise grammar <Icon name="pen-square" size={15} /></Link><Link className="btn btn-secondary" to="/grammar-quiz">Start grammar quiz</Link></div></section>

      <nav className="grammar-detail-jumps glass" aria-label="On this grammar page"><button type="button" onClick={() => scrollToSection('grammar-explanation')}>Explanation & usage</button><button type="button" onClick={() => scrollToSection('grammar-examples')}>Examples <span className="tabular">{item.examples.length}</span></button><button type="button" onClick={() => scrollToSection('grammar-mistakes')}>Common mistakes <span className="tabular">{item.commonMistakes.length}</span></button><button type="button" onClick={() => scrollToSection('grammar-exercise')}>Exercise</button></nav>

      {corpus.data.failedUnits.length > 0 ? <p className="note grammar-partial"><strong>Partial corpus.</strong><span>Some course units did not load, so adjacent topics may be incomplete.</span></p> : null}

      <div className="grammar-detail-layout"><main className="grammar-detail-main">
        <section className="grammar-detail-section glass" id="grammar-explanation" aria-labelledby="grammar-explanation-heading"><SectionHeading kicker="HOW THE PATTERN WORKS" title="Explanation and usage" id="grammar-explanation-heading" /><div className="grammar-explanation-panel"><article><span className="grammar-info-icon ja">文</span><div><h3>Explanation</h3><p>{item.explanation}</p></div></article><article><span className="grammar-info-icon ja">用</span><div><h3>Usage</h3>{item.usage ? <p>{item.usage}</p> : <p className="grammar-missing-copy">The course corpus does not include an additional usage note for this topic. The explanation and examples above are the available guidance.</p>}</div></article></div></section>

        <section className="grammar-detail-section glass" id="grammar-examples" aria-labelledby="grammar-examples-heading"><SectionHeading kicker="WORKED COURSE SENTENCES" title="Examples" id="grammar-examples-heading" />{item.examples.length === 0 ? <DataEmpty glyph="例" title="No examples stored" body="The curriculum does not include a worked sentence for this topic. Nothing has been generated to fill the gap." /> : <ol className="grammar-example-list">{item.examples.map((example, index) => <li key={`${item.id}-${index}`}><span className="grammar-example-number tabular">{String(index + 1).padStart(2, '0')}</span><div><p className="grammar-example-label">COMPLETED SENTENCE</p><p className="grammar-example-ja ja" lang="ja">{completedGrammarSentence(example.sentence, example.answer)}</p>{example.romaji ? <p className="grammar-example-romaji">{example.romaji}</p> : null}<p className="grammar-example-gloss">{example.gloss}</p><div className="grammar-example-answer"><span>Pattern inserted</span><strong className="ja">{example.answer}</strong><small className="ja">{example.sentence}</small></div></div></li>)}</ol>}</section>

        <section className="grammar-detail-section glass" id="grammar-mistakes" aria-labelledby="grammar-mistakes-heading"><SectionHeading kicker="AVOID THESE ERRORS" title="Common mistakes" id="grammar-mistakes-heading" />{item.commonMistakes.length === 0 ? <DataEmpty glyph="注" title="No common mistakes documented" body="The curriculum does not currently store a mistake-and-correction pair for this topic." /> : <ol className="grammar-mistake-list">{item.commonMistakes.map((mistake, index) => <li key={`${item.id}-mistake-${index}`}><span className="grammar-mistake-index tabular">{index + 1}</span><div className="grammar-mistake-wrong"><small>AVOID</small><p className="ja">{mistake.mistake}</p></div><Icon name="chevron-right" size={18} /><div className="grammar-mistake-right"><small>USE INSTEAD</small><p className="ja">{mistake.correction}</p></div><p>{mistake.note}</p></li>)}</ol>}</section>

        <section className="grammar-detail-section glass" id="grammar-exercise" aria-labelledby="grammar-exercise-heading"><SectionHeading kicker="TRY THE PATTERN" title="Exercise" id="grammar-exercise-heading" />{item.examples.length === 0 ? <DataEmpty glyph="問" title="No exercise available" body="A real worked example is required to build a fill-in-the-blank exercise for this topic." /> : <GrammarPointExercise key={item.id} item={item} allItems={items} />}</section>

        <nav className="grammar-detail-pager glass" aria-label="Previous and next grammar topics">{previous ? <Link to="/grammar/$id" params={{ id: previous.id }}><Icon name="chevron-left" size={15} /><span><small>Previous in JLPT order</small><strong>{previous.title}</strong></span></Link> : <span />}{next ? <Link to="/grammar/$id" params={{ id: next.id }}><span><small>Next in JLPT order</small><strong>{next.title}</strong></span><Icon name="chevron-right" size={15} /></Link> : <span />}</nav>
      </main>

      <aside className="grammar-detail-rail" aria-label="Grammar facts and study actions"><section className="grammar-rail-card glass"><div className="grammar-rail-head"><div><p className="grammar-kicker">AT A GLANCE</p><h2>Topic facts</h2></div></div><dl className="grammar-fact-list"><div><dt>Pattern</dt><dd className="ja">{title.form}</dd></div><div><dt>JLPT level</dt><dd>{item.jlpt}</dd></div><div><dt>Examples</dt><dd className="tabular">{item.examples.length}</dd></div><div><dt>Usage note</dt><dd>{item.usage ? 'Yes' : 'No'}</dd></div><div><dt>Mistakes</dt><dd className="tabular">{item.commonMistakes.length}</dd></div></dl></section><section className="grammar-rail-card glass"><div className="grammar-rail-head"><div><p className="grammar-kicker">PRACTICE</p><h2>Continue studying</h2></div></div><ul className="grammar-action-list"><li><Link to="/grammar-exercises"><span><Icon name="pen-square" size={17} /></span><span><strong>Grammar exercises</strong><small>Immediate course-backed feedback</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/grammar-quiz"><span><Icon name="sparkles" size={17} /></span><span><strong>Grammar quiz</strong><small>Test mixed topics</small></span><Icon name="chevron-right" size={14} /></Link></li><li><Link to="/practice-hub"><span><Icon name="refresh-cw" size={17} /></span><span><strong>Practice hub</strong><small>Use course-backed exercises</small></span><Icon name="chevron-right" size={14} /></Link></li></ul></section><p className="grammar-source-note"><Icon name="check" size={13} /> Explanations, usage, examples, mistakes, and answers come from the course corpus. Missing teaching content is not generated.</p></aside></div>
    </div>
  );
}

function GrammarPointExercise({ item, allItems }: { item: GrammarItem; allItems: GrammarItem[] }) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const example = item.examples[exampleIndex] ?? item.examples[0];
  const options = useMemo(() => {
    // The round counter deliberately re-runs the shuffle for "Try again".
    void round;
    if (!example) return [];
    const candidates = [...new Set(allItems.flatMap((entry) => entry.examples.map((value) => value.answer)))];
    return shuffleGrammar([example.answer, ...shuffleGrammar(candidates.filter((value) => value !== example.answer)).slice(0, 3)]);
  }, [allItems, example, round]);
  if (!example) return null;
  const correct = selected === example.answer;

  function nextExample() {
    setSelected(null);
    setRound((value) => value + 1);
    setExampleIndex((value) => (value + 1) % item.examples.length);
  }

  return <div className="grammar-point-exercise"><div className="grammar-exercise-prompt"><span className="grammar-level-badge">{item.jlpt}</span><p className="grammar-exercise-instruction">Choose the pattern that completes the sentence.</p><p className="grammar-exercise-sentence ja" lang="ja">{example.sentence.replace(/＿/g, selected ?? '＿＿')}</p><p className="grammar-exercise-gloss">{example.gloss}</p></div><div className="grammar-exercise-options">{options.map((option) => { const showCorrect = selected !== null && option === example.answer; const showWrong = selected === option && option !== example.answer; return <button key={option} type="button" className={showCorrect ? 'is-correct' : showWrong ? 'is-wrong' : ''} onClick={() => setSelected(option)} disabled={selected !== null}><span className="ja">{option}</span>{showCorrect ? <Icon name="check" size={16} /> : null}</button>; })}</div>{selected !== null ? <div className={`grammar-exercise-feedback ${correct ? 'is-correct' : 'is-wrong'}`} role="status"><div><strong>{correct ? 'Correct' : 'Try this correction'}</strong><span className="ja">{completedGrammarSentence(example.sentence, example.answer)}</span>{example.romaji ? <small>{example.romaji}</small> : null}<p>{item.explanation}</p></div><button type="button" className="btn btn-primary btn-sm" onClick={nextExample}>{item.examples.length > 1 ? 'Next example' : 'Try again'} <Icon name="refresh-cw" size={14} /></button></div> : null}</div>;
}

function SectionHeading({ kicker, title, id }: { kicker: string; title: string; id: string }) {
  return <div className="grammar-section-head"><div><p className="grammar-kicker">{kicker}</p><h2 id={id}>{title}</h2></div></div>;
}

function DataEmpty({ glyph, title, body }: { glyph: string; title: string; body: string }) {
  return <div className="grammar-data-empty"><span className="ja">{glyph}</span><div><strong>{title}</strong><p>{body}</p></div></div>;
}

function DetailProblem({ title, body, retry }: { title: string; body: string; retry?: () => void }) {
  return <div className="page grammar-reference"><div className="grammar-empty glass"><span className="ja">探</span><h1>{title}</h1><p>{body}</p><div className="grammar-problem-actions"><Link className="btn btn-primary" to="/grammar">Back to grammar</Link>{retry ? <button type="button" className="btn btn-secondary" onClick={retry}>Try again</button> : null}</div></div></div>;
}

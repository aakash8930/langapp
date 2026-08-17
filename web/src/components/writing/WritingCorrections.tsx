import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { Icon } from '../ui/Icon';
import { WritingTabs } from './WritingTabs';
import { useWritingStore } from './useWritingStore';

import './writing.css';

type CorrectionRow = {
  id: string;
  recordId: string;
  title: string;
  level: string;
  reviewedAt: number;
  span: string;
  fix: string;
  note: string;
  signature: string;
};

export function WritingCorrections() {
  const { records } = useWritingStore();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const rows = useMemo<CorrectionRow[]>(() => records.flatMap((record) => record.feedback.flatMap((feedback) => feedback.corrections.map((correction, index) => ({ id: `${feedback.id}-${index}`, recordId: record.id, title: record.title, level: record.level, reviewedAt: feedback.reviewedAt, span: correction.span, fix: correction.fix, note: correction.note, signature: `${correction.fix}\n${correction.note}`.toLocaleLowerCase() })))).sort((left, right) => right.reviewedAt - left.reviewedAt), [records]);
  const repetitions = useMemo(() => rows.reduce((counts, row) => counts.set(row.signature, (counts.get(row.signature) ?? 0) + 1), new Map<string, number>()), [rows]);
  const needle = query.trim().toLocaleLowerCase();
  const filtered = rows.filter((row) => (level === 'all' || row.level === level) && (!needle || `${row.span} ${row.fix} ${row.note} ${row.title}`.toLocaleLowerCase().includes(needle)));

  return <div className="page writing-reference"><WritingTabs active="corrections" /><header className="writing-page-header"><div><p className="writing-kicker">LEARN FROM REAL FEEDBACK</p><h1>Corrections</h1><p>Every row comes from an AI review returned for writing saved in this browser. Repeated notes are counted, not promoted into an unsupported mastery score.</p></div><span className="writing-header-count"><strong className="tabular">{rows.length}</strong> corrections</span></header>{rows.length === 0 ? <section className="writing-empty glass"><Icon name="check-circle-2" size={42} /><h2>No corrections yet</h2><p>Submit Japanese writing for AI feedback. If the tutor returns exact corrections, they will be collected here.</p><Link className="btn btn-primary" to="/writing-feedback">Open AI feedback</Link></section> : <><section className="writing-correction-toolbar glass"><label><Icon name="search" size={15} /><span className="visually-hidden">Search writing corrections</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search original, correction, or reason…" /></label><label><span>JLPT prompt</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">All prompt levels</option><option value="N5">N5</option><option value="N4">N4</option><option value="N3">N3</option></select></label></section>{filtered.length === 0 ? <section className="writing-empty writing-empty-inline glass"><Icon name="search" size={34} /><h2>No matching correction</h2><p>Try another Japanese phrase, note, or prompt level.</p><button type="button" className="btn btn-secondary" onClick={() => { setQuery(''); setLevel('all'); }}>Clear filters</button></section> : <section className="writing-corrections-grid">{filtered.map((row) => { const repeatCount = repetitions.get(row.signature) ?? 1; return <article className="writing-correction-card glass" key={row.id}><header><span className="writing-level-badge">{row.level}</span><time dateTime={new Date(row.reviewedAt).toISOString()}>{new Date(row.reviewedAt).toLocaleDateString()}</time></header><p className="writing-correction-source">From <strong>{row.title}</strong></p><dl><div><dt>Original</dt><dd className="ja" lang="ja">{row.span}</dd></div><div><dt>Correction</dt><dd className="ja" lang="ja">{row.fix}</dd></div></dl><div className="writing-correction-reason"><Icon name="info" size={15} /><p>{row.note}</p></div>{repeatCount > 1 ? <p className="writing-repeat-note"><Icon name="repeat" size={14} /> This exact correction and note appeared {repeatCount} times.</p> : null}<div><Link to="/writing-feedback/$id" params={{ id: row.recordId }}>Open full feedback <Icon name="chevron-right" size={13} /></Link><Link to="/practice-hub">Open practice</Link></div></article>; })}</section>}<section className="writing-boundary-note glass"><Icon name="shield-check" size={19} /><div><h2>Correction category is not guessed</h2><p>The current API returns original text, corrected text, and a note—but not Grammar, Vocabulary, Particle, or Naturalness as a structured field. The note is shown verbatim instead of assigning a category from keywords.</p></div><Link className="btn btn-secondary btn-sm" to="/grammar">Study grammar</Link></section></>}</div>;
}

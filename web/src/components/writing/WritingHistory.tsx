import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { Icon } from '../ui/Icon';
import { countJapaneseCharacters } from './romajiToKana';
import { WritingTabs } from './WritingTabs';
import { useWritingStore } from './useWritingStore';

import './writing.css';

export function WritingHistory() {
  const store = useWritingStore();
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const filtered = store.records.filter((record) => (type === 'all' || record.kind === type) && (status === 'all' || record.status === status));

  function remove(id: string) {
    if (deleteId !== id) {
      setDeleteId(id);
      return;
    }
    store.removeRecord(id);
    setDeleteId(null);
  }

  return <div className="page writing-reference"><WritingTabs active="history" /><header className="writing-page-header"><div><p className="writing-kicker">LOCAL WRITING RECORDS</p><h1>Writing History</h1><p>Reopen the exact text, prompt, and feedback saved by this browser. Nothing here is presented as account-synced history.</p></div><span className="writing-header-count"><strong className="tabular">{store.records.length}</strong> records</span></header><section className="writing-history-summary"><article className="glass"><span>Writing records</span><strong className="tabular">{store.records.length}</strong><small>{store.summary.drafts} drafts · {store.summary.submitted} submitted</small></article><article className="glass"><span>Reviewed records</span><strong className="tabular">{store.summary.reviewed}</strong><small>{store.summary.corrections} returned corrections</small></article><article className="glass"><span>Sentence Builder</span><strong className="tabular">{store.summary.builderAttempts}</strong><small>{store.summary.builderCorrect} correct attempts</small></article></section>{store.records.length === 0 ? <section className="writing-empty glass"><Icon name="history" size={42} /><h2>No local writing history</h2><p>Save a draft or submit an authored prompt to create your first record.</p><Link className="btn btn-primary" to="/writing">Start writing</Link></section> : <><section className="writing-history-toolbar glass"><div><label><span>Type</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="all">Practice and essays</option><option value="practice">Writing practice</option><option value="essay">Essays</option></select></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Any status</option><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="reviewed">Reviewed</option></select></label></div><span className="tabular">{filtered.length} shown</span></section>{filtered.length === 0 ? <section className="writing-empty writing-empty-inline glass"><Icon name="search" size={34} /><h2>No records match these filters</h2><button type="button" className="btn btn-secondary" onClick={() => { setType('all'); setStatus('all'); }}>Clear filters</button></section> : <div className="writing-history-table-wrap glass"><table className="writing-history-table"><thead><tr><th>Date</th><th>Type</th><th>Topic</th><th>JLPT</th><th>Characters</th><th>Status</th><th>Corrections</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{filtered.map((record) => { const corrections = record.feedback.reduce((total, feedback) => total + feedback.corrections.length, 0); return <tr key={record.id}><td><time dateTime={new Date(record.updatedAt).toISOString()}>{new Date(record.updatedAt).toLocaleDateString()}</time></td><td>{record.kind === 'essay' ? 'Essay' : 'Practice'}</td><td><strong>{record.title}</strong><small className="ja" lang="ja">{record.promptJapanese}</small></td><td><span className="writing-level-badge">{record.level}</span></td><td className="tabular">{countJapaneseCharacters(record.text)}</td><td><span className={`writing-status is-${record.status}`}>{record.status}</span></td><td className="tabular">{corrections}</td><td><div className="writing-history-actions"><Link to="/writing-entry/$id" params={{ id: record.id }} aria-label={`Open ${record.title}`}><Icon name="pen-tool" size={14} /></Link>{record.feedback.length > 0 ? <Link to="/writing-feedback/$id" params={{ id: record.id }} aria-label={`Open feedback for ${record.title}`}><Icon name="bot" size={14} /></Link> : null}<button type="button" className={deleteId === record.id ? 'is-armed' : ''} onClick={() => remove(record.id)} onBlur={() => setDeleteId(null)} aria-label={deleteId === record.id ? `Confirm delete ${record.title}` : `Delete ${record.title}`}><Icon name="trash" size={14} /></button></div></td></tr>; })}</tbody></table></div>}<section className="writing-boundary-note glass"><Icon name="info" size={19} /><div><h2>Why there is no Score column</h2><p>The current tutor contract has no scoring methodology or rubric. History shows characters, status, and correction counts that can be verified instead of displaying an invented percentage. Deleting a row removes this browser’s copy; it does not delete the account-backed tutor session.</p></div><Link className="btn btn-secondary btn-sm" to="/writing-feedback">AI feedback</Link></section></>}</div>;
}

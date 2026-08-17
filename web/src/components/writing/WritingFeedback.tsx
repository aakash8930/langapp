import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { createChatSession, sendChatMessage } from '../../api';
import { useSession } from '../../useSession';
import { Icon } from '../ui/Icon';
import { countJapaneseCharacters } from './romajiToKana';
import { WritingTabs } from './WritingTabs';
import { useWritingStore } from './useWritingStore';

import './writing.css';

export function WritingFeedback({ id }: { id?: string }) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const store = useWritingStore();
  const eligible = store.records.filter((record) => record.status !== 'draft');
  const initial = eligible.find((record) => record.id === id) ?? eligible[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? '');
  const [requestState, setRequestState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const selected = eligible.find((record) => record.id === selectedId) ?? initial;
  const latest = selected?.feedback[0];

  async function requestReview() {
    if (!selected || selected.text.length > 500 || session.state !== 'signedIn') return;
    setRequestState('loading');
    setError('');
    try {
      const reviewSession = await createChatSession('writing-review');
      const result = await sendChatMessage(reviewSession.id, selected.text);
      store.addFeedback(selected.id, { sessionId: reviewSession.id, reply: result.reply.text, corrections: result.corrections });
      void queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      setRequestState('idle');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The writing review could not be completed.');
      setRequestState('error');
    }
  }

  if (id && !eligible.some((record) => record.id === id)) return <div className="page writing-reference"><WritingTabs active="feedback" /><section className="writing-empty glass"><Icon name="bot" size={42} /><h1>Submitted writing not found</h1><p>This browser does not have a submitted local record with that identifier.</p><Link className="btn btn-primary" to="/writing-history">Back to history</Link></section></div>;

  return <div className="page writing-reference"><WritingTabs active="feedback" /><header className="writing-page-header"><div><p className="writing-kicker">TEACHING-FOCUSED REVIEW</p><h1>AI Writing Feedback</h1><p>The existing tutor API returns a short teaching response and exact corrections. It does not assign a made-up score or silently replace your entire answer.</p></div>{selected ? <label className="writing-record-select"><span>Writing to review</span><select value={selected.id} onChange={(event) => { setSelectedId(event.target.value); setRequestState('idle'); setError(''); }}>{eligible.map((record) => <option value={record.id} key={record.id}>{record.level} · {record.title} · {new Date(record.updatedAt).toLocaleDateString()}</option>)}</select></label> : null}</header>{eligible.length === 0 ? <section className="writing-empty glass"><Icon name="bot" size={42} /><h2>No submitted writing yet</h2><p>Save drafts freely, then submit one from Writing Practice or Essay before requesting a review.</p><Link className="btn btn-primary" to="/writing">Start writing</Link></section> : selected ? <div className="writing-feedback-layout"><main><section className="writing-feedback-source glass"><div className="writing-editor-section-head"><div><p className="writing-kicker">YOUR SUBMISSION</p><h2>{selected.title}</h2></div><span className="writing-level-badge">{selected.level}</span></div><p className="ja" lang="ja">{selected.text}</p><div><span>{selected.topic}</span><span>{countJapaneseCharacters(selected.text)} Japanese characters</span><span>{selected.feedback.length} review{selected.feedback.length === 1 ? '' : 's'}</span></div><div className="writing-feedback-source-actions"><Link className="btn btn-secondary btn-sm" to="/writing-entry/$id" params={{ id: selected.id }}>Revise original</Link><button type="button" className="btn btn-primary btn-sm" onClick={() => void requestReview()} disabled={requestState === 'loading' || session.state !== 'signedIn' || selected.text.length > 500}><Icon name="bot" size={14} /> {requestState === 'loading' ? 'Reviewing…' : latest ? 'Request another review' : 'Review writing'}</button></div>{session.state === 'signedOut' ? <p className="writing-action-warning"><Icon name="lock" size={14} /> <Link to="/signin">Sign in</Link> to use the account-backed tutor.</p> : selected.text.length > 500 ? <p className="writing-action-warning"><Icon name="circle-alert" size={14} /> The tutor endpoint accepts at most 500 characters. Revise or review a shorter selection.</p> : null}{requestState === 'error' ? <p className="writing-feedback-error" role="alert"><Icon name="circle-alert" size={15} /> {error} <button type="button" onClick={() => void requestReview()}>Try again</button></p> : null}</section>{latest ? <><section className="writing-ai-summary glass"><div className="writing-ai-mark"><Icon name="bot" size={25} /></div><div><p className="writing-kicker">TUTOR RESPONSE · {new Date(latest.reviewedAt).toLocaleString()}</p><h2>Teaching summary</h2><p>{latest.reply}</p></div></section><section className="writing-correction-list glass"><div className="writing-editor-section-head"><div><p className="writing-kicker">EXACT CHANGES</p><h2>Corrections</h2></div><Link to="/writing-corrections">View all corrections</Link></div>{latest.corrections.length === 0 ? <div className="writing-no-corrections"><Icon name="check-circle-2" size={26} /><div><strong>No clear correction was returned</strong><p>This means the tutor found no explicit error in this response. It is not a perfect score or proof of native-level writing.</p></div></div> : <ol>{latest.corrections.map((correction, index) => <li key={`${latest.id}-${index}`}><span>{index + 1}</span><div><dl><div><dt>Original</dt><dd className="ja" lang="ja">{correction.span}</dd></div><div><dt>Correction</dt><dd className="ja" lang="ja">{correction.fix}</dd></div></dl><p><Icon name="info" size={14} /> {correction.note}</p></div></li>)}</ol>}</section></> : <section className="writing-awaiting-feedback glass"><Icon name="bot" size={38} /><h2>Ready for a real review</h2><p>The tutor will return only data the API actually supplies: a teaching response and zero or more corrections. Structured categories, numeric scores, and rubric bands are not part of the current contract.</p><button type="button" className="btn btn-primary" onClick={() => void requestReview()} disabled={requestState === 'loading' || session.state !== 'signedIn' || selected.text.length > 500}>{requestState === 'loading' ? 'Reviewing writing…' : 'Request AI feedback'}</button></section>}</main><aside className="writing-feedback-rail"><section className="writing-rail-card glass"><p className="writing-kicker">FEEDBACK STRUCTURE</p><h2>What you receive</h2><ul className="writing-check-list"><li><Icon name="check" size={14} /> Exact original span</li><li><Icon name="check" size={14} /> Corrected Japanese</li><li><Icon name="check" size={14} /> Short teaching reason</li><li><Icon name="x" size={14} /> No synthetic percentage</li><li><Icon name="x" size={14} /> No unsupported rubric</li></ul></section><section className="writing-rail-card glass"><p className="writing-kicker">REVIEW CONNECTION</p><h2>Corrections feed practice</h2><p>The existing tutor pipeline searches both sides of each correction for taught vocabulary. Matching course words are kept as feedback; unmatched free text is not turned into course data.</p><Link to="/practice-hub">Open practice <Icon name="chevron-right" size={13} /></Link></section><section className="writing-rail-card glass"><p className="writing-kicker">RELATED STUDY</p><h2>Investigate the change</h2><ul className="writing-connected-links"><li><Link to="/grammar"><Icon name="book-open" size={14} /> Grammar library</Link></li><li><Link to="/dictionary"><Icon name="search" size={14} /> Course dictionary</Link></li><li><Link to="/vocab-bookmarks"><Icon name="book-marked" size={14} /> Saved vocabulary</Link></li><li><Link to="/progress"><Icon name="trending-up" size={14} /> Account progress</Link></li></ul></section></aside></div> : null}</div>;
}

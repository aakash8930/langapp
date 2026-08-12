import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { listChatSessions } from '../../api';
import { useSession } from '../../useSession';
import { Icon } from '../ui/Icon';
import { SpeakingTabs } from './SpeakingTabs';

import './speaking.css';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function SpeakingHistory() {
  const { session } = useSession();
  const signedIn = session.state === 'signedIn';
  const history = useQuery({ queryKey: ['chat-sessions'], queryFn: listChatSessions, enabled: signedIn, staleTime: 30_000 });
  const [query, setQuery] = useState('');
  const conversations = useMemo(() => (history.data ?? []).filter((entry) => entry.scenario === 'first-meeting'), [history.data]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return conversations.filter((entry) => !needle || `${entry.title} ${entry.titleJa} ${entry.scenario}`.toLocaleLowerCase().includes(needle));
  }, [conversations, query]);
  const totalMessages = conversations.reduce((total, entry) => total + entry.messageCount, 0);

  return <div className="page speaking-reference"><SpeakingTabs active="history" /><section className="speaking-practice-hero glass"><div><p className="speaking-kicker">SAVED BY YOUR ACCOUNT</p><h1><Icon name="history" size={40} /> Conversation history</h1><p>Resume real AI conversation sessions and review their persisted messages and corrections. Local microphone recordings never appear here.</p></div><dl><div><dt>Conversations</dt><dd className="tabular">{!signedIn || history.isPending || history.isError ? '—' : conversations.length}</dd></div><div><dt>Stored messages</dt><dd className="tabular">{!signedIn || history.isPending || history.isError ? '—' : totalMessages}</dd></div></dl></section>
    {session.state === 'loading' ? <div className="speaking-loading glass" role="status"><Icon name="history" size={40} /><p>Checking your account…</p></div> : !signedIn ? <section className="speaking-auth-state glass"><span><Icon name="lock" size={38} /></span><p className="speaking-kicker">ACCOUNT REQUIRED</p><h2>Sign in to view conversation history</h2><p>Pronunciation recordings stay local by design. AI conversation text is available here only after signing in.</p><div><Link className="btn btn-primary" to="/signin">Sign in</Link><Link className="btn btn-secondary" to="/speaking-pronunciation">Use pronunciation studio</Link></div></section> : history.isPending ? <div className="speaking-loading glass" role="status"><Icon name="history" size={40} /><p>Loading saved conversations…</p></div> : history.isError ? <div className="note note-error speaking-error" role="alert"><div><strong>Conversation history could not be loaded.</strong><span>The account API may be asleep.</span></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => void history.refetch()}>Try again</button></div> : conversations.length === 0 ? <section className="speaking-empty glass"><span className="ja" lang="ja">話</span><h2>No conversations yet</h2><p>Start the available first-meeting scenario and its transcript will appear here.</p><Link className="btn btn-primary" to="/speaking-conversation" search={{ session: undefined }}>Start AI conversation</Link></section> : <section className="speaking-history-library glass" aria-labelledby="history-list-heading"><div className="speaking-section-head"><div><p className="speaking-kicker">MOST RECENT FIRST</p><h2 id="history-list-heading">Saved conversations</h2></div><span className="tabular">{filtered.length} matching</span></div><div className="speaking-search speaking-history-search" role="search"><Icon name="search" size={17} /><label className="visually-hidden" htmlFor="speaking-history-search">Search conversation history</label><input id="speaking-history-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or scenario…" />{query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear history search">×</button> : null}</div>{filtered.length === 0 ? <div className="speaking-empty speaking-empty-inline"><span className="ja" lang="ja">探</span><h3>No matching conversations</h3><p>Try another search.</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuery('')}>Clear search</button></div> : <ul>{filtered.map((entry, index) => <li key={entry.id}><Link to="/speaking-conversation" search={{ session: entry.id }}><span className="speaking-history-index tabular">{String(index + 1).padStart(2, '0')}</span><span className="speaking-conversation-icon"><Icon name="message-circle" size={18} /></span><span><strong>{entry.title}</strong><small className="ja" lang="ja">{entry.titleJa}</small></span><span><strong className="tabular">{entry.messageCount}</strong><small>stored messages</small></span><span><time dateTime={entry.lastActivityAt ?? entry.startedAt}>{formatDate(entry.lastActivityAt ?? entry.startedAt)}</time><small>Started {formatDate(entry.startedAt)}</small></span><span className="speaking-history-resume">Resume <Icon name="chevron-right" size={14} /></span></Link></li>)}</ul>}<p className="speaking-route-note"><Icon name="mic" size={14} /> This API stores submitted text and AI corrections. Browser transcripts you do not send and local recording clips are not persisted.</p></section>}
  </div>;
}

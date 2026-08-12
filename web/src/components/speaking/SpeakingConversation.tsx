import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import {
  createChatSession,
  getChatSession,
  sendChatMessage,
  type ChatMessageResponse,
  type ChatSessionResponse,
} from '../../api';
import { useSession } from '../../useSession';
import { Icon } from '../ui/Icon';
import { BrowserVoiceButton } from './BrowserVoiceButton';
import { SpeakingTabs } from './SpeakingTabs';
import { useSpeechRecognition } from './useSpeechRecognition';

import './speaking.css';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function SpeakingConversation({ initialSessionId }: { initialSessionId?: string }) {
  const { session: account } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signedIn = account.state === 'signedIn';
  const [active, setActive] = useState<ChatSessionResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const speed = account.state === 'signedIn' ? account.user.settings.audioSpeed : 1;
  const speech = useSpeechRecognition((transcript) => setInput(transcript));

  const resumeQuery = useQuery({
    queryKey: ['chat-session', initialSessionId],
    queryFn: () => getChatSession(initialSessionId as string),
    enabled: signedIn && Boolean(initialSessionId),
  });

  useEffect(() => {
    if (!resumeQuery.data) return;
    setActive(resumeQuery.data);
    setMessages(resumeQuery.data.messages);
  }, [resumeQuery.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: 'end',
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [messages]);

  const startMutation = useMutation({
    mutationFn: () => createChatSession(),
    onSuccess: (data) => {
      setActive(data);
      setMessages(data.messages);
      setInput('');
      setNotice(null);
      void navigate({ to: '/speaking-conversation', search: { session: data.id }, replace: true });
      void queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: (error) => setNotice(errorMessage(error, 'The AI conversation could not be started.')),
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => {
      if (!active) throw new Error('Start a conversation before sending a message.');
      return sendChatMessage(active.id, text);
    },
    onMutate: (text) => {
      const tempId = `temp-${Date.now()}`;
      setMessages((current) => [...current, {
        id: tempId,
        role: 'user',
        text,
        corrections: [],
        createdAt: new Date().toISOString(),
      }]);
      setNotice(null);
      return { tempId };
    },
    onSuccess: (data, text, context) => {
      setMessages((current) => current.map((message) => message.id === context.tempId
        ? { ...message, text, corrections: data.corrections }
        : message).concat(data.reply));
      void queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: (error, text, context) => {
      setMessages((current) => current.filter((message) => message.id !== context?.tempId));
      setInput((current) => current || text);
      setNotice(errorMessage(error, 'The message was not sent. Try again when the AI service is available.'));
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || text.length > 500 || sendMutation.isPending || startMutation.isPending) return;
    setInput('');
    speech.clear();
    sendMutation.mutate(text);
  }

  if (account.state === 'loading') {
    return <div className="page speaking-reference"><SpeakingTabs active="conversation" /><div className="speaking-loading glass" role="status"><Icon name="message-circle" size={40} /><p>Checking your conversation access…</p></div></div>;
  }

  if (!signedIn) {
    return <div className="page speaking-reference"><SpeakingTabs active="conversation" /><section className="speaking-auth-state glass"><span><Icon name="lock" size={38} /></span><p className="speaking-kicker">ACCOUNT REQUIRED</p><h1>Sign in for AI conversation</h1><p>Conversation messages and corrections are stored in your account history. Pronunciation recording remains available without signing in.</p><div><Link className="btn btn-primary" to="/signin">Sign in</Link><Link className="btn btn-secondary" to="/speaking-pronunciation">Use pronunciation studio</Link></div></section></div>;
  }

  if (initialSessionId && resumeQuery.isPending && !active) {
    return <div className="page speaking-reference"><SpeakingTabs active="conversation" /><div className="speaking-loading glass" role="status"><Icon name="message-circle" size={40} /><p>Loading conversation…</p></div></div>;
  }

  if (initialSessionId && resumeQuery.isError && !active) {
    return <div className="page speaking-reference"><SpeakingTabs active="conversation" /><section className="speaking-empty glass"><Icon name="message-circle" size={40} /><h1>Conversation could not be loaded</h1><p>{errorMessage(resumeQuery.error, 'The account API may be asleep or this session is unavailable.')}</p><div className="speaking-problem-actions"><button type="button" className="btn btn-primary" onClick={() => void resumeQuery.refetch()}>Try again</button><Link className="btn btn-secondary" to="/speaking-history">Back to history</Link></div></section></div>;
  }

  return <div className="page speaking-reference"><SpeakingTabs active="conversation" />{active ? <section className="speaking-conversation glass" aria-labelledby="conversation-title"><header><button type="button" className="speaking-back-button" onClick={() => { speech.stop(); setActive(null); setMessages([]); setNotice(null); void navigate({ to: '/speaking-conversation', search: { session: undefined }, replace: true }); }}><Icon name="chevron-left" size={15} /> Scenario</button><div><p className="speaking-kicker">LIVE AI CONVERSATION</p><h1 id="conversation-title">{active.title}</h1><span className="ja" lang="ja">{active.titleJa}</span></div><div className="speaking-conversation-header-actions"><Link className="btn btn-secondary btn-sm" to="/speaking-history"><Icon name="history" size={15} /> History</Link><button type="button" className="btn btn-secondary btn-sm" onClick={() => { speech.stop(); startMutation.mutate(); }} disabled={startMutation.isPending}><Icon name="refresh-cw" size={15} /> New conversation</button></div></header><div className="speaking-conversation-note"><Icon name="message-circle" size={16} /><p>You are meeting Yuki at a Tokyo language exchange. Voice input is transcribed for you to review; only the text you send is stored.</p></div><div className="speaking-message-list" aria-live="polite">{messages.map((message) => <article key={message.id} className={message.role === 'user' ? 'is-user' : 'is-assistant'}><div className="speaking-message-meta"><span>{message.role === 'user' ? 'You' : 'Yuki · AI tutor'}</span>{message.role === 'assistant' ? <BrowserVoiceButton text={message.text} speed={speed} /> : null}</div><p>{message.text}</p>{message.corrections.length > 0 ? <div className="speaking-corrections"><strong><Icon name="sparkles" size={14} /> Suggested corrections</strong>{message.corrections.map((correction, index) => <div key={`${message.id}-${index}`}><p><del>{correction.span}</del><span aria-hidden="true">→</span><ins>{correction.fix}</ins></p><small>{correction.note}</small></div>)}</div> : null}</article>)}{sendMutation.isPending ? <div className="speaking-ai-typing" role="status"><span /><span /><span /> Yuki is replying…</div> : null}<div ref={bottomRef} /></div><form className="speaking-conversation-composer" onSubmit={submit}><label htmlFor="speaking-message">Your reply</label><div><textarea id="speaking-message" value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} rows={2} placeholder="Speak or type in hiragana, romaji, or English…" disabled={sendMutation.isPending || startMutation.isPending} /><button type="submit" className="btn btn-primary" disabled={!input.trim() || sendMutation.isPending || startMutation.isPending}><Icon name="send" size={16} /> Send</button></div><div className="speaking-composer-tools">{speech.supported ? <button type="button" className={speech.listening ? 'is-listening' : ''} onClick={speech.listening ? speech.stop : speech.start} disabled={sendMutation.isPending || startMutation.isPending}><Icon name={speech.listening ? 'square' : 'mic'} size={15} /> {speech.listening ? 'Stop listening' : 'Speak reply'}</button> : <span>Voice transcription is unavailable in this browser.</span>}<span className="tabular">{input.length} / 500</span></div>{speech.transcript ? <p className="speaking-draft-transcript" role="status">Browser transcript: <span className="ja" lang="ja">{speech.transcript}</span></p> : null}{speech.error ? <p className="speaking-control-error" role="alert">{speech.error}</p> : null}{notice ? <p className="speaking-control-error" role="alert">{notice}</p> : null}</form></section> : <section className="speaking-conversation-setup glass" aria-labelledby="ai-speaking-heading"><div className="speaking-conversation-setup-copy"><p className="speaking-kicker">SPEAK · REVIEW · SEND · LISTEN</p><h1 id="ai-speaking-heading">AI conversation</h1><p>Practise the real first-meeting scenario already supported by the API. Speak a reply, review the browser transcript, send it to the tutor, and hear the Japanese part of the response.</p><ul><li><Icon name="mic" size={16} /> Optional Japanese voice input</li><li><Icon name="sparkles" size={16} /> Real API grammar and vocabulary corrections</li><li><Icon name="volume-2" size={16} /> Browser voice for Japanese replies</li><li><Icon name="history" size={16} /> Account-backed conversation history</li></ul></div><div className="speaking-scenario-card"><span className="ja" lang="ja">初</span><p className="speaking-kicker">AVAILABLE API SCENARIO</p><h2>First meeting</h2><strong className="ja" lang="ja">はじめまして</strong><p>Meet Yuki at a Tokyo language exchange. Introduce your name, where you are from, and something you like.</p><button type="button" className="btn btn-primary" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>{startMutation.isPending ? 'Starting conversation…' : 'Start first meeting'} <Icon name="chevron-right" size={15} /></button>{notice ? <p className="speaking-control-error" role="alert">{notice}</p> : null}</div><p className="speaking-ai-disclaimer"><Icon name="bot" size={15} /> AI replies can be inaccurate. Corrections are learning guidance, not authoritative pronunciation analysis.</p></section>}</div>;
}

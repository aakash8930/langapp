import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import {
  createChatSession,
  sendChatMessage,
  listChatSessions,
  getChatSession,
  type ChatMessageResponse,
  type ChatSessionResponse,
  type ChatSessionListItem,
} from '../api';
import '../components/Social.css';

export const Route = createFileRoute('/practice')({
  component: Practice,
});

function Practice() {
  const [session, setSession] = useState<ChatSessionResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [input, setInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const sessionsQuery = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: listChatSessions,
    staleTime: 30_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startMutation = useMutation({
    mutationFn: () => createChatSession(),
    onSuccess: (data) => {
      setSession(data);
      setMessages(data.messages);
      setStarting(false);
      setShowHistory(false);
    },
    onError: () => setStarting(false),
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => {
      if (!session) throw new Error('No session');
      return sendChatMessage(session.id, text);
    },
    onSuccess: (data, variables) => {
      const userMsg: ChatMessageResponse = {
        id: Date.now().toString(),
        role: 'user',
        text: variables,
        corrections: data.corrections,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.id.startsWith('temp-'));
        return [...filtered, userMsg, data.reply];
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMutation.isPending) return;
    const tempUserMsg: ChatMessageResponse = {
      id: 'temp-' + Date.now(),
      role: 'user',
      text: input.trim(),
      corrections: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    sendMutation.mutate(input.trim());
    setInput('');
  };

  const resumeSession = async (s: ChatSessionListItem) => {
    try {
      const full = await getChatSession(s.id);
      setSession(full);
      setMessages(full.messages);
      setShowHistory(false);
    } catch {
      // Session was deleted — ignore
    }
  };

  if (!session) {
    return (
      <div className="glass panel" style={{ maxWidth: '600px', margin: '80px auto', padding: 'var(--s-3xl)', textAlign: 'center' }}>
        <h1 style={{ marginBottom: 'var(--s-lg)', color: 'var(--brand-primary)', fontSize: 'var(--text-display)' }}>AI Practice 🗣️</h1>
        <p style={{ marginBottom: 'var(--s-3xl)', color: 'var(--ink-soft)', fontSize: 'var(--text-large)' }}>
          Chat with a friendly AI shopkeeper to practice your Japanese. They will gently correct your mistakes!
        </p>

        <button
          className="btn btn-primary"
          disabled={starting}
          onClick={() => { setStarting(true); startMutation.mutate(); }}
          style={{ width: '100%', maxWidth: '300px' }}
        >
          {starting ? 'Connecting...' : 'Start New Chat'}
        </button>

        {sessionsQuery.data && sessionsQuery.data.length > 0 && (
          <div style={{ marginTop: 'var(--s-xl)' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowHistory(!showHistory)}
              style={{ width: '100%', maxWidth: '300px' }}
            >
              {showHistory ? 'Hide' : 'Show'} Past Sessions ({sessionsQuery.data.length})
            </button>

            {showHistory && (
              <div style={{ marginTop: 'var(--s-md)', textAlign: 'left' }}>
                {sessionsQuery.data.map((s) => (
                  <div
                    key={s.id}
                    className="glass panel"
                    onClick={() => resumeSession(s)}
                    style={{
                      padding: 'var(--s-md) var(--s-lg)',
                      marginBottom: 'var(--s-sm)',
                      cursor: 'pointer',
                      transition: 'transform var(--t-fast) ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong>{s.title}</strong>
                      <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)' }}>
                        {s.messageCount} msgs · {new Date(s.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="dm-header" style={{ marginTop: 'var(--s-xl)' }}>
        <button className="btn-back" onClick={() => { setSession(null); setMessages([]); }}>
          ← Back
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--text-title)', color: 'var(--ink)' }}>{session.title}</h2>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--brand-primary)' }}>{session.titleJa}</div>
        </div>
      </header>

      <div className="dm-messages" style={{ flex: 1, height: 'auto', padding: '0 var(--s-lg)' }}>
        {messages.map((msg) => {
          const isMe = msg.role === 'user';
          return (
            <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <div className={`chat-bubble ${isMe ? 'mine' : 'theirs'}`}>{msg.text}</div>
              {msg.corrections && msg.corrections.length > 0 && (
                <div style={{ marginTop: '8px', padding: '12px', background: 'var(--surface)', borderRadius: '12px', fontSize: '14px', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                  {msg.corrections.map((c, i) => (
                    <div key={i} style={{ marginBottom: i < msg.corrections.length - 1 ? '8px' : 0 }}>
                      <span style={{ textDecoration: 'line-through', marginRight: '6px', opacity: 0.8 }}>{c.span}</span>
                      <strong style={{ color: 'var(--brand-success)', marginRight: '6px' }}>{c.fix}</strong>
                      <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--ink-soft)' }}>💡 {c.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {sendMutation.isPending && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--ink-soft)', padding: '8px', fontSize: '14px', fontStyle: 'italic' }}>Shopkeeper is typing...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="dm-input-area" style={{ padding: 'var(--s-xl)', background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))', borderTop: '1px solid var(--glass-border)' }}>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Reply in romaji or hiragana..." disabled={sendMutation.isPending} />
        <button type="submit" disabled={!input.trim() || sendMutation.isPending}>Send</button>
      </form>
    </div>
  );
}

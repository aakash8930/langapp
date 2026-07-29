import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMessages, sendMessage, type PublicProfile } from '../api';
import './Social.css';

export function DirectMessages({ friend, onBack }: { friend: PublicProfile, onBack: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', friend.id],
    queryFn: () => fetchMessages(friend.id),
    refetchInterval: 5000, // Poll every 5s for new messages
  });

  const sendMutation = useMutation({
    mutationFn: (msg: string) => sendMessage(friend.id, msg),
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['messages', friend.id] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !sendMutation.isPending) {
      sendMutation.mutate(text);
    }
  };

  return (
    <div className="dm-container">
      <div className="dm-header">
        <button className="btn-back" onClick={onBack}>&larr; Back</button>
        <h3>{friend.displayName}</h3>
      </div>
      
      <div className="dm-messages">
        {isLoading && <p className="loading-msg">Loading messages...</p>}
        {messages.length === 0 && !isLoading && (
          <p className="empty-msg">Send a message to start the conversation!</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`chat-bubble ${msg.mine ? 'mine' : 'theirs'}`}>
            <div className="bubble-text">{msg.text}</div>
            <div className="bubble-time">
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="dm-input-area" onSubmit={handleSend}>
        <input 
          type="text" 
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message..." 
          disabled={sendMutation.isPending}
        />
        <button type="submit" disabled={!text.trim() || sendMutation.isPending}>
          Send
        </button>
      </form>
    </div>
  );
}

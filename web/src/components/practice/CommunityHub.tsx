import { Link } from '@tanstack/react-router';
import { useSession } from '../../useSession';
import { useQuery } from '@tanstack/react-query';
import { fetchFriends, searchUsers, sendFriendRequest, type PublicProfile } from '../../api';
import { useState } from 'react';

export function CommunityPage() {
  const { session } = useSession();
  const signedIn = session.state === 'signedIn';
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicProfile[] | null>(null);
  const [searching, setSearching] = useState(false);

  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: fetchFriends,
    enabled: signedIn,
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchUsers(searchQuery.trim());
      setSearchResults(results);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  if (!signedIn) {
    return (
      <div className="page">
        <header className="page-head"><h1 className="page-title">Community</h1></header>
        <div className="glass panel quiz-summary">
          <h2>Sign in to connect</h2>
          <p className="summary-note">Meet other learners, send messages, and study together.</p>
          <Link className="btn btn-primary" to="/" style={{ marginTop: 'var(--s-md)' }}>Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Community</h1>
        <p className="page-sub">Connect with other learners studying Japanese.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--s-lg)', marginBottom: 'var(--s-xl)' }}>
        <Link className="glass panel" to="/social" style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>👥</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)' }}>Social</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Friends, messages, and social features</span>
        </Link>

        <Link className="glass panel" to="/leagues" style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>🏆</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)' }}>Leaderboard</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Weekly XP rankings and league tiers</span>
        </Link>

        <Link className="glass panel" to="/challenges" style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>🎯</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)' }}>Daily Challenges</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Complete challenges to earn bonus XP</span>
        </Link>
      </div>

      {friends.data && (
        <div className="glass panel" style={{ padding: 'var(--s-lg)', marginBottom: 'var(--s-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-md)' }}>
            <h2 style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Friends ({friends.data.length})</h2>
            <Link className="btn btn-sm btn-secondary" to="/social">Manage friends</Link>
          </div>
          {friends.data.length === 0 ? (
            <p className="card-note">No friends yet. Search for users to add them.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-sm)' }}>
              {friends.data.slice(0, 8).map((f) => (
                <Link key={f.id} to="/social" className="vocab-tag vocab-tag-related" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--s-sm)', padding: 'var(--s-sm) var(--s-md)' }}>
                  <span style={{ fontWeight: 600 }}>{f.displayName}</span>
                  <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>Lv.{f.level}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="glass panel" style={{ padding: 'var(--s-lg)' }}>
        <h2 style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 var(--s-md)' }}>Find learners</h2>
        <div style={{ display: 'flex', gap: 'var(--s-sm)', marginBottom: 'var(--s-md)' }}>
          <input
            className="library-search-input"
            placeholder="Search by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, padding: 'var(--s-sm)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}
          />
          <button className="btn btn-sm btn-primary" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>Search</button>
        </div>

        {searchResults !== null && searchResults.length === 0 && (
          <p className="card-note">No users found.</p>
        )}
        {searchResults && searchResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-sm)' }}>
            {searchResults.map((u) => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--s-sm) var(--s-md)', borderBottom: '1px solid var(--hairline)' }}>
                <div>
                  <strong>{u.displayName}</strong>
                  <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', marginLeft: 'var(--s-sm)' }}>Lv.{u.level} · {u.streakDays} day streak</span>
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => { sendFriendRequest(u.id).catch(() => {}); }}>
                  Add friend
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

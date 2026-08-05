import { useQuery } from '@tanstack/react-query';
import { fetchLeaderboard } from '../api';
import { queryKeys } from '../queryKeys';
import './Leaderboard.css';

export function Leaderboard() {
  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: queryKeys.social.leaderboard,
    queryFn: fetchLeaderboard,
  });

  if (isLoading) {
    return <div className="leaderboard-loading">Loading Leagues...</div>;
  }

  if (error || !leaderboard) {
    return <div className="leaderboard-error">Failed to load leaderboard.</div>;
  }

  if (!leaderboard.optedIn) {
    return (
      <div className="leaderboard-opt-in glass panel">
        <h2>Join the Leagues!</h2>
        <p>Compete with other learners, earn XP, and rank up each week.</p>
        <button className="btn btn-primary" onClick={() => alert('Opt-in logic would go here!')}>Join Now</button>
      </div>
    );
  }

  const { tierName, tier, tierCount, rows, promotionCount, endsAt } = leaderboard;
  
  // Calculate time remaining (basic formatting)
  const endsDate = new Date(endsAt);
  const now = new Date();
  const diffHours = Math.max(0, Math.floor((endsDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
  const diffDays = Math.floor(diffHours / 24);
  const remainingText = diffDays > 0 ? `${diffDays} days remaining` : `${diffHours} hours remaining`;

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <div className="tier-badge">{tierName} League</div>
        <div className="tier-progress">Tier {tier + 1} of {tierCount}</div>
        <div className="time-remaining">{remainingText}</div>
      </div>

      <div className="leaderboard-list">
        {rows.length === 0 ? (
          <div className="empty-tier">You are the first one here this week!</div>
        ) : (
          rows.map((row, index) => {
            const isPromotion = promotionCount > 0 && index < promotionCount;
            
            return (
              <div 
                key={row.userId} 
                className={`leaderboard-row ${row.isYou ? 'is-you' : ''} ${isPromotion ? 'promotion-zone' : ''}`}
              >
                <div className="row-rank">{row.rank}</div>
                <div className="row-avatar">{row.displayName.charAt(0).toUpperCase()}</div>
                <div className="row-name">{row.displayName}</div>
                <div className="row-xp">{row.weeklyXp} XP</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { Leaderboard } from '../components/Leaderboard';

export const Route = createFileRoute('/leagues')({
  component: LeaguesComponent,
});

function LeaguesComponent() {
  return (
    <div className="leagues-page" style={{ padding: '24px' }}>
      <Leaderboard />
    </div>
  );
}

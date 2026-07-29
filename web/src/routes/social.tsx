import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { FriendsList } from '../components/FriendsList';
import { DirectMessages } from '../components/DirectMessages';
import type { PublicProfile } from '../api';

export const Route = createFileRoute('/social')({
  component: SocialComponent,
});

function SocialComponent() {
  const [activeFriend, setActiveFriend] = useState<PublicProfile | null>(null);

  return (
    <div className="social-page">
      {activeFriend ? (
        <DirectMessages 
          friend={activeFriend} 
          onBack={() => setActiveFriend(null)} 
        />
      ) : (
        <FriendsList onSelectFriend={setActiveFriend} />
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFriends, fetchFriendRequests, searchUsers, sendFriendRequest, acceptRequest, declineRequest, removeFriend, type PublicProfile } from '../api';
import './Social.css';

export function FriendsList({ onSelectFriend }: { onSelectFriend: (friend: PublicProfile) => void }) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ['friends'],
    queryFn: fetchFriends,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['friendRequests'],
    queryFn: fetchFriendRequests,
  });
  
  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['searchUsers', searchQuery],
    queryFn: () => searchUsers(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const acceptMutation = useMutation({
    mutationFn: acceptRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: declineRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friendRequests'] }),
  });

  const removeMutation = useMutation({
    mutationFn: removeFriend,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
  });

  const sendRequestMutation = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => alert('Friend request sent!'),
  });

  return (
    <div className="friends-list-container">
      <div className="social-section">
        <h3>Find Friends</h3>
        <input 
          className="search-input" 
          placeholder="Search by name (min 2 chars)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery.length >= 2 && (
          <div className="search-results">
            {isSearching ? <p>Searching...</p> : searchResults.length === 0 ? <p>No users found.</p> : null}
            {searchResults.map(user => (
              <div key={user.id} className="user-row">
                <div className="user-info">
                  <strong>{user.displayName}</strong>
                  <span>Lvl {user.level} | {user.xp} XP</span>
                </div>
                <button 
                  onClick={() => sendRequestMutation.mutate(user.id)}
                  disabled={sendRequestMutation.isPending}
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {requests.length > 0 && (
        <div className="social-section">
          <h3>Pending Requests</h3>
          <div className="request-list">
            {requests.map(req => (
              <div key={req.requestId} className="user-row">
                <div className="user-info">
                  <strong>{req.from.displayName}</strong>
                </div>
                <div className="action-buttons">
                  <button className="btn-accept" onClick={() => acceptMutation.mutate(req.requestId)}>Accept</button>
                  <button className="btn-decline" onClick={() => declineMutation.mutate(req.requestId)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="social-section">
        <h3>Your Friends</h3>
        {loadingFriends ? <p>Loading friends...</p> : friends.length === 0 ? <p>You haven't added any friends yet.</p> : null}
        <div className="friend-list">
          {friends.map(friend => (
            <div key={friend.id} className="user-row">
              <div className="user-info">
                <strong>{friend.displayName}</strong>
                <span className="streak-fire">🔥 {friend.streakDays}</span>
              </div>
              <div className="action-buttons">
                <button onClick={() => onSelectFriend(friend)}>Message</button>
                <button className="btn-remove" onClick={() => {
                  if (confirm(`Unfriend ${friend.displayName}?`)) {
                    removeMutation.mutate(friend.id);
                  }
                }}>Unfriend</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

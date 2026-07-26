import { api } from '@/api/client';

/**
 * The friends layer. Mirrors `api/src/social/` — see the Social section of the
 * root CLAUDE.md for the rules the server enforces, because several of them are
 * only visible here as errors the UI has to explain.
 */

/** Everything one learner may see of another. Deliberately short. */
export type PublicProfile = {
  id: string;
  displayName: string;
  level: number;
  xp: number;
  streakDays: number;
};

export type FriendRequest = {
  requestId: string;
  from: PublicProfile;
};

export type DirectMessage = {
  id: string;
  text: string;
  /** True when the signed-in learner wrote it. */
  mine: boolean;
  createdAt: string;
};

export function searchUsers(query: string): Promise<PublicProfile[]> {
  return api.get<PublicProfile[]>(`/social/users?q=${encodeURIComponent(query)}`);
}

export function fetchFriends(): Promise<PublicProfile[]> {
  return api.get<PublicProfile[]>('/social/friends');
}

export function fetchRequests(): Promise<FriendRequest[]> {
  return api.get<FriendRequest[]>('/social/friends/requests');
}

/**
 * Returns `accepted` rather than `pending` when the other person had already
 * requested you — the server treats that as an accept instead of leaving two
 * people staring at each other's pending requests.
 */
export function sendFriendRequest(userId: string): Promise<{ status: string }> {
  return api.post<{ status: string }>(`/social/friends/requests/${encodeURIComponent(userId)}`);
}

export function acceptRequest(requestId: string): Promise<{ status: string }> {
  return api.post<{ status: string }>(
    `/social/friends/requests/${encodeURIComponent(requestId)}/accept`,
  );
}

export function declineRequest(requestId: string): Promise<{ status: string }> {
  return api.post<{ status: string }>(
    `/social/friends/requests/${encodeURIComponent(requestId)}/decline`,
  );
}

export function removeFriend(userId: string): Promise<{ removed: boolean }> {
  return api.delete<{ removed: boolean }>(`/social/friends/${encodeURIComponent(userId)}`);
}

export function fetchMessages(userId: string): Promise<DirectMessage[]> {
  return api.get<DirectMessage[]>(`/social/messages/${encodeURIComponent(userId)}`);
}

export function sendMessage(userId: string, text: string): Promise<DirectMessage> {
  return api.post<DirectMessage>(`/social/messages/${encodeURIComponent(userId)}`, { text });
}

export function blockUser(userId: string): Promise<{ blocked: boolean }> {
  return api.post<{ blocked: boolean }>(`/social/blocks/${encodeURIComponent(userId)}`);
}

export function unblockUser(userId: string): Promise<{ blocked: boolean }> {
  return api.delete<{ blocked: boolean }>(`/social/blocks/${encodeURIComponent(userId)}`);
}

export function fetchBlocked(): Promise<PublicProfile[]> {
  return api.get<PublicProfile[]>('/social/blocks');
}

export const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'impersonation', label: 'Pretending to be someone else' },
  { value: 'other', label: 'Something else' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

export function reportUser(input: {
  userId: string;
  reason: ReportReason;
  note?: string;
  messageId?: string;
}): Promise<{ id: string }> {
  return api.post<{ id: string }>('/social/reports', input);
}

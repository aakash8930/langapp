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

/** Mirrors `Leaderboard` in api/src/social/league.service.ts. */
export type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  weeklyXp: number;
  isYou: boolean;
};

export type Leaderboard = {
  /** ISO week, e.g. '2026-W31'. */
  week: string;
  /** When this week closes, so a countdown can be shown. */
  endsAt: string;
  tier: number;
  tierName: string;
  tierCount: number;
  rows: LeaderboardRow[];
  yourRank: number | null;
  /**
   * Zero when the tier is too small to settle — the client should say so rather
   * than promising promotions that will not happen.
   */
  promotionCount: number;
  /**
   * Always zero since Phase 2 §3.2 — promotion-only, no one goes down. The
   * field stays on the response so a future change does not break a stored
   * client.
   */
  relegationCount: 0;
  /**
   * Whether the viewer has the leaderboard switched on. An opted-out viewer
   * receives an empty `rows` and the client renders an opt-in card.
   */
  optedIn: boolean;
};

export function fetchLeaderboard(): Promise<Leaderboard> {
  return api.get<Leaderboard>('/social/leaderboard');
}

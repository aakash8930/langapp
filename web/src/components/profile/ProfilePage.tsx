import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  fetchHistory,
  updateProfile,
  uploadAvatar,
  type HistoryItem,
  type HistoryResponse,
  type UpdateProfilePatch,
  type Progress,
} from '../../api';
import type { User } from '../../auth';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { Achievements } from '../Achievements';
import { Icon, type IconName } from '../ui/Icon';
import './profile.css';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const LEAGUE_TIERS = ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby', 'Diamond'] as const;

function tierName(index: number): string {
  return LEAGUE_TIERS[Math.min(Math.max(index, 0), LEAGUE_TIERS.length - 1)];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((p) => [...p][0]?.toUpperCase() ?? '')
    .join('');
}

function joinedDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function describeEvent(item: HistoryItem): string {
  const p = item.payload;
  switch (item.type) {
    case 'lesson.completed':
      return `Completed a lesson`;
    case 'review.graded':
      return `Reviewed cards`;
    case 'chat.turn':
      return `Chatted with AI tutor`;
    case 'xp.awarded':
      return `Earned ${p.amount ?? '?'} XP`;
    default:
      return item.type.split('.').join(' ');
  }
}

function eventIcon(type: string): IconName {
  if (type === 'lesson.completed') return 'book-open';
  if (type === 'review.graded') return 'refresh-cw';
  if (type === 'chat.turn') return 'bot';
  return 'zap';
}

export function ProfilePage() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (session.state !== 'signedIn') {
    return (
      <div className="profile-page">
        <p className="placeholder-note">
          {session.state === 'loading' ? 'Loading…' : 'Sign in to view your profile.'}
        </p>
      </div>
    );
  }

  const user = session.user;
  const progress = session.progress;

  return (
    <div className="profile-page">
      <ProfileHero
        user={user}
        queryClient={queryClient}
        fileInputRef={fileInputRef}
      />
      <ProfileStats user={user} progress={progress} />
      <AchievementsSection progress={progress} />
      <ActivityTimeline />
    </div>
  );
}

function ProfileHero({
  user,
  queryClient,
  fileInputRef,
}: {
  user: User;
  queryClient: ReturnType<typeof useQueryClient>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [name, setName] = useState(user.profile.displayName);
  const [bio, setBio] = useState(user.profile.bio ?? '');

  const saveProfile = useMutation({
    mutationFn: (patch: UpdateProfilePatch) => updateProfile(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.session.me }),
  });

  const saveAvatar = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.session.me }),
  });

  const avatarSrc = user.avatarUrl ? `${API_BASE}/avatars/${user.id}` : null;

  return (
    <section className="profile-hero glass">
      <div className="profile-hero-cover" />

      <div className="profile-avatar-wrap">
        <button
          type="button"
          className="profile-avatar"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Change profile photo"
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="profile-avatar-img" />
          ) : (
            <span className="profile-avatar-initials">{initials(user.profile.displayName)}</span>
          )}
          <span className="profile-avatar-overlay" aria-hidden="true">
            <Icon name="zap" size={20} />
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept="image/png,image/jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) saveAvatar.mutate(file);
            if (e.target) e.target.value = '';
          }}
        />
      </div>

      <div className="profile-identity">
        {editingName ? (
          <input
            className="profile-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              if (name.trim() && name !== user.profile.displayName) {
                saveProfile.mutate({ displayName: name.trim() });
              } else {
                setName(user.profile.displayName);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            autoFocus
            maxLength={50}
          />
        ) : (
          <h1
            className="profile-name"
            onClick={() => setEditingName(true)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setEditingName(true);
            }}
          >
            {user.profile.displayName}
          </h1>
        )}

        <p className="profile-meta">
          Joined {joinedDate(user.createdAt)}
          {user.emailVerified && <span className="profile-verified"> · Verified</span>}
        </p>

        {editingBio ? (
          <textarea
            className="profile-bio-input"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            onBlur={() => {
              setEditingBio(false);
              if (bio !== (user.profile.bio ?? '')) {
                saveProfile.mutate({ bio });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            autoFocus
            maxLength={500}
            rows={2}
            placeholder="Write a short bio..."
          />
        ) : (
          <p
            className="profile-bio"
            onClick={() => setEditingBio(true)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setEditingBio(true);
            }}
          >
            {user.profile.bio || 'Add a bio to tell others about your learning journey.'}
          </p>
        )}
      </div>
    </section>
  );
}

function ProfileStats({
  user,
  progress,
}: {
  user: User;
  progress: Progress | null;
}) {
  const level = progress?.level ?? 1;
  const streak = progress?.streakDays ?? 0;
  const xp = progress?.xp ?? 0;
  const tier = tierName(user.gamification.leagueTier ?? 0);

  return (
    <section className="profile-stats">
      <div className="stat-card">
        <Icon name="flame" size={24} />
        <span className="stat-value">{streak}</span>
        <span className="stat-label">Day Streak</span>
      </div>
      <div className="stat-card">
        <Icon name="zap" size={24} />
        <span className="stat-value tabular">{xp.toLocaleString()}</span>
        <span className="stat-label">XP</span>
      </div>
      <div className="stat-card">
        <Icon name="trophy" size={24} />
        <span className="stat-value">{level}</span>
        <span className="stat-label">Level</span>
      </div>
      <div className="stat-card">
        <Icon name="graduation-cap" size={24} />
        <span className="stat-value">{tier}</span>
        <span className="stat-label">League</span>
      </div>
    </section>
  );
}

function AchievementsSection({
  progress,
}: {
  progress: Progress | null;
}) {
  if (!progress) return null;
  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Achievements</h2>
      <Achievements progress={progress} />
    </section>
  );
}

function ActivityTimeline() {
  const { data, isLoading, isError } = useQuery<HistoryResponse>({
    queryKey: queryKeys.session.history({ limit: 20 }),
    queryFn: () => fetchHistory({ limit: 20 }),
  });

  const items = data?.items ?? [];
  const groups = groupByDate(items);

  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Recent Activity</h2>

      {isLoading ? (
        <p className="placeholder-note">Loading activity...</p>
      ) : isError ? (
        <p className="placeholder-note">Could not load activity.</p>
      ) : groups.length === 0 ? (
        <p className="placeholder-note">No activity yet. Start learning to build your history!</p>
      ) : (
        <div className="timeline">
          {groups.map((group) => (
            <div key={group.label} className="timeline-group">
              <h3 className="timeline-group-label">{group.label}</h3>
              {group.items.map((item, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-icon">
                    <Icon name={eventIcon(item.type)} size={16} />
                  </div>
                  <div className="timeline-content">
                    <span className="timeline-desc">{describeEvent(item)}</span>
                    <span className="timeline-time">{relativeTime(item.ts)}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function groupByDate(items: HistoryItem[]) {
  const groups: { label: string; items: HistoryItem[] }[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const todays: HistoryItem[] = [];
  const yesterdays: HistoryItem[] = [];
  const thisWeeks: HistoryItem[] = [];
  const earlier: HistoryItem[] = [];

  for (const item of items) {
    const d = new Date(item.ts);
    if (d >= today) todays.push(item);
    else if (d >= yesterday) yesterdays.push(item);
    else if (d >= weekAgo) thisWeeks.push(item);
    else earlier.push(item);
  }

  if (todays.length) groups.push({ label: 'Today', items: todays });
  if (yesterdays.length) groups.push({ label: 'Yesterday', items: yesterdays });
  if (thisWeeks.length) groups.push({ label: 'This Week', items: thisWeeks });
  if (earlier.length) groups.push({ label: 'Earlier', items: earlier });

  return groups;
}

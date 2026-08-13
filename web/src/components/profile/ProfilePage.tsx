import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react';

import {
  fetchHistory,
  updateProfile,
  uploadAvatar,
  type HistoryItem,
  type HistoryResponse,
  type Progress,
  type UpdateProfilePatch,
} from '../../api';
import type { User } from '../../auth';
import { achievementsFor, levelTier } from '../../gamification';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { Icon, type IconName } from '../ui/Icon';
import './profile.css';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const LEAGUE_TIERS = ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby', 'Diamond'] as const;
const LEVEL_TITLES = {
  bronze: 'Bronze learner',
  silver: 'Silver learner',
  gold: 'Gold learner',
  diamond: 'Diamond learner',
  master: 'Master learner',
} as const;

function tierName(index: number): string {
  return LEAGUE_TIERS[Math.min(Math.max(index, 0), LEAGUE_TIERS.length - 1)];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => [...part][0]?.toUpperCase() ?? '')
    .join('');
}

function joinedDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff)) return '';
  const mins = Math.floor(Math.max(diff, 0) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function describeEvent(item: HistoryItem): string {
  switch (item.type) {
    case 'lesson.completed':
      return 'Completed a lesson';
    case 'review.graded':
      return 'Reviewed study cards';
    case 'chat.turn':
      return 'Practised with the AI tutor';
    case 'xp.awarded':
      return `Earned ${String(item.payload.amount ?? 'more')} XP`;
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

function readableValue(value: string): string {
  if (!value) return 'Not set';
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function languageName(value: string): string {
  if (!value) return 'Not set';
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(value) ?? readableValue(value);
  } catch {
    return readableValue(value);
  }
}

export function ProfilePage() {
  const { session, signOut } = useSession();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (session.state !== 'signedIn') {
    return (
      <div className="profile-page profile-page-empty">
        <section className="profile-empty glass">
          <span className="profile-empty-mark ja" aria-hidden="true">私</span>
          <h1>{session.state === 'loading' ? 'Loading your profile…' : 'Your profile is private'}</h1>
          <p>
            {session.state === 'loading'
              ? 'We are gathering your learning progress.'
              : 'Sign in to manage your account and see your learning journey.'}
          </p>
          {session.state === 'signedOut' ? <Link className="btn btn-primary" to="/">Sign in</Link> : null}
        </section>
      </div>
    );
  }

  const { user, progress } = session;

  return (
    <div className="profile-page">
      <header className="profile-page-head">
        <p className="profile-eyebrow">LEARNER IDENTITY & PORTFOLIO</p>
        <h1>My profile <Icon name="users-round" size={24} /></h1>
        <p>Your identity, learning milestones, achievements, saved material, and recorded activity—without mixing in account security settings.</p>
      </header>

      <div className="profile-summary-grid">
        <ProfileHero user={user} progress={progress} queryClient={queryClient} fileInputRef={fileInputRef} />
        <LevelProgress user={user} progress={progress} />
      </div>

      <ProfileNav />

      <div className="profile-content-grid">
        <main className="profile-primary">
          <LearningOverview progress={progress} />
          <div className="profile-detail-grid">
            <LearningPreferences user={user} progress={progress} />
            <LearningFocus user={user} />
          </div>
        </main>

        <aside className="profile-rail" aria-label="Achievements, activity, and account actions">
          <AchievementPreview progress={progress} />
          <ActivityTimeline />
          <AccountActions signOut={signOut} />
        </aside>
      </div>
    </div>
  );
}

function ProfileHero({
  user,
  progress,
  queryClient,
  fileInputRef,
}: {
  user: User;
  progress: Progress | null;
  queryClient: ReturnType<typeof useQueryClient>;
  fileInputRef: RefObject<HTMLInputElement | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.profile.displayName);
  const [bio, setBio] = useState(user.profile.bio ?? '');

  const saveProfile = useMutation({
    mutationFn: (patch: UpdateProfilePatch) => updateProfile(patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.session.me });
      setEditing(false);
    },
  });

  const saveAvatar = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.session.me }),
  });

  const avatarSrc = user.avatarUrl ? `${API_BASE}/avatars/${user.id}` : null;
  const joined = joinedDate(user.createdAt);
  const proficiency = user.onboardingState?.proficiencyLevel;
  const goals = user.onboardingState?.learningGoals ?? [];
  const primaryGoal = goals[0] ? readableValue(goals[0]) : 'Not set';

  function beginEditing() {
    setName(user.profile.displayName);
    setBio(user.profile.bio ?? '');
    setEditing(true);
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const patch: UpdateProfilePatch = {};
    if (trimmedName !== user.profile.displayName) patch.displayName = trimmedName;
    if (bio !== (user.profile.bio ?? '')) patch.bio = bio;

    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    saveProfile.mutate(patch);
  }

  return (
    <section className="profile-hero glass" aria-label="Profile identity" aria-busy={saveProfile.isPending || saveAvatar.isPending}>
      <div className="profile-hero-cover" aria-hidden="true">
        <span className="profile-cover-kanji ja">継続</span>
      </div>

      <div className="profile-hero-body">
        <div className="profile-avatar-wrap">
          <button
            type="button"
            className="profile-avatar"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Change profile photo"
            disabled={saveAvatar.isPending}
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="profile-avatar-img" />
            ) : (
              <span className="profile-avatar-initials">{initials(user.profile.displayName)}</span>
            )}
            <span className="profile-avatar-overlay" aria-hidden="true">
              <Icon name="pen-square" size={18} />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/png,image/jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) saveAvatar.mutate(file);
              event.target.value = '';
            }}
          />
          {saveAvatar.isPending ? <span className="profile-avatar-status">Uploading…</span> : null}
        </div>

        <div className="profile-identity">
          {editing ? (
            <form className="profile-edit-form" onSubmit={submitProfile}>
              <label htmlFor="profile-display-name">Display name</label>
              <input
                id="profile-display-name"
                className="profile-name-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={50}
                autoFocus
                required
              />
              <label htmlFor="profile-bio">Bio</label>
              <textarea
                id="profile-bio"
                className="profile-bio-input"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Write a short bio about your learning journey…"
              />
              <div className="profile-edit-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saveProfile.isPending}>
                  {saveProfile.isPending ? 'Saving…' : 'Save profile'}
                </button>
              </div>
              {saveProfile.isError ? <p className="profile-form-error" role="alert">Could not save your profile. Try again.</p> : null}
            </form>
          ) : (
            <>
              <div className="profile-name-row">
                <div>
                  <h2 className="profile-name" id="profile-name">{user.profile.displayName}</h2>
                  <p className="profile-meta">
                    <span className="profile-track-badge">{proficiency ? readableValue(proficiency) : languageName(user.profile.activeTrack)}</span>
                    {joined ? <span><Icon name="calendar" size={13} /> Learning since {joined}</span> : null}
                    {user.emailVerified ? <span className="profile-verified"><Icon name="check" size={13} /> Verified</span> : null}
                  </p>
                </div>
                <button type="button" className="profile-edit-button" onClick={beginEditing}>
                  <Icon name="pen-square" size={14} /> Edit profile
                </button>
              </div>

              <blockquote className="profile-bio">
                <span className="profile-quote-mark ja" aria-hidden="true">「</span>
                <p>{user.profile.bio || '継続は力なり。 Consistency is power.'}</p>
              </blockquote>

              <dl className="profile-facts">
                <ProfileFact icon="languages" label="Native language" value={languageName(user.profile.nativeLanguage)} />
                <ProfileFact icon="graduation-cap" label="Learning goal" value={primaryGoal} />
                <ProfileFact icon="settings" label="Time zone" value={user.settings.tz || 'Not set'} />
                <ProfileFact icon="zap" label="Daily goal" value={progress ? `${progress.daily.goalXp} XP` : `${user.gamification.dailyGoalXp} XP`} />
              </dl>
            </>
          )}
        </div>
      </div>

      {saveAvatar.isError ? <p className="profile-upload-error" role="alert">The photo could not be uploaded. Use a PNG or JPEG under 2 MB.</p> : null}
    </section>
  );
}

function ProfileFact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div>
      <Icon name={icon} size={17} />
      <div className="profile-fact-copy">
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

function LevelProgress({ user, progress }: { user: User; progress: Progress | null }) {
  const percent = progress && progress.xpForNextLevel > 0
    ? Math.min(100, Math.round((progress.xpIntoLevel / progress.xpForNextLevel) * 100))
    : 0;
  const title = progress ? LEVEL_TITLES[levelTier(progress.level)] : 'Loading progress';
  const league = tierName(user.gamification.leagueTier ?? 0);

  return (
    <section className="profile-level-card glass" aria-labelledby="profile-level-heading">
      <div className="profile-card-head">
        <div>
          <p className="profile-card-kicker">CURRENT LEVEL</p>
          <h2 id="profile-level-heading">Level progress</h2>
        </div>
        <Link to="/progress">View details</Link>
      </div>

      <div className="profile-level-main">
        <span className="profile-level-shield" aria-hidden="true">{progress?.level ?? '—'}</span>
        <span>
          <strong>{title}</strong>
          <small>{league} league</small>
        </span>
        <b className="tabular">{percent}%</b>
      </div>
      <span className="profile-level-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
      <p className="profile-level-note tabular">
        {progress
          ? `${progress.xpIntoLevel.toLocaleString()} of ${progress.xpForNextLevel.toLocaleString()} XP to level ${progress.level + 1}`
          : 'Progress is loading…'}
      </p>
      <dl className="profile-level-mini-stats">
        <div><dt>Total XP</dt><dd>{progress?.xp.toLocaleString() ?? '—'}</dd></div>
        <div><dt>Lessons</dt><dd>{progress?.lessonsCompleted ?? '—'}</dd></div>
        <div><dt>Due now</dt><dd>{progress?.cardsDueNow ?? '—'}</dd></div>
      </dl>
    </section>
  );
}

function ProfileNav() {
  const items = [
    { label: 'Overview', icon: 'grid' as const, to: '/profile' as const, current: true },
    { label: 'Achievements', icon: 'award' as const, to: '/achievements' as const },
    { label: 'Study stats', icon: 'trending-up' as const, to: '/progress' as const },
    { label: 'Certificates', icon: 'award' as const, to: '/courses' as const },
    { label: 'Bookmarks', icon: 'book-marked' as const, to: '/vocab-bookmarks' as const },
    { label: 'Settings', icon: 'settings' as const, to: '/settings' as const },
  ];

  return (
    <nav className="profile-nav glass" aria-label="Profile sections">
      {items.map((item) => (
        <Link key={item.label} className={`profile-nav-link${item.current ? ' profile-nav-link-active' : ''}`} to={item.to} aria-current={item.current ? 'page' : undefined}>
          <Icon name={item.icon} size={16} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function LearningOverview({ progress }: { progress: Progress | null }) {
  const dailyPercent = Math.min(100, Math.max(0, Math.round(progress?.daily.percentOfGoal ?? 0)));
  const completedStreakDays = Math.min(progress?.streakDays ?? 0, 7);
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'narrow' });
  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { label: weekday.format(date), done: index >= 7 - completedStreakDays };
  });

  return (
    <section className="profile-overview-card glass" aria-labelledby="learning-overview-heading">
      <div className="profile-card-head">
        <div>
          <p className="profile-card-kicker">YOUR JOURNEY</p>
          <h2 id="learning-overview-heading">Learning overview</h2>
        </div>
        <Link to="/progress">Full analytics</Link>
      </div>

      <div className="profile-overview-main">
        <div
          className="profile-progress-ring"
          style={{ '--profile-progress': `${dailyPercent * 3.6}deg` } as CSSProperties}
          role="img"
          aria-label={`${dailyPercent}% of today's XP goal complete`}
        >
          <span><strong className="tabular">{dailyPercent}%</strong><small>Daily goal</small></span>
        </div>

        <dl className="profile-overview-stats">
          <div><Icon name="zap" size={19} /><div className="profile-overview-stat-copy"><dt>XP earned</dt><dd className="tabular">{progress?.xp.toLocaleString() ?? '—'}</dd></div></div>
          <div><Icon name="book-open" size={19} /><div className="profile-overview-stat-copy"><dt>Lessons completed</dt><dd className="tabular">{progress?.lessonsCompleted ?? '—'}</dd></div></div>
          <div><Icon name="refresh-cw" size={19} /><div className="profile-overview-stat-copy"><dt>Reviews today</dt><dd className="tabular">{progress?.daily.reviewsDone ?? '—'}</dd></div></div>
        </dl>
      </div>

      <div className="profile-streak-panel">
        <span className="profile-streak-copy"><Icon name="flame" size={26} /><span><small>Study streak</small><strong>{progress?.streakDays ?? 0} days</strong></span></span>
        <ul className="profile-streak-week" aria-label={`${completedStreakDays} of the last seven consecutive streak days`}>
          {recentDays.map((day, index) => (
            <li key={`${day.label}-${index}`} className={day.done ? 'is-done' : ''}>
              <span>{day.label}</span><i aria-hidden="true">{day.done ? '✓' : ''}</i>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function LearningPreferences({ user, progress }: { user: User; progress: Progress | null }) {
  const reminder = user.notificationSettings?.studyReminders;
  const style = user.onboardingState?.learningStyle;

  return (
    <section className="profile-detail-card glass" aria-labelledby="preferences-heading">
      <div className="profile-card-head">
        <div><p className="profile-card-kicker">PERSONALISED FOR YOU</p><h2 id="preferences-heading">Learning preferences</h2></div>
        <Link to="/settings" aria-label="Edit learning preferences"><Icon name="settings" size={16} /></Link>
      </div>
      <dl className="profile-row-list">
        <PreferenceRow icon="bell" label="Study reminders" value={reminder === undefined ? 'Not configured' : reminder ? 'On' : 'Off'} />
        <PreferenceRow icon="headphones" label="Audio speed" value={`${user.settings.audioSpeed}×`} />
        <PreferenceRow icon="book-open" label="Learning style" value={style ? readableValue(style) : 'Not set'} />
        <PreferenceRow icon="zap" label="Daily XP goal" value={`${progress?.daily.goalXp ?? user.gamification.dailyGoalXp} XP`} />
        <PreferenceRow icon="settings" label="Font size" value={readableValue(user.settings.fontSize ?? 'medium')} />
      </dl>
    </section>
  );
}

function LearningFocus({ user }: { user: User }) {
  const goals = user.onboardingState?.learningGoals ?? [];
  const knownKana = user.learningState.knownKana.length;

  return (
    <section className="profile-detail-card glass" aria-labelledby="focus-heading">
      <div className="profile-card-head">
        <div><p className="profile-card-kicker">WHAT DRIVES YOU</p><h2 id="focus-heading">Learning focus</h2></div>
        <Link to="/settings" aria-label="Edit learning focus"><Icon name="chevron-right" size={16} /></Link>
      </div>

      {goals.length > 0 ? (
        <ul className="profile-focus-list">
          {goals.slice(0, 4).map((goal, index) => (
            <li key={goal}><span className="profile-focus-icon" aria-hidden="true">{['旅', '話', '読', '文'][index] ?? '日'}</span><strong>{readableValue(goal)}</strong></li>
          ))}
        </ul>
      ) : (
        <div className="profile-focus-empty">
          <span className="ja" aria-hidden="true">目標</span>
          <p>Add your reasons for learning Japanese and we will show them here.</p>
          <Link to="/settings">Set learning goals</Link>
        </div>
      )}

      <dl className="profile-focus-summary">
        <div><dt>Active track</dt><dd>{languageName(user.profile.activeTrack)}</dd></div>
        <div><dt>Known kana</dt><dd className="tabular">{knownKana}</dd></div>
      </dl>
    </section>
  );
}

function PreferenceRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return <div><Icon name={icon} size={17} /><dt>{label}</dt><dd>{value}</dd></div>;
}

function AchievementPreview({ progress }: { progress: Progress | null }) {
  if (!progress) {
    return <section className="profile-rail-card glass"><p className="placeholder-note">Loading achievements…</p></section>;
  }

  const all = achievementsFor(progress);
  const earned = all.filter((badge) => badge.unlocked).length;
  const preview = all.slice(0, 6);

  return (
    <section className="profile-rail-card glass" aria-labelledby="profile-achievements-heading">
      <div className="profile-card-head">
        <div><p className="profile-card-kicker">{earned} OF {all.length} EARNED</p><h2 id="profile-achievements-heading">Achievements</h2></div>
        <Link to="/achievements">View all</Link>
      </div>
      <ul className="profile-achievement-grid">
        {preview.map((badge) => (
          <li key={badge.id} className={badge.unlocked ? 'is-earned' : ''} title={badge.unlocked ? badge.earned : badge.goal}>
            <span aria-hidden="true">{badge.icon}</span>
            <strong>{badge.title}</strong>
            <small>{badge.unlocked ? 'Complete' : `${Math.round((badge.progress ?? 0) * 100)}%`}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityTimeline() {
  const { data, isLoading, isError } = useQuery<HistoryResponse>({
    queryKey: queryKeys.session.history({ limit: 6 }),
    queryFn: () => fetchHistory({ limit: 6 }),
  });
  const items = data?.items.slice(0, 5) ?? [];

  return (
    <section className="profile-rail-card glass" aria-labelledby="recent-activity-heading">
      <div className="profile-card-head">
        <div><p className="profile-card-kicker">LATEST MOMENTS</p><h2 id="recent-activity-heading">Recent activity</h2></div>
        <Link to="/progress">View all</Link>
      </div>

      {isLoading ? (
        <p className="profile-card-state">Loading activity…</p>
      ) : isError ? (
        <p className="profile-card-state">Activity is unavailable right now.</p>
      ) : items.length === 0 ? (
        <p className="profile-card-state">Start a lesson to build your learning history.</p>
      ) : (
        <ul className="profile-activity-list">
          {items.map((item, index) => (
            <li key={`${item.ts}-${index}`}>
              <span className="profile-activity-icon"><Icon name={eventIcon(item.type)} size={15} /></span>
              <span><strong>{describeEvent(item)}</strong><small>{relativeTime(item.ts)}</small></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AccountActions({ signOut }: { signOut: () => void }) {
  return (
    <section className="profile-rail-card profile-account-card glass" aria-labelledby="account-actions-heading">
      <div className="profile-card-head"><div><p className="profile-card-kicker">PRIVATE & SECURE</p><h2 id="account-actions-heading">Account</h2></div></div>
      <Link to="/settings"><Icon name="shield" size={17} /><span><strong>Account & security</strong><small>Password, 2FA, and privacy</small></span><Icon name="chevron-right" size={15} /></Link>
      <Link to="/billing"><Icon name="crown" size={17} /><span><strong>Plan and billing</strong><small>Subscription and invoices</small></span><Icon name="chevron-right" size={15} /></Link>
      <Link to="/notifications"><Icon name="bell" size={17} /><span><strong>Notifications</strong><small>Updates and reminders</small></span><Icon name="chevron-right" size={15} /></Link>
      <button type="button" onClick={signOut}><Icon name="chevron-left" size={17} /><span><strong>Sign out</strong><small>End this browser session</small></span></button>
    </section>
  );
}

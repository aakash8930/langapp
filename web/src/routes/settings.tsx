import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

import {
  MAX_DAILY_GOAL_XP,
  MIN_DAILY_GOAL_XP,
  exportUserData,
  updateNotificationSettings,
  updateProfile,
  updateSettings,
  type NotificationSettingsShape,
  type SettingsPatch,
} from '../api';
import type { User } from '../auth';
import { logError } from '../debug';
import { queryKeys } from '../queryKeys';
import { useSession } from '../useSession';
import { SecurityDashboard } from '../components/security/SecurityDashboard';

import './settings.css';

const SECTIONS = [
  'account', 'security', 'appearance', 'accessibility',
  'notifications', 'privacy', 'data', 'danger',
] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_LABELS: Record<Section, string> = {
  account: 'Account',
  security: 'Security',
  appearance: 'Appearance',
  accessibility: 'Accessibility',
  notifications: 'Notifications',
  privacy: 'Privacy',
  data: 'Data & Storage',
  danger: 'Danger Zone',
};

export const Route = createFileRoute('/settings')({
  component: SettingsShell,
});

function timeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = ['UTC', 'Asia/Kolkata', 'Asia/Tokyo', 'Europe/London', 'America/New_York'];
  }
  return zones.includes(current) ? zones : [current, ...zones];
}

function SettingsShell() {
  const { session } = useSession();
  const [activeSection, setActiveSection] = useState<Section>('account');

  if (session.state !== 'signedIn') {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">
            {session.state === 'loading' ? 'Loading…' : 'Sign in to change your settings.'}
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="settings-shell">
      <nav className="settings-nav">
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className={`settings-nav-item ${activeSection === s ? 'settings-nav-item--active' : ''}`}
            onClick={() => setActiveSection(s)}
          >
            {SECTION_LABELS[s]}
          </button>
        ))}
      </nav>

      <div className="settings-content">
        <RenderSection
          section={activeSection}
          user={session.user}
          goalXp={session.progress?.daily.goalXp ?? null}
        />
      </div>
    </div>
  );
}

function RenderSection({
  section,
  user,
  goalXp,
}: {
  section: Section;
  user: User;
  goalXp: number | null;
}) {
  switch (section) {
    case 'account': return <AccountSection user={user} />;
    case 'security': return <SecurityDashboard />;
    case 'appearance': return <AppearanceSection user={user} goalXp={goalXp} />;
    case 'accessibility': return <AccessibilitySection />;
    case 'notifications': return <NotificationsSection user={user} />;
    case 'privacy': return <PrivacySection user={user} />;
    case 'data': return <DataSection />;
    case 'danger': return <SecurityDashboard />;
    default: return null;
  }
}

/* ---- Account ---- */

function AccountSection({ user }: { user: User }) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(user.profile.displayName);
  const [bio, setBio] = useState(user.profile.bio ?? '');
  const [language, setLanguage] = useState(user.profile.nativeLanguage);

  const save = useMutation({
    mutationFn: (p: { displayName?: string; bio?: string; nativeLanguage?: string }) =>
      updateProfile(p),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.session.me }),
  });

  const joined = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <section>
      <h2 className="card-title">Account</h2>
      <div className="settings-fields">
        <div className="field">
          <label className="field-label">Email</label>
          <p className="field-value">{user.email}</p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="acc-name">Display name</label>
          <input
            id="acc-name"
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { if (name.trim() && name !== user.profile.displayName) save.mutate({ displayName: name.trim() }); }}
            maxLength={50}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="acc-bio">Bio</label>
          <textarea
            id="acc-bio"
            className="field-input"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            onBlur={() => { if (bio !== (user.profile.bio ?? '')) save.mutate({ bio }); }}
            maxLength={500}
            rows={2}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="acc-lang">Native language</label>
          <select
            id="acc-lang"
            className="field-input"
            value={language}
            onChange={(e) => { setLanguage(e.target.value); save.mutate({ nativeLanguage: e.target.value }); }}
          >
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="zh">中文</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="pt">Português</option>
            <option value="ru">Русский</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>

        {joined && (
          <p className="field-note">Joined {joined}{' '}
            {user.emailVerified ? <span className="badge-verified"> · Verified</span> : <span className="badge-unverified"> · Unverified</span>}
          </p>
        )}
      </div>
    </section>
  );
}

/* ---- Appearance ---- */

function AppearanceSection({ user, goalXp }: { user: User; goalXp: number | null }) {
  const queryClient = useQueryClient();

  const [audioSpeed, setAudioSpeed] = useState(user.settings.audioSpeed);
  const [tz, setTz] = useState(user.settings.tz);
  const [dailyGoalXp, setDailyGoalXp] = useState(goalXp ?? user.gamification.dailyGoalXp);
  const [fontSize, setFontSize] = useState(user.settings.fontSize ?? 'medium');

  const save = useMutation({
    mutationFn: (patch: SettingsPatch) => updateSettings(patch),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.session.me }),
        queryClient.invalidateQueries({ queryKey: queryKeys.session.progress }),
      ]);
    },
    onError: (e: unknown) => logError('api', 'settings save failed', e),
  });

  const patch: SettingsPatch = {};
  if (audioSpeed !== user.settings.audioSpeed) patch.audioSpeed = audioSpeed;
  if (tz !== user.settings.tz) patch.tz = tz;
  if (dailyGoalXp !== (goalXp ?? user.gamification.dailyGoalXp)) patch.dailyGoalXp = dailyGoalXp;
  if (fontSize !== (user.settings.fontSize ?? 'medium')) patch.fontSize = fontSize as SettingsPatch['fontSize'];

  const goalOutOfRange = dailyGoalXp < MIN_DAILY_GOAL_XP || dailyGoalXp > MAX_DAILY_GOAL_XP;

  return (
    <section>
      <h2 className="card-title">Appearance</h2>
      <div className="settings-fields">
        <div className="field">
          <label className="field-label" htmlFor="goal">Daily XP goal</label>
          <input id="goal" className="field-input tabular" type="number" min={MIN_DAILY_GOAL_XP} max={MAX_DAILY_GOAL_XP} value={dailyGoalXp} onChange={(e) => setDailyGoalXp(Number(e.target.value))} />
          <p className="field-note">Between {MIN_DAILY_GOAL_XP} and {MAX_DAILY_GOAL_XP}.</p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="tz">Time zone</label>
          <select id="tz" className="field-input" value={tz} onChange={(e) => setTz(e.target.value)}>
            {timeZones(user.settings.tz).map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="speed">Audio speed — <span className="tabular">{audioSpeed.toFixed(2)}×</span></label>
          <input id="speed" className="field-range" type="range" min={0.5} max={2} step={0.05} value={audioSpeed} onChange={(e) => setAudioSpeed(Number(e.target.value))} />
        </div>

        <div className="field">
          <span className="field-label">Theme</span>
          <p className="field-value">Japanese Ink — dark</p>
          <p className="field-note">
            GENKŌ uses the same sumi-black, gold and vermilion theme on every screen.
          </p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="font">Font size</label>
          <select id="font" className="field-input" value={fontSize} onChange={(e) => setFontSize(e.target.value)}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </div>

      <div className="settings-actions">
        <button
          className="btn btn-primary"
          type="button"
          disabled={Object.keys(patch).length === 0 || goalOutOfRange || save.isPending}
          onClick={() => save.mutate(patch)}
        >
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </section>
  );
}

/* ---- Accessibility ---- */

function AccessibilitySection() {
  const [reducedMotion, setReducedMotion] = useState(() => document.documentElement.classList.contains('reduced-motion'));
  const [highContrast, setHighContrast] = useState(() => document.documentElement.classList.contains('high-contrast'));

  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
  }, [highContrast]);

  return (
    <section>
      <h2 className="card-title">Accessibility</h2>
      <div className="settings-fields">
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} />
            <span>Reduced motion</span>
          </label>
          <p className="field-note">Minimise animations and transitions throughout the site.</p>
        </div>

        <div className="field">
          <label className="check">
            <input type="checkbox" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} />
            <span>High contrast</span>
          </label>
          <p className="field-note">Increase contrast for better readability.</p>
        </div>
      </div>
    </section>
  );
}

/* ---- Notifications ---- */

function NotificationsSection({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const ns = user.notificationSettings;
  const [studyReminders, setStudyReminders] = useState(ns?.studyReminders ?? true);
  const [achievementsNotif, setAchievementsNotif] = useState(ns?.achievements ?? true);
  const [communityNotif, setCommunityNotif] = useState(ns?.community ?? true);
  const [eventsUpdates, setEventsUpdates] = useState(ns?.eventsUpdates ?? true);
  const [marketingNotif, setMarketingNotif] = useState(ns?.marketing ?? false);

  const save = useMutation({
    mutationFn: (p: Partial<NotificationSettingsShape>) => updateNotificationSettings(p),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.session.me }),
    onError: (e: unknown) => logError('api', 'notif settings failed', e),
  });

  const toggle = (key: keyof NotificationSettingsShape, setter: (v: boolean) => void, value: boolean) => {
    setter(value);
    save.mutate({ [key]: value } as Partial<NotificationSettingsShape>);
  };

  return (
    <section>
      <h2 className="card-title">Notifications</h2>
      <div className="settings-fields">
        <SettingCheck label="Study reminders" desc="Remind you to practice daily." checked={studyReminders} onChange={(v) => toggle('studyReminders', setStudyReminders, v)} />
        <SettingCheck label="Achievements" desc="Streak milestones and level-ups." checked={achievementsNotif} onChange={(v) => toggle('achievements', setAchievementsNotif, v)} />
        <SettingCheck label="Community" desc="Friend requests, messages, and replies." checked={communityNotif} onChange={(v) => toggle('community', setCommunityNotif, v)} />
        <SettingCheck label="Events & updates" desc="New lessons, challenges, and features." checked={eventsUpdates} onChange={(v) => toggle('eventsUpdates', setEventsUpdates, v)} />
        <SettingCheck label="Marketing" desc="Tips, offers and product updates." checked={marketingNotif} onChange={(v) => toggle('marketing', setMarketingNotif, v)} />
      </div>
    </section>
  );
}

function SettingCheck({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="field">
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      <p className="field-note">{desc}</p>
    </div>
  );
}

/* ---- Privacy ---- */

function PrivacySection({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(user.settings.leaderboardOptIn);

  const save = useMutation({
    mutationFn: (patch: SettingsPatch) => updateSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.session.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.social.leaderboard });
    },
    onError: (e: unknown) => logError('api', 'privacy save failed', e),
  });

  return (
    <section>
      <h2 className="card-title">Privacy</h2>
      <div className="settings-fields">
        <SettingCheck
          label="Appear in the weekly leaderboard"
          desc="Turning this off hides you from the next leaderboard read onward."
          checked={leaderboardOptIn}
          onChange={(v) => { setLeaderboardOptIn(v); save.mutate({ leaderboardOptIn: v }); }}
        />
      </div>
    </section>
  );
}

/* ---- Data & Storage ---- */

function DataSection() {
  const queryClient = useQueryClient();

  const exportMutation = useMutation({
    mutationFn: exportUserData,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `genko-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <section>
      <h2 className="card-title">Data & Storage</h2>
      <div className="settings-fields">
        <div className="field">
          <label className="field-label">Export your data</label>
          <p className="field-note">Download a JSON file with your profile, settings, and learning data.</p>
          <button
            className="btn btn-secondary"
            type="button"
            style={{ marginTop: 'var(--s-sm)' }}
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            {exportMutation.isPending ? 'Exporting…' : 'Export my data'}
          </button>
        </div>

        <div className="field" style={{ marginTop: 'var(--s-lg)' }}>
          <label className="field-label">Clear local cache</label>
          <p className="field-note">Remove cached data stored in your browser. Your account data on the server is not affected.</p>
          <button
            className="btn btn-secondary"
            type="button"
            style={{ marginTop: 'var(--s-sm)' }}
            onClick={() => queryClient.clear()}
          >
            Clear cache
          </button>
        </div>

        <div className="field" style={{ marginTop: 'var(--s-lg)' }}>
          <label className="field-label">Downloads</label>
          <p className="field-note">No offline downloads configured. Offline content management will be available here.</p>
        </div>
      </div>
    </section>
  );
}

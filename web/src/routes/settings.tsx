import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  MAX_DAILY_GOAL_XP,
  MIN_DAILY_GOAL_XP,
  THEMES,
  updateSettings,
  type SettingsPatch,
  type Theme,
} from '../api';
import type { User } from '../auth';
import { log, logError } from '../debug';
import { queryKeys } from '../queryKeys';
import { useSession } from '../useSession';

import './settings.css';

/**
 * Settings — the only screen on this site that writes to the user record.
 *
 * ## One save button, one PATCH, one round trip
 *
 * `PATCH /me/settings` patches: sending one key leaves the rest alone. This
 * form still sends **only the fields that changed**, which matters for a reason
 * beyond payload size — `dailyGoalXp` is validated server-side against a range,
 * and re-sending an unchanged value that some *other* surface has since altered
 * would silently revert it.
 *
 * ## Optimism is not worth it here
 *
 * The review session's queue is optimistic because twenty cards must not feel
 * like twenty round trips. A settings form is the opposite case: it is saved
 * once, deliberately, and a value that appears to save and then reverts is far
 * worse than a button that says "Saving…" for 200ms. So this awaits the
 * response and re-reads the user from it.
 *
 * ## What is not here
 *
 * `displayName` and `nativeLanguage` live on `profile`, which
 * `UpdateSettingsDto` does not accept — there is no endpoint to change them, so
 * there is no field for them rather than a field that fails on save.
 */
export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

/**
 * Every IANA zone the runtime knows, or a short fallback list.
 *
 * `Intl.supportedValuesOf` is the standard way to ask and needs no dependency,
 * but it is recent enough to be worth guarding — an older engine throws
 * `TypeError` rather than returning undefined, and a settings page that crashes
 * on load is a worse outcome than a shorter list.
 */
function timeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = ['UTC', 'Asia/Kolkata', 'Asia/Tokyo', 'Europe/London', 'America/New_York'];
  }
  // The stored zone might not be in the runtime's list — it could predate a tz
  // database update, and dropping it would silently reassign the learner's day
  // boundary the first time they saved anything else.
  return zones.includes(current) ? zones : [current, ...zones];
}

function SettingsPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();

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
    <SettingsForm
      key={session.user.id}
      user={session.user}
      goalXp={session.progress?.daily.goalXp ?? null}
      queryClient={queryClient}
    />
  );
}

/**
 * Split out so the form's `useState` initialisers can read the loaded user
 * directly. Hooks cannot run after the early return above, and initialising
 * from a possibly-null user would mean seeding every field with a placeholder
 * and then reconciling it once the session lands.
 *
 * The `key` on the call site is what makes that safe: a different user remounts
 * the form rather than leaving it holding the previous one's values.
 */
function SettingsForm({
  user,
  goalXp,
  queryClient,
}: {
  user: User;
  goalXp: number | null;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [audioSpeed, setAudioSpeed] = useState(user.settings.audioSpeed);
  const [theme, setTheme] = useState<Theme>(
    (THEMES as readonly string[]).includes(user.settings.theme)
      ? (user.settings.theme as Theme)
      : 'system',
  );
  const [tz, setTz] = useState(user.settings.tz);
  const [dailyGoalXp, setDailyGoalXp] = useState(goalXp ?? user.gamification.dailyGoalXp);
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(user.settings.leaderboardOptIn);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (patch: SettingsPatch) => updateSettings(patch),
    onSuccess: async () => {
      setSaved(true);
      log('api', 'settings saved');

      /*
       * Three caches, because one PATCH moves values that live in three
       * responses:
       *   - `/me`            — audioSpeed, theme, tz, leaderboardOptIn
       *   - `/me/progress`   — `daily.goalXp`, which is what the dashboard ring
       *                        and the sidebar goal card are measured against
       *   - the leaderboard  — `optedIn` decides whether you appear at all
       *
       * Forgetting the second is the one that shows: the goal saves, and the
       * dashboard goes on drawing the ring against the old target until a
       * reload.
       */
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.session.me }),
        queryClient.invalidateQueries({ queryKey: queryKeys.session.progress }),
        queryClient.invalidateQueries({ queryKey: queryKeys.social.leaderboard }),
      ]);
    },
    onError: (error: unknown) => logError('api', 'settings save failed', error),
  });

  // Only what changed. See the note in this file's header for why this is not
  // just a payload-size preference.
  const patch: SettingsPatch = {};
  if (audioSpeed !== user.settings.audioSpeed) patch.audioSpeed = audioSpeed;
  if (theme !== user.settings.theme) patch.theme = theme;
  if (tz !== user.settings.tz) patch.tz = tz;
  if (dailyGoalXp !== (goalXp ?? user.gamification.dailyGoalXp)) patch.dailyGoalXp = dailyGoalXp;
  if (leaderboardOptIn !== user.settings.leaderboardOptIn) {
    patch.leaderboardOptIn = leaderboardOptIn;
  }

  const dirty = Object.keys(patch).length > 0;
  const goalOutOfRange = dailyGoalXp < MIN_DAILY_GOAL_XP || dailyGoalXp > MAX_DAILY_GOAL_XP;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">{user.email}</p>
      </header>

      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!dirty || goalOutOfRange) return;
          setSaved(false);
          save.mutate(patch);
        }}
      >
        <fieldset className="card glass settings-group">
          <legend className="card-title">Study</legend>

          <div className="field">
            <label className="field-label" htmlFor="goal">
              Daily XP goal
            </label>
            <input
              className="field-input tabular"
              id="goal"
              type="number"
              min={MIN_DAILY_GOAL_XP}
              max={MAX_DAILY_GOAL_XP}
              value={dailyGoalXp}
              onChange={(event) => setDailyGoalXp(Number(event.target.value))}
              aria-describedby="goal-note"
            />
            <p className="field-note" id="goal-note">
              Between {MIN_DAILY_GOAL_XP} and {MAX_DAILY_GOAL_XP}. A review is worth 2 XP and a
              first lesson completion 10, so {MIN_DAILY_GOAL_XP} is about the smallest goal you
              cannot meet by accident.
            </p>
            {goalOutOfRange ? (
              <p className="field-error" role="alert">
                That is outside the range the server accepts.
              </p>
            ) : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="tz">
              Time zone
            </label>
            <select
              className="field-input"
              id="tz"
              value={tz}
              onChange={(event) => setTz(event.target.value)}
              aria-describedby="tz-note"
            >
              {timeZones(user.settings.tz).map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <p className="field-note" id="tz-note">
              Decides when your day rolls over — which is what the streak and the daily goal are
              counted against. Changing it mid-day can move both.
            </p>
          </div>
        </fieldset>

        <fieldset className="card glass settings-group">
          <legend className="card-title">Audio &amp; appearance</legend>

          <div className="field">
            <label className="field-label" htmlFor="speed">
              Audio speed — <span className="tabular">{audioSpeed.toFixed(2)}×</span>
            </label>
            <input
              className="field-range"
              id="speed"
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={audioSpeed}
              onChange={(event) => setAudioSpeed(Number(event.target.value))}
              aria-describedby="speed-note"
            />
            <p className="field-note" id="speed-note">
              Playback rate for pronunciation clips. Slower is the usual setting early on.
            </p>
          </div>

          <div className="field">
            <span className="field-label" id="theme-label">
              Theme
            </span>
            <div className="radio-row" role="radiogroup" aria-labelledby="theme-label">
              {THEMES.map((option) => (
                <label className="radio" key={option}>
                  <input
                    type="radio"
                    name="theme"
                    value={option}
                    checked={theme === option}
                    onChange={() => setTheme(option)}
                  />
                  <span>{option[0]?.toUpperCase() + option.slice(1)}</span>
                </label>
              ))}
            </div>
            {/*
              Said plainly rather than left to be discovered. The value is real
              and it is saved — the Android app reads it — but this site's
              stylesheet switches on `prefers-color-scheme` alone, so choosing
              "Dark" here does not repaint this page. A control that silently
              does nothing on the surface you are looking at is the thing worth
              avoiding; a control that says what it does is fine.
            */}
            <p className="field-note">
              Saved to your account and used by the mobile app. This site currently follows your
              system setting.
            </p>
          </div>
        </fieldset>

        <fieldset className="card glass settings-group">
          <legend className="card-title">Privacy</legend>

          <div className="field">
            <label className="check">
              <input
                type="checkbox"
                checked={leaderboardOptIn}
                onChange={(event) => setLeaderboardOptIn(event.target.checked)}
              />
              <span>Appear in the weekly leaderboard</span>
            </label>
            <p className="field-note">
              Off by default. Turning it off hides you from the next read onward — weeks that have
              already settled still contain you, because the snapshot records what happened.
            </p>
          </div>
        </fieldset>

        <div className="settings-actions">
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!dirty || goalOutOfRange || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>

          {/* `role="status"` rather than `role="alert"`: a save confirmation
              should be announced without interrupting. */}
          <p className="settings-status" role="status">
            {save.isError
              ? save.error instanceof Error
                ? save.error.message
                : 'That could not be saved.'
              : saved && !dirty
                ? 'Saved.'
                : dirty
                  ? 'Unsaved changes.'
                  : ''}
          </p>
        </div>
      </form>
    </div>
  );
}

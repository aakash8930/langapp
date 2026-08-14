import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { User } from '@/api/auth';
import { updateNotificationSettings, type NotificationSettingsPatch } from '@/api/notifications';
import { updateSettings, type SettingsPatch } from '@/api/settings';
import { fetchBlocked, unblockUser, type PublicProfile } from '@/api/social';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormError';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { errorText } from '@/lib/errors';
import { cancelStudyReminder, requestNotificationPermission, scheduleStudyReminder } from '@/lib/notifications';
import { useTheme, type ThemePreference } from '@/theme';

const THEME_OPTIONS: readonly Segment<ThemePreference>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Presets rather than a stepper. The server accepts 10–1000, but stepping from
 * 50 to 500 ten XP at a time is forty-five taps, and a number pad on a screen
 * with no other text input is its own small misery. The exact value is always
 * shown above, so a value set elsewhere still reads correctly.
 */
const GOAL_OPTIONS: readonly Segment<number>[] = [
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' },
];

/**
 * Off by default. Phase 2 §3.2 makes the weekly leaderboard opt-in, so a
 * learner who does not want a competitive surface does not see one. The
 * explicit "Off" label — rather than hiding the toggle until someone hunts for
 * it — is the difference between "I can switch this off" and "I never knew this
 * existed"; the second is why opt-in settings routinely end up not opted in.
 */
const LEADERBOARD_OPTIONS: readonly Segment<boolean>[] = [
  { value: false, label: 'Off' },
  { value: true, label: 'On' },
];

const TOGGLE_OPTIONS: readonly Segment<boolean>[] = [
  { value: false, label: 'Off' },
  { value: true, label: 'On' },
];

export default function Settings() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout, applyUser, refresh } = useAuth();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [reloading, setReloading] = useState(false);

  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  /**
   * Applies the change locally, then persists it.
   *
   * Optimistic because the theme is the visible one: tapping "Dark" has to
   * repaint on the tap, not a round trip later. On failure the previous user is
   * put back, so what is on screen always matches what the server holds.
   *
   * Controls are disabled while a save is in flight, which is what keeps that
   * true — two overlapping saves could otherwise roll back to a state that was
   * never current.
   */
  async function save(patch: SettingsPatch) {
    // Declared above the `!user` guard below, so the narrowing there does not
    // reach here — the check is real, not ceremonial.
    if (!user || saving) return;

    const previous = user;
    applyUser(withPatch(user, patch));
    setError(null);
    setSaving(true);

    try {
      applyUser(await updateSettings(patch));
      // The daily goal is the denominator of the progress ring on home.
      if (patch.dailyGoalXp !== undefined) {
        void queryClient.invalidateQueries({ queryKey: ['progress'] });
      }
    } catch (failure) {
      applyUser(previous);
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Same optimistic shape as `save` above, plus a side effect `save` never
   * has: `studyReminders` is the one field this app actually schedules a
   * device notification for (see `lib/notifications.ts`), so toggling it
   * on requests OS permission and toggling it off cancels the pending one.
   * A denial rolls the toggle back — a switch reading "on" while no
   * notification can ever fire is a lie the settings screen would be telling.
   */
  async function saveNotifications(patch: NotificationSettingsPatch) {
    if (!user || saving) return;

    const previous = user;
    applyUser(withNotificationsPatch(user, patch));
    setError(null);
    setSaving(true);

    try {
      applyUser(await updateNotificationSettings(patch));

      if (patch.studyReminders === true) {
        const granted = await requestNotificationPermission();
        if (granted) {
          await scheduleStudyReminder(user.onboardingState.preferredStudyTime || 'evening');
        } else {
          applyUser(await updateNotificationSettings({ studyReminders: false }));
          setError(
            new Error(
              'Notifications are turned off for this app in your phone’s settings. Turn them on there, then try again.',
            ),
          );
        }
      } else if (patch.studyReminders === false) {
        await cancelStudyReminder();
      }
    } catch (failure) {
      applyUser(previous);
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  function confirmLogout() {
    Alert.alert(
      'Log out?',
      'Your progress is saved on the server. You will need your password to sign back in.',
      [
        { text: 'Stay signed in', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: () => void logout() },
      ],
    );
  }

  async function reload() {
    if (reloading) return;
    setReloading(true);
    setError(null);
    try {
      await refresh();
    } catch (failure) {
      setError(failure);
    } finally {
      setReloading(false);
    }
  }

  /**
   * The app is allowed in without a profile when the API was unreachable at
   * launch — which keeps the rest of the app usable, but leaves this screen
   * with nothing to edit. Showing a form full of dashes would imply the
   * settings are simply blank; say what actually happened instead.
   *
   * Logging out still works: it only clears the Keychain, so it cannot fail on
   * a dead network.
   */
  if (!user) {
    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: theme.spacing.xl,
          paddingTop: insets.top + theme.spacing.xl,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.xl,
        }}
      >
        <ErrorState
          error={error ?? new Error('Your profile hasn’t loaded yet, so there is nothing to change here. Check that the API is running.')}
          onRetry={() => void reload()}
        />
        <Button label="Log out" variant="secondary" onPress={confirmLogout} />
        <Button label="Back to home" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: theme.spacing.xl,
        paddingTop: insets.top + theme.spacing.xl,
        paddingBottom: insets.bottom + theme.spacing.xxl,
        gap: theme.spacing.xxl,
      }}
    >
      <View style={{ gap: theme.spacing.md }}>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.heading,
            lineHeight: theme.lineHeight.heading,
            color: theme.colors.ink,
          }}
        >
          Settings
        </Text>
        {error ? <FormError message={errorText(error)} /> : null}
      </View>

      <Section
        title="Theme"
        hint="System follows your phone's light and dark setting."
      >
        <SegmentedControl
          label="Theme"
          options={THEME_OPTIONS}
          value={user.settings.theme}
          onChange={(next) => void save({ theme: next })}
          disabled={saving}
        />
      </Section>

      <Section
        title="Daily goal"
        hint={`${user.gamification.dailyGoalXp} XP a day. A review is worth 2 XP and finishing a new lesson 10.`}
      >
        <SegmentedControl
          label="Daily XP goal"
          options={GOAL_OPTIONS}
          value={user.gamification.dailyGoalXp}
          onChange={(next) => void save({ dailyGoalXp: next })}
          disabled={saving}
        />
      </Section>

      <Section
        title="Time zone"
        hint="Decides when your day rolls over, so it is what your streak counts against."
      >
        <Row label="Current" value={user.settings.tz} />
        {user.settings.tz !== deviceTz ? (
          <Button
            label={`Use ${deviceTz}`}
            variant="secondary"
            onPress={() => void save({ tz: deviceTz })}
            disabled={saving}
          />
        ) : (
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.small,
              lineHeight: theme.lineHeight.small,
              color: theme.colors.inkSoft,
            }}
          >
            Matches this device.
          </Text>
        )}
      </Section>

      <Section
        title="Weekly leaderboard"
        hint="When on, your weekly XP appears in the leaderboard and you can see other opted-in learners. Off by default — turning it on is opt-in, not the other way round."
      >
        <SegmentedControl
          label="Weekly leaderboard"
          options={LEADERBOARD_OPTIONS}
          value={user.settings.leaderboardOptIn}
          onChange={(next) => void save({ leaderboardOptIn: next })}
          disabled={saving}
        />
      </Section>

      <Section
        title="Study reminders"
        hint="A daily notification around the time you set during setup, if you haven’t studied yet that day."
      >
        <SegmentedControl
          label="Study reminders"
          options={TOGGLE_OPTIONS}
          value={user.notificationSettings.studyReminders}
          onChange={(next) => void saveNotifications({ studyReminders: next })}
          disabled={saving}
        />
      </Section>

      <Section title="Other notifications">
        <NotificationToggleRow
          label="Achievements"
          value={user.notificationSettings.achievements}
          onChange={(next) => void saveNotifications({ achievements: next })}
          disabled={saving}
        />
        <NotificationToggleRow
          label="Friends & messages"
          value={user.notificationSettings.community}
          onChange={(next) => void saveNotifications({ community: next })}
          disabled={saving}
        />
        <NotificationToggleRow
          label="Product updates"
          value={user.notificationSettings.eventsUpdates}
          onChange={(next) => void saveNotifications({ eventsUpdates: next })}
          disabled={saving}
        />
        <NotificationToggleRow
          label="Marketing"
          value={user.notificationSettings.marketing}
          onChange={(next) => void saveNotifications({ marketing: next })}
          disabled={saving}
        />
      </Section>

      <Section title="Blocked people">
        <BlockedList />
      </Section>

      <Section title="Legal">
        <Button
          label="Privacy policy"
          variant="secondary"
          onPress={() => router.push('/legal/privacy')}
        />
        <Button
          label="Terms of service"
          variant="secondary"
          onPress={() => router.push('/legal/terms')}
        />
      </Section>

      <Section title="Account">
        <Row label="Signed in as" value={user.email} />
        <Button
          label="Change password"
          variant="secondary"
          onPress={() => router.push('/settings/change-password')}
        />
        <Button label="Log out" variant="secondary" onPress={confirmLogout} />
        <Button
          label="Delete account"
          variant="secondary"
          onPress={() => router.push('/settings/delete-account')}
        />
      </Section>

      <Button label="Back to home" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

/**
 * A compact label + on/off row, for the four lower-stakes notification
 * categories that don't each need their own full-width control and hint the
 * way "Study reminders" above does — that one gets the space because it's
 * the one this app actually schedules a device notification for.
 */
function NotificationToggleRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <Text style={{ flex: 1, fontFamily: theme.families.ui, fontSize: theme.fontSize.body, color: theme.colors.ink }}>
        {label}
      </Text>
      <SegmentedControl label={label} options={TOGGLE_OPTIONS} value={value} onChange={onChange} disabled={disabled} />
    </View>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.caption,
          color: theme.colors.inkSoft,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {title}
      </Text>
      {children}
      {hint ? (
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.small,
            lineHeight: theme.lineHeight.small,
            color: theme.colors.inkSoft,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: theme.hairlineWidth,
        borderBottomColor: theme.colors.hairline,
      }}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          color: theme.colors.inkSoft,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          color: theme.colors.ink,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * The locally-applied version of a patch. `PATCH /me/settings` returns the whole
 * user, so this only has to be right until the response lands.
 */
function withPatch(user: User, patch: SettingsPatch): User {
  return {
    ...user,
    gamification:
      patch.dailyGoalXp === undefined
        ? user.gamification
        : { ...user.gamification, dailyGoalXp: patch.dailyGoalXp },
    settings: {
      ...user.settings,
      ...(patch.theme === undefined ? {} : { theme: patch.theme }),
      ...(patch.tz === undefined ? {} : { tz: patch.tz }),
      ...(patch.audioSpeed === undefined ? {} : { audioSpeed: patch.audioSpeed }),
      ...(patch.leaderboardOptIn === undefined
        ? {}
        : { leaderboardOptIn: patch.leaderboardOptIn }),
    },
  };
}

/** The locally-applied version of a notification-settings patch, same shape as `withPatch`. */
function withNotificationsPatch(user: User, patch: NotificationSettingsPatch): User {
  return {
    ...user,
    notificationSettings: { ...user.notificationSettings, ...patch },
  };
}

/**
 * The people this learner has blocked, and the only way to undo it.
 *
 * Settings is the right home for this and the block button is not: blocking
 * happens in the heat of a conversation, unblocking is a considered act done
 * later. A block with no visible undo is a trap — you would have to remember the
 * person's name and search for someone the search deliberately hides from you.
 *
 * Silent when empty and when it fails. Most people will never block anyone, and
 * an error banner about a list that is almost always empty would be noise on a
 * screen that is mostly about themes and timezones.
 */
function BlockedList() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const blocked = useQuery({ queryKey: ['blocked'], queryFn: fetchBlocked, staleTime: 0 });

  const unblock = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['blocked'] }),
  });

  if (blocked.isPending || blocked.isError) return null;

  if (blocked.data.length === 0) {
    return (
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: theme.colors.inkSoft,
        }}
      >
        You have not blocked anyone.
      </Text>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {blocked.data.map((person: PublicProfile) => (
        <View
          key={person.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <Text
            style={{
              flexShrink: 1,
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              color: theme.colors.ink,
            }}
          >
            {person.displayName}
          </Text>
          <Pressable
            onPress={() =>
              Alert.alert(
                `Unblock ${person.displayName}?`,
                'They will be able to send you a friend request again. You will not become friends automatically.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Unblock', onPress: () => unblock.mutate(person.id) },
                ],
              )
            }
            accessibilityRole="button"
            accessibilityLabel={`Unblock ${person.displayName}`}
            hitSlop={theme.spacing.md}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text
              style={{
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.body,
                color: theme.colors.ai,
              }}
            >
              Unblock
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

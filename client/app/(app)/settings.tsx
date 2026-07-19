import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { User } from '@/api/auth';
import { updateSettings, type SettingsPatch } from '@/api/settings';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormError';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { errorText } from '@/lib/errors';
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

      <Section title="Account">
        <Row label="Signed in as" value={user.email} />
        <Button label="Log out" variant="secondary" onPress={confirmLogout} />
      </Section>

      <Button label="Back to home" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
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
    },
  };
}

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local, device-scheduled study reminders — not server push.
 *
 * The backend has an in-app notification inbox (`api/notifications.ts`) and a
 * `ReminderProcessor` that *creates* reminder records server-side, but nothing
 * anywhere sends an actual OS-level push: no push-token storage on the user
 * model, no `expo-server-sdk`, no APNs/FCM wiring. Building that is a real,
 * separate backend feature (token registration endpoint, credentials,
 * `expo-server-sdk` as a new *server* dependency) — out of scope here.
 *
 * `expo-notifications` also does local scheduling, which needs none of that:
 * the OS fires the notification itself, on-device, on a repeating daily
 * trigger, with no server round trip. That is the whole of what this file
 * does, and it is a genuine "you get a push notification" experience even
 * though no server ever sends one.
 */

const CHANNEL_ID = 'study-reminders';
const REMINDER_IDENTIFIER = 'study-reminder-daily';

/**
 * Mirrors `PREFERRED_TIME_MAP` in `api/src/notification/reminder.processor.ts`
 * exactly, key for key — the in-app reminder and this local one should fire
 * around the same hour, not disagree about what "evening" means. That file's
 * map has no 'any' entry either; both fall through to the same 19:00 default.
 */
const PREFERRED_TIME_HOUR: Record<string, number> = {
  morning: 8,
  afternoon: 14,
  evening: 19,
  night: 21,
};
const DEFAULT_HOUR = 19;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Study reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Resolves `false` without prompting if permission was already denied — asking twice reads as nagging. */
export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Cancels any existing reminder and schedules a new one — the fixed
 * `identifier` is what makes this replace rather than pile up a second daily
 * notification every time the preferred study time changes.
 */
export async function scheduleStudyReminder(preferredStudyTime: string): Promise<void> {
  await ensureAndroidChannel();
  const hour = PREFERRED_TIME_HOUR[preferredStudyTime.toLowerCase()] ?? DEFAULT_HOUR;

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_IDENTIFIER,
    content: {
      title: 'Time to study',
      body: 'Keep your streak alive — a few minutes of Japanese today.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelStudyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER).catch(() => {
    // Nothing was scheduled — cancelling a no-op reminder is not a failure.
  });
}

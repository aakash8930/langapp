import type { User } from './auth';
import { api } from './client';

export type NotificationType = 'reminder' | 'achievement' | 'social' | 'system';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPage = {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
};

/** `GET /me/notifications`. Server caps `limit` at 50 regardless of what's asked for. */
export function fetchNotifications(page = 1): Promise<NotificationPage> {
  return api.get(`/me/notifications?page=${page}&limit=20`);
}

export function fetchUnreadCount(): Promise<{ count: number }> {
  return api.get('/me/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<{ success: boolean }> {
  return api.patch(`/me/notifications/${id}/read`, {});
}

export function markAllNotificationsRead(): Promise<{ marked: number }> {
  return api.post('/me/notifications/mark-all-read');
}

/** Mirrors `UpdateNotificationSettingsDto` in `api/src/user/dto/update-notification-settings.dto.ts`. */
export type NotificationSettingsPatch = {
  studyReminders?: boolean;
  achievements?: boolean;
  community?: boolean;
  eventsUpdates?: boolean;
  marketing?: boolean;
  emailDailyGoal?: boolean;
  emailWeeklyDigest?: boolean;
  emailMarketing?: boolean;
};

/** Returns the whole user, same contract as `updateSettings` and `updateOnboarding` — replace, don't merge. */
export function updateNotificationSettings(patch: NotificationSettingsPatch): Promise<User> {
  return api.patch<User>('/me/settings/notifications', patch);
}

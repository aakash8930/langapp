import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  updateNotificationSettings,
  type NotificationItem,
  type NotificationSettingsShape,
} from '../../api';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { Icon } from '../ui/Icon';
import { NotificationCard } from './NotificationCard';
import './notifications.css';

type Tab = 'all' | 'unread' | 'mentions' | 'system';

function groupByDate(items: NotificationItem[]) {
  const groups: { label: string; items: NotificationItem[] }[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const todays: NotificationItem[] = [];
  const yesterdays: NotificationItem[] = [];
  const thisWeeks: NotificationItem[] = [];
  const earlier: NotificationItem[] = [];

  for (const item of items) {
    const d = new Date(item.createdAt);
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

export function NotificationCenter() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const user = session.state === 'signedIn' ? session.user : null;
  const notifSettings = user?.notificationSettings as NotificationSettingsShape | undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.notifications.list({ tab: activeTab }),
    queryFn: () =>
      fetchNotifications({
        type: activeTab === 'mentions' ? 'community' : activeTab === 'system' ? 'system' : undefined,
        read: activeTab === 'unread' ? false : undefined,
        limit: 50,
      }),
    enabled: session.state === 'signedIn',
  });

  const items = data?.items ?? [];
  const groups = groupByDate(items);
  const totalUnread = items.filter((i) => !i.read).length;

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
    },
  });

  const updateSettings = useMutation({
    mutationFn: (patch: Partial<NotificationSettingsShape>) =>
      updateNotificationSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.session.me });
    },
  });

  if (session.state === 'loading') {
    return (
      <div className="notif-page">
        <p className="placeholder-note">Loading...</p>
      </div>
    );
  }

  if (session.state === 'signedOut') {
    return (
      <div className="notif-page">
        <p className="placeholder-note">Sign in to see your notifications.</p>
      </div>
    );
  }

  return (
    <div className="notif-page">
      <div className="notif-main">
        <div className="notif-header">
          <div>
            <h1 className="notif-title">Notifications</h1>
            <p className="notif-subtitle">Stay updated with your learning journey.</p>
          </div>
        </div>

        <div className="notif-tabs">
          {([
            ['all', 'All'],
            ['unread', 'Unread'],
            ['mentions', 'Mentions'],
            ['system', 'System'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              className={`notif-tab ${activeTab === tab ? 'notif-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
          {totalUnread > 0 && (
            <button
              type="button"
              className="notif-mark-all"
              onClick={() => markAllRead.mutate()}
            >
              <Icon name="check" size={14} />
              Mark all as read
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="notif-feed">
            <p className="placeholder-note">Loading notifications...</p>
          </div>
        ) : isError ? (
          <div className="notif-feed">
            <p className="placeholder-note">Something went wrong.</p>
            <button className="btn btn-secondary" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="notif-feed">
            <div className="notif-empty">
              <Icon name="bell" size={32} />
              <p>No notifications yet.</p>
              <p className="placeholder-note">
                You'll see study reminders, achievements, and community updates here.
              </p>
            </div>
          </div>
        ) : (
          <div className="notif-feed">
            {groups.map((group) => (
              <div key={group.label} className="notif-group">
                <h2 className="notif-group-label">{group.label}</h2>
                {group.items.map((item) => (
                  <NotificationCard key={item.id} item={item} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="notif-sidebar glass">
        <h2 className="notif-sidebar-title">Notification Settings</h2>

        <div className="notif-settings-list">
          {([
            ['studyReminders', 'Study Reminders', 'Remind me to practice daily'],
            ['achievements', 'Achievements', 'Streak milestones and level-ups'],
            ['community', 'Community', 'Friend requests, messages, and replies'],
            ['eventsUpdates', 'Events & Updates', 'New lessons, challenges, and features'],
            ['marketing', 'Marketing', 'Tips, offers and product updates'],
          ] as const).map(([key, label, desc]) => (
            <label key={key} className="notif-setting-row">
              <div className="notif-setting-info">
                <span className="notif-setting-label">{label}</span>
                <span className="notif-setting-desc">{desc}</span>
              </div>
              <input
                type="checkbox"
                className="notif-toggle"
                checked={notifSettings?.[key] ?? false}
                onChange={(e) =>
                  updateSettings.mutate({ [key]: e.target.checked } as Partial<NotificationSettingsShape>)
                }
              />
            </label>
          ))}

          <div className="notif-setting-separator" />
          <h3 className="notif-setting-section">Email Preferences</h3>

          {([
            ['emailDailyGoal', 'Daily Goal Reminder', 'A summary of your daily progress'],
            ['emailWeeklyDigest', 'Weekly Digest', 'Your week in review'],
            ['emailMarketing', 'Marketing Emails', 'Product news and offers'],
          ] as const).map(([key, label, desc]) => (
            <label key={key} className="notif-setting-row">
              <div className="notif-setting-info">
                <span className="notif-setting-label">{label}</span>
                <span className="notif-setting-desc">{desc}</span>
              </div>
              <input
                type="checkbox"
                className="notif-toggle"
                checked={notifSettings?.[key] ?? false}
                onChange={(e) =>
                  updateSettings.mutate({ [key]: e.target.checked } as Partial<NotificationSettingsShape>)
                }
              />
            </label>
          ))}
        </div>

        <div className="notif-stats">
          <div className="notif-stat">
            <span className="notif-stat-value">{data?.total ?? 0}</span>
            <span className="notif-stat-label">Total</span>
          </div>
          <div className="notif-stat">
            <span className="notif-stat-value">{totalUnread}</span>
            <span className="notif-stat-label">Unread</span>
          </div>
          <div className="notif-stat">
            <span className="notif-stat-value">
              {items.filter((i) => new Date(i.createdAt) >= new Date(new Date().setHours(0, 0, 0, 0))).length}
            </span>
            <span className="notif-stat-label">Today</span>
          </div>
        </div>

        <div className="notif-delivery-note">
          <p className="notif-setting-section">Delivery channels</p>
          <p><strong>In-app notifications</strong> are available through this center.</p>
          <p><strong>Push reminders and quiet hours</strong> need device registration, permission handling, timezone-aware scheduling, and a server delivery worker. They are not simulated with a browser-only toggle.</p>
          <p>Every delivery channel should be decided centrally from user preferences, priority, quiet hours, and recent sends—not independently by each learning feature.</p>
        </div>
      </div>
    </div>
  );
}

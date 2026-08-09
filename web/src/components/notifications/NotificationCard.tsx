import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markNotificationRead } from '../../api';
import type { NotificationItem } from '../../api';
import { queryKeys } from '../../queryKeys';
import { Icon, type IconName } from '../ui/Icon';

const TYPE_ICONS: Record<string, IconName> = {
  achievement: 'award',
  streak: 'flame',
  goal: 'check',
  community: 'users',
  course: 'book-open',
  system: 'shield',
  reminder: 'bell',
  event: 'zap',
  marketing: 'zap',
};

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NotificationCard({ item }: { item: NotificationItem }) {
  const queryClient = useQueryClient();
  const iconName = TYPE_ICONS[item.type] ?? 'bell';

  const markRead = useMutation({
    mutationFn: () => markNotificationRead(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
    },
  });

  return (
    <div
      className={`notif-item ${!item.read ? 'notif-item--unread' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!item.read) markRead.mutate();
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !item.read) {
          e.preventDefault();
          markRead.mutate();
        }
      }}
    >
      <div className={`notif-item-icon notif-icon--${item.type}`}>
        <Icon name={iconName} size={18} />
      </div>
      <div className="notif-item-content">
        <div className="notif-item-head">
          <span className="notif-item-title">{item.title}</span>
          {!item.read && <span className="notif-item-dot" aria-hidden="true" />}
        </div>
        <p className="notif-item-body">{item.body}</p>
        <div className="notif-item-meta">
          <span className="notif-item-tag">{item.type}</span>
          <span className="notif-item-time">{relativeTime(item.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

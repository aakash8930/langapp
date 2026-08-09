import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { fetchUnreadCount, type UnreadCountResponse } from '../../api';
import { queryKeys } from '../../queryKeys';
import { Icon } from '../ui/Icon';

export function NotificationBell() {
  const router = useRouter();

  const { data, isLoading } = useQuery<UnreadCountResponse>({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
  });

  const count = data?.count ?? 0;
  const hasUnread = count > 0;

  return (
    <section className="card notification-card glass" aria-labelledby="notification-heading">
      <div className="placeholder-head">
        <h2 className="card-title" id="notification-heading">
          <span className="card-title-icon" aria-hidden="true">
            <Icon name="bell" size={18} aria-label="Notifications" />
          </span>
          Notifications
          {hasUnread && (
            <span className="notif-badge" aria-label={`${count} unread`}>
              {count > 99 ? '99+' : count}
            </span>
          )}
        </h2>
      </div>
      {isLoading ? (
        <p className="placeholder-note">Loading...</p>
      ) : hasUnread ? (
        <p className="placeholder-note">
          You have {count} unread notification{count !== 1 ? 's' : ''}.
        </p>
      ) : (
        <p className="placeholder-note">No new notifications.</p>
      )}
      <button
        className="btn btn-secondary"
        style={{ marginTop: 'auto', fontSize: 'var(--text-small)' }}
        onClick={() => router.navigate({ to: '/notifications' })}
      >
        View all
      </button>
    </section>
  );
}

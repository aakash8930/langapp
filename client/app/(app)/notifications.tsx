import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '@/api/notifications';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton, SkeletonGroup } from '@/components/Skeleton';
import { useTheme } from '@/theme';

export default function Notifications() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(),
    staleTime: 0,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notificationsUnread'] });
    },
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notificationsUnread'] });
    },
  });

  const hasUnread = (query.data?.items ?? []).some((n) => !n.read);

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: theme.spacing.xl,
        paddingTop: insets.top + theme.spacing.xl,
        paddingBottom: insets.bottom + theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.lg }}>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.heading,
            lineHeight: theme.lineHeight.heading,
            color: theme.colors.ink,
          }}
        >
          Notifications
        </Text>
        {hasUnread ? (
          <Pressable
            onPress={() => markAll.mutate()}
            disabled={markAll.isPending}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            hitSlop={theme.spacing.md}
            style={({ pressed }) => ({ opacity: markAll.isPending ? 0.5 : pressed ? 0.6 : 1 })}
          >
            <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.body, color: theme.colors.ai }}>
              Mark all read
            </Text>
          </Pressable>
        ) : null}
      </View>

      {query.isPending ? (
        <SkeletonGroup label="Loading notifications" fill>
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </SkeletonGroup>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} onDismiss={() => router.back()} />
      ) : query.data.items.length === 0 ? (
        <EmptyNotifications />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {query.data.items.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onPress={() => {
                if (!notification.read) markRead.mutate(notification.id);
              }}
            />
          ))}
        </View>
      )}

      <Button label="Back" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

function EmptyNotifications() {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.md }}>
      <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.bodyLarge, color: theme.colors.ink }}>
        Nothing here yet
      </Text>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: theme.colors.inkSoft,
        }}
      >
        Reminders and updates will show up here.
      </Text>
    </View>
  );
}

function NotificationRow({ notification, onPress }: { notification: Notification; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={notification.read}
      accessibilityRole="button"
      accessibilityLabel={`${notification.title}. ${notification.body}${notification.read ? '' : '. Unread.'}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        borderRadius: theme.radius.md,
        borderWidth: theme.hairlineWidth,
        borderColor: theme.colors.hairline,
        backgroundColor: theme.colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 8,
          height: 8,
          marginTop: 6,
          borderRadius: theme.radius.pill,
          backgroundColor: notification.read ? 'transparent' : theme.colors.shu,
        }}
      />
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            color: theme.colors.ink,
          }}
        >
          {notification.title}
        </Text>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.small,
            lineHeight: theme.lineHeight.small,
            color: theme.colors.inkSoft,
          }}
        >
          {notification.body}
        </Text>
        <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.caption, color: theme.colors.inkSoft }}>
          {relativeTime(notification.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

/** No shared date-formatting helper exists yet in this app; small enough to keep local rather than start one for a single caller. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMinutes = Math.max(0, Math.round((Date.now() - then) / 60_000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString();
}

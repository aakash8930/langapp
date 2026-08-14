import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

/** Header entry point for the notification inbox. Badge styling matches `FriendsCallout`'s pending-request pill. */
export function NotificationsLink({ unreadCount, onPress }: { unreadCount: number; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Notifications. ${unreadCount} unread.` : 'Notifications'}
      hitSlop={theme.spacing.md}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.body, color: theme.colors.ai }}>
        Alerts
      </Text>
      {unreadCount > 0 ? (
        <View
          style={{
            minWidth: theme.spacing.xl,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.shu,
            alignItems: 'center',
          }}
        >
          <Text
            style={[
              { fontFamily: theme.families.ui, fontSize: theme.fontSize.caption, color: theme.colors.paper },
              theme.tabularFigures,
            ]}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

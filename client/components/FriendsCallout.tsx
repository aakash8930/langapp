import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * The way into the friends screen from home.
 *
 * Shaped like `ChatCallout` on purpose — both are "another place to practise",
 * and two calling cards that look unrelated would make the home screen feel like
 * two apps. Hairline and surface rather than the vermilion of the continue card,
 * because the lesson is still the primary action here and this must not compete
 * with it.
 *
 * The pending-request count is the whole reason this carries a badge: a friend
 * request that nobody sees is a friend request that never gets accepted.
 */
export function FriendsCallout({
  pendingRequests,
  onPress,
}: {
  pendingRequests: number;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        pendingRequests > 0
          ? `Friends. ${pendingRequests} pending ${pendingRequests === 1 ? 'request' : 'requests'}.`
          : 'Friends — practise with other learners'
      }
      style={({ pressed }) => ({
        borderWidth: theme.hairlineWidth,
        borderColor: theme.colors.hairline,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.xl,
        gap: theme.spacing.xs,
        backgroundColor: theme.colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.bodyLarge,
            color: theme.colors.ink,
          }}
        >
          Friends
        </Text>

        {pendingRequests > 0 ? (
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
                {
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.caption,
                  color: theme.colors.paper,
                },
                theme.tabularFigures,
              ]}
            >
              {pendingRequests}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: theme.colors.inkSoft,
        }}
      >
        {pendingRequests > 0
          ? `${pendingRequests} ${pendingRequests === 1 ? 'person wants' : 'people want'} to be friends`
          : 'Practise with other learners, not just the tutor'}
      </Text>
    </Pressable>
  );
}

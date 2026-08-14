import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useTheme } from '@/theme';

const FEATURES = [
  {
    mark: '再',
    title: 'Spaced repetition that adapts to you',
    body: 'Every card is scheduled by FSRS off your own answers, not a fixed calendar.',
  },
  {
    mark: '話',
    title: 'An AI tutor for real conversation',
    body: 'Practice scenarios in Japanese and get feedback on grammar and word choice.',
  },
  {
    mark: '字',
    title: 'Kana, kanji and grammar from zero',
    body: 'One connected path — each new character and rule builds on what you already know.',
  },
] as const;

/**
 * The first screen a signed-out phone shows — `(app)/_layout.tsx` redirects
 * here now instead of straight to `/login`. Before this existed, opening the
 * app cold showed a bare sign-in form with no word of what it was signing
 * into.
 *
 * Plain and static like `login.tsx`/`register.tsx`, which is a deliberate
 * match rather than an oversight — this is the same Stack, and a screen that
 * animates in front of two that don't would read as the odd one out.
 */
export default function Welcome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        padding: theme.spacing.xl,
        paddingTop: insets.top + theme.spacing.xxl,
        paddingBottom: insets.bottom + theme.spacing.xl,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ gap: theme.spacing.xxl }}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              fontFamily: theme.families.jaBold,
              fontSize: 44,
              lineHeight: 52,
              color: theme.colors.ink,
            }}
          >
            言
          </Text>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.title,
              color: theme.colors.ink,
              letterSpacing: 1,
            }}
          >
            langapp
          </Text>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              lineHeight: theme.lineHeight.body,
              color: theme.colors.inkSoft,
            }}
          >
            Your Japanese learning space.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
              <Text
                style={{
                  fontFamily: theme.families.jaMedium,
                  fontSize: theme.fontSize.title,
                  lineHeight: theme.lineHeight.title,
                  color: theme.colors.shu,
                  width: 32,
                }}
              >
                {feature.mark}
              </Text>
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <Text
                  style={{
                    fontFamily: theme.families.ui,
                    fontSize: theme.fontSize.body,
                    lineHeight: theme.lineHeight.body,
                    color: theme.colors.ink,
                  }}
                >
                  {feature.title}
                </Text>
                <Text
                  style={{
                    fontFamily: theme.families.ui,
                    fontSize: theme.fontSize.small,
                    lineHeight: theme.lineHeight.small,
                    color: theme.colors.inkSoft,
                  }}
                >
                  {feature.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Button label="Create account" onPress={() => router.push('/register')} />
        <Button label="Sign in" variant="secondary" onPress={() => router.push('/login')} />
      </View>
    </View>
  );
}

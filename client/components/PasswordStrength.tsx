import { Text, View } from 'react-native';

import { PASSWORD_RULES, passwordScore, type PasswordLevel } from '@/lib/auth-form';
import { useTheme } from '@/theme';

/**
 * Live password-strength suggestions matching the web signup. These checks do
 * not gate registration; the API contract requires only 8–128 characters.
 */
export function PasswordStrength({ password }: { password: string }) {
  const theme = useTheme();
  if (!password) return null;

  const score = passwordScore(password);
  const fillColor = levelColor(score.level, theme);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          height: 4,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.hairline,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${(score.passed / score.total) * 100}%`,
            backgroundColor: fillColor,
            borderRadius: theme.radius.pill,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.small, color: fillColor }}>
          {score.label}
        </Text>
        <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.small, color: theme.colors.inkSoft }}>
          {`${score.passed}/${score.total}`}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        {PASSWORD_RULES.map((rule) => {
          const passed = rule.test(password);
          return (
            <View key={rule.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Text
                style={{
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.small,
                  color: passed ? theme.colors.ai : theme.colors.inkSoft,
                  width: 14,
                }}
              >
                {passed ? '✓' : '·'}
              </Text>
              <Text
                style={{
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.small,
                  color: passed ? theme.colors.ink : theme.colors.inkSoft,
                }}
              >
                {rule.label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.small,
          color: theme.colors.inkSoft,
        }}
      >
        Suggestions improve strength; only the 8-character minimum is required.
      </Text>
    </View>
  );
}

function levelColor(level: PasswordLevel, theme: ReturnType<typeof useTheme>): string {
  switch (level) {
    case 'weak':
      return theme.colors.danger;
    case 'fair':
      return theme.colors.inkSoft;
    case 'strong':
      return theme.colors.ai;
    default:
      return theme.colors.inkSoft;
  }
}

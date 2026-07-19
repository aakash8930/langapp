import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { describeError } from '@/lib/errors';
import { useTheme } from '@/theme';

/**
 * A whole-screen failure: what happened, what to do, and a way to do it.
 *
 * Distinct from `FormError`, which is a one-line inline note beside a field or
 * a control. This one takes the space a screen's content would have taken,
 * because when it shows there is no content.
 */
export function ErrorState({
  error,
  onRetry,
  onDismiss,
  dismissLabel = 'Back to home',
}: {
  error: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const theme = useTheme();
  const { title, body, retryable } = describeError(error);

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ gap: theme.spacing.md }}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.title,
          lineHeight: theme.lineHeight.title,
          color: theme.colors.ink,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: theme.colors.inkSoft,
        }}
      >
        {body}
      </Text>

      <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}>
        {/* Offered whenever a retry could plausibly help — withholding the
            button on a 400 is kinder than letting someone tap it forever. */}
        {onRetry && retryable ? <Button label="Try again" onPress={onRetry} /> : null}
        {onDismiss ? (
          <Button label={dismissLabel} variant="secondary" onPress={onDismiss} />
        ) : null}
      </View>
    </View>
  );
}

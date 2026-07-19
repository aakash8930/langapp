import { forwardRef, useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

type Props = TextInputProps & {
  label: string;
  /** Shown under the field until an error replaces it. */
  hint?: string;
  /** What went wrong and how to fix it. Never a bare "Invalid". */
  error?: string;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, hint, error, style, onFocus, onBlur, ...props },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  // Error outranks focus: a field you are fixing should keep showing that it
  // needs fixing while you type in it.
  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.shu
      : theme.colors.hairline;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.small,
          color: theme.colors.inkSoft,
        }}
      >
        {label}
      </Text>

      <TextInput
        ref={ref}
        // The visible <Text> above is not associated with the input by any
        // platform mechanism — without this a screen reader reads the field as
        // an unlabelled edit box. The hint carries the error, so the reason a
        // field is rejected is available on focus and not only by hunting for
        // the red line underneath it.
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        style={[
          {
            height: theme.controlHeight,
            borderColor,
            // A focused field gets a real 1pt rule; everything else stays at a
            // true hairline. This is the only weight change in the app.
            borderWidth: focused || error ? 1 : theme.hairlineWidth,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.spacing.lg,
            backgroundColor: theme.colors.surface,
            color: theme.colors.ink,
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.bodyLarge,
          },
          style,
        ]}
        placeholderTextColor={theme.colors.inkSoft}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...props}
      />

      {(error ?? hint) ? (
        <Text
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.small,
            lineHeight: theme.lineHeight.small,
            color: error ? theme.colors.danger : theme.colors.inkSoft,
          }}
        >
          {error ?? hint}
        </Text>
      ) : null}
    </View>
  );
});

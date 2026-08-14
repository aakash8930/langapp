import { Link, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/Button';
import { FormError } from '@/components/FormError';
import { TextField } from '@/components/TextField';
import { authErrorMessage, validateEmail, validateLoginPassword } from '@/lib/auth-form';
import { useTheme } from '@/theme';

export default function Login() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  // Set by `forgot-password.tsx` on `router.replace` after a successful reset
  // — that endpoint returns no session, so landing back here signed-out is
  // the whole flow, and this is the only place its outcome is still visible.
  const { resetSuccess } = useLocalSearchParams<{ resetSuccess?: string }>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const nextEmailError = validateEmail(email);
    const nextPasswordError = validateLoginPassword(password);

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError(undefined);

    if (nextEmailError || nextPasswordError) return;

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      // No navigation here — the session flips to authenticated and the
      // (auth) layout redirects. One owner for that decision.
    } catch (error) {
      setFormError(authErrorMessage(error, 'login'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: theme.spacing.xl,
          paddingTop: insets.top + theme.spacing.xl,
          paddingBottom: insets.bottom + theme.spacing.xl,
          gap: theme.spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.heading,
              lineHeight: theme.lineHeight.heading,
              color: theme.colors.ink,
            }}
          >
            Sign in
          </Text>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              lineHeight: theme.lineHeight.body,
              color: theme.colors.inkSoft,
            }}
          >
            {resetSuccess ? 'Password reset. Sign in with your new password.' : 'Pick up where you left off.'}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <TextField
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (emailError) setEmailError(undefined);
            }}
            error={emailError}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!submitting}
          />

          <TextField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (passwordError) setPasswordError(undefined);
            }}
            error={passwordError}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            editable={!submitting}
          />

          <Link href="/forgot-password" asChild>
            <Text
              accessibilityRole="link"
              style={{
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.small,
                color: theme.colors.ai,
                alignSelf: 'flex-end',
                // Padding takes this past a 44pt target the same way the
                // "Create an account" link below does.
                paddingVertical: theme.spacing.sm,
              }}
            >
              Forgot password?
            </Text>
          </Link>

          {formError ? <FormError message={formError} /> : null}
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <Button label="Sign in" onPress={() => void submit()} loading={submitting} />

          <Link href="/register" asChild>
            <Text
              accessibilityRole="link"
              style={{
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.body,
                color: theme.colors.ai,
                textAlign: 'center',
                // A bare line of text is a ~20pt target. The padding is what
                // takes it past 44pt; there is no box drawn around it.
                paddingVertical: theme.spacing.md,
              }}
            >
              Create an account
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

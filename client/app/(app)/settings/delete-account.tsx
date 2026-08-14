import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteAccount } from '@/api/auth';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/Button';
import { FormError } from '@/components/FormError';
import { TextField } from '@/components/TextField';
import { accountActionErrorMessage } from '@/lib/auth-form';
import { useTheme } from '@/theme';

export default function DeleteAccount() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();

  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  function confirm() {
    const nextPasswordError = password ? undefined : 'Enter your password.';
    setPasswordError(nextPasswordError);
    setFormError(undefined);
    if (nextPasswordError) return;

    // A password field is not itself the confirmation — it proves who is
    // asking, not that they meant to. The account and every review, streak
    // and message it holds is gone the moment the request lands, with
    // nothing to undo it, so the destructive step gets its own explicit tap.
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account, progress, streak and messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => void submit() },
      ],
    );
  }

  async function submit() {
    setSubmitting(true);
    try {
      await deleteAccount(password);
      // The server has already dropped the user document and revoked every
      // session; this is the same local-only Keychain clear `logout` does,
      // not a second request against an account that no longer exists.
      await logout();
    } catch (error) {
      setFormError(accountActionErrorMessage(error));
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
            Delete account
          </Text>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              lineHeight: theme.lineHeight.body,
              color: theme.colors.inkSoft,
            }}
          >
            Permanently deletes your account, progress, streak and messages. This cannot be undone.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <TextField
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (passwordError) setPasswordError(undefined);
            }}
            error={passwordError}
            hint="Confirms it’s you before we delete anything."
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={confirm}
            editable={!submitting}
            autoFocus
          />

          {formError ? <FormError message={formError} /> : null}
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <Button label="Delete account" onPress={confirm} loading={submitting} />
          <Button label="Cancel" variant="secondary" onPress={() => router.back()} disabled={submitting} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

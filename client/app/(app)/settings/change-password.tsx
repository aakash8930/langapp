import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { changePassword } from '@/api/auth';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/Button';
import { FormError } from '@/components/FormError';
import { TextField } from '@/components/TextField';
import { accountActionErrorMessage, validateNewPassword } from '@/lib/auth-form';
import { useTheme } from '@/theme';

export default function ChangePassword() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const newPasswordRef = useRef<TextInput>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState<string>();
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const nextCurrentError = currentPassword ? undefined : 'Enter your current password.';
    const nextNewError = validateNewPassword(newPassword);
    setCurrentPasswordError(nextCurrentError);
    setNewPasswordError(nextNewError);
    setFormError(undefined);
    if (nextCurrentError || nextNewError) return;

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      // The server revokes every session — this device's tokens included —
      // the moment the password changes. Signing back in with the new one is
      // the only way forward, so this is the same local-only clear `logout`
      // already does, not a second request.
      await logout();
      Alert.alert('Password changed', 'Sign in with your new password.');
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
            Change password
          </Text>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              lineHeight: theme.lineHeight.body,
              color: theme.colors.inkSoft,
            }}
          >
            You will be signed out of every device, this one included.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <TextField
            label="Current password"
            value={currentPassword}
            onChangeText={(value) => {
              setCurrentPassword(value);
              if (currentPasswordError) setCurrentPasswordError(undefined);
            }}
            error={currentPasswordError}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="next"
            onSubmitEditing={() => newPasswordRef.current?.focus()}
            editable={!submitting}
            autoFocus
          />

          <TextField
            ref={newPasswordRef}
            label="New password"
            value={newPassword}
            onChangeText={(value) => {
              setNewPassword(value);
              if (newPasswordError) setNewPasswordError(undefined);
            }}
            error={newPasswordError}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            editable={!submitting}
          />

          {formError ? <FormError message={formError} /> : null}
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <Button label="Change password" onPress={() => void submit()} loading={submitting} />
          <Button label="Cancel" variant="secondary" onPress={() => router.back()} disabled={submitting} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

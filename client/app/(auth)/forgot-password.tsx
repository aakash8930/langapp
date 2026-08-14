import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { forgotPassword, resetPassword } from '@/api/auth';
import { Button } from '@/components/Button';
import { FormError } from '@/components/FormError';
import { TextField } from '@/components/TextField';
import {
  accountActionErrorMessage,
  validateEmail,
  validateNewPassword,
  validateResetCode,
} from '@/lib/auth-form';
import { useTheme } from '@/theme';

/** Mirrors `RESET_CODE_TTL_SECONDS` on the server (`auth/password-reset.store.ts`). */
const RESET_CODE_TTL_MINUTES = 15;

type Step = 'request' | 'reset';

export default function ForgotPassword() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const codeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [resendMessage, setResendMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submitEmail() {
    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    setFormError(undefined);
    if (nextEmailError) return;

    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setStep('reset');
    } catch (error) {
      setFormError(accountActionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (submitting) return;
    setSubmitting(true);
    setFormError(undefined);
    setResendMessage(undefined);
    try {
      await forgotPassword(email.trim());
      setResendMessage('Code resent. Check your inbox.');
    } catch (error) {
      setFormError(accountActionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReset() {
    const nextCodeError = validateResetCode(code);
    const nextPasswordError = validateNewPassword(newPassword);
    setCodeError(nextCodeError);
    setNewPasswordError(nextPasswordError);
    setFormError(undefined);
    if (nextCodeError || nextPasswordError) return;

    setSubmitting(true);
    try {
      await resetPassword(email.trim(), code.trim(), newPassword);
      // No session comes back from this endpoint — the server revoked every
      // existing one along with the old password, so signing in again is the
      // only way forward. `resetSuccess` swaps the login screen's subtitle
      // for a confirmation rather than the ordinary "pick up where you left
      // off", so the action's outcome is still visible on the next screen.
      router.replace({ pathname: '/login', params: { resetSuccess: '1' } });
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
        {step === 'request' ? (
          <>
            <View style={{ gap: theme.spacing.xs }}>
              <Text
                style={{
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.heading,
                  lineHeight: theme.lineHeight.heading,
                  color: theme.colors.ink,
                }}
              >
                Reset your password
              </Text>
              <Text
                style={{
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.body,
                  lineHeight: theme.lineHeight.body,
                  color: theme.colors.inkSoft,
                }}
              >
                We will email you a 6-digit code.
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
                returnKeyType="go"
                onSubmitEditing={() => void submitEmail()}
                editable={!submitting}
                autoFocus
              />

              {formError ? <FormError message={formError} /> : null}
            </View>

            <Button label="Send code" onPress={() => void submitEmail()} loading={submitting} />
          </>
        ) : (
          <>
            <View style={{ gap: theme.spacing.xs }}>
              <Text
                style={{
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.heading,
                  lineHeight: theme.lineHeight.heading,
                  color: theme.colors.ink,
                }}
              >
                Enter the code
              </Text>
              <Text
                style={{
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.body,
                  lineHeight: theme.lineHeight.body,
                  color: theme.colors.inkSoft,
                }}
              >
                {`If ${email.trim()} is registered, we sent a code. It’s good for ${RESET_CODE_TTL_MINUTES} minutes.`}
              </Text>
            </View>

            <View style={{ gap: theme.spacing.lg }}>
              <TextField
                ref={codeRef}
                label="6-digit code"
                value={code}
                onChangeText={(value) => {
                  setCode(value);
                  if (codeError) setCodeError(undefined);
                }}
                error={codeError}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!submitting}
                autoFocus
              />

              <TextField
                ref={passwordRef}
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
                onSubmitEditing={() => void submitReset()}
                editable={!submitting}
              />

              {formError ? <FormError message={formError} /> : null}
              {!formError && resendMessage ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{
                    fontFamily: theme.families.ui,
                    fontSize: theme.fontSize.small,
                    lineHeight: theme.lineHeight.small,
                    color: theme.colors.inkSoft,
                  }}
                >
                  {resendMessage}
                </Text>
              ) : null}
            </View>

            <View style={{ gap: theme.spacing.lg }}>
              <Button label="Reset password" onPress={() => void submitReset()} loading={submitting} />
              <Button
                label="Resend code"
                variant="secondary"
                onPress={() => void resend()}
                disabled={submitting}
              />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

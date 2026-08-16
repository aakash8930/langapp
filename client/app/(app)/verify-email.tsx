import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resendVerification, verifyEmail } from '@/api/auth';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/theme';

export default function VerifyEmailScreen() {
  const theme = useTheme();
  const { user, registrationDelivery, refresh, logout } = useAuth();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    registrationDelivery?.status === 'unavailable'
      ? 'Your account is ready, but the verification email could not be queued. Try resend below.'
      : null,
  );
  const [message, setMessage] = useState<string | null>(
    registrationDelivery?.status === 'queued' ? 'Your verification email has been queued.' : null,
  );

  async function submit() {
    if (token.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await verifyEmail(token);
      setMessage(result.message);
      try {
        await refresh();
      } catch {
        setError('Email verified, but account status could not refresh. Use Refresh status when you are online.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Verification failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Account status could not refresh.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await resendVerification();
      setMessage(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Email could not be queued. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.paper }]}>
      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }]}>
          <Text style={[styles.eyebrow, { color: theme.colors.shu }]}>ACCOUNT · VERIFY EMAIL</Text>
          <Text style={[styles.title, { color: theme.colors.ink }]}>Check your inbox</Text>
          <Text style={[styles.body, { color: theme.colors.inkSoft }]}>
            Enter the six-digit code emailed to {user?.email ?? 'your address'} before personalizing your learning path.
          </Text>

          <Text style={[styles.label, { color: theme.colors.ink }]}>Verification code</Text>
          <TextInput
            value={token}
            onChangeText={(value) => setToken(value.replace(/\D/g, '').slice(0, 6))}
            style={[
              styles.input,
              { color: theme.colors.ink, borderColor: error ? theme.colors.danger : theme.colors.hairline },
            ]}
            placeholder="000000"
            placeholderTextColor={theme.colors.inkSoft}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            editable={!busy}
            onSubmitEditing={() => void submit()}
          />

          {error ? <Text style={[styles.notice, { color: theme.colors.danger }]}>{error}</Text> : null}
          {message ? <Text style={[styles.notice, { color: theme.colors.ai }]}>{message}</Text> : null}

          <Pressable
            style={[styles.primary, { backgroundColor: theme.colors.ink }, (busy || token.length !== 6) && styles.disabled]}
            onPress={() => void submit()}
            disabled={busy || token.length !== 6}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.paper} />
            ) : (
              <Text style={[styles.primaryText, { color: theme.colors.paper }]}>Verify email</Text>
            )}
          </Pressable>

          <View style={styles.actions}>
            <Pressable onPress={() => void resend()} disabled={busy}>
              <Text style={[styles.link, { color: theme.colors.ai }]}>Resend code</Text>
            </Pressable>
            <Text style={{ color: theme.colors.hairline }}>·</Text>
            <Pressable onPress={() => void refreshStatus()} disabled={busy}>
              <Text style={[styles.link, { color: theme.colors.ai }]}>Refresh status</Text>
            </Pressable>
            <Text style={{ color: theme.colors.hairline }}>·</Text>
            <Pressable onPress={() => void logout()} disabled={busy}>
              <Text style={[styles.link, { color: theme.colors.ai }]}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { borderWidth: 1, borderRadius: 18, padding: 24 },
  eyebrow: { fontFamily: 'ZenKakuGothicNew_700Bold', fontSize: 12, letterSpacing: 1.4, marginBottom: 10 },
  title: { fontFamily: 'ZenKakuGothicNew_700Bold', fontSize: 30, lineHeight: 38, marginBottom: 10 },
  body: { fontFamily: 'ZenKakuGothicNew_400Regular', fontSize: 16, lineHeight: 24, marginBottom: 26 },
  label: { fontFamily: 'ZenKakuGothicNew_500Medium', fontSize: 14, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    height: 58,
    fontFamily: 'ZenKakuGothicNew_700Bold',
    fontSize: 25,
    letterSpacing: 8,
    textAlign: 'center',
  },
  notice: { fontFamily: 'ZenKakuGothicNew_500Medium', fontSize: 14, lineHeight: 20, marginTop: 12 },
  primary: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  disabled: { opacity: 0.45 },
  primaryText: { fontFamily: 'ZenKakuGothicNew_700Bold', fontSize: 16 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  link: { fontFamily: 'ZenKakuGothicNew_500Medium', fontSize: 14, paddingVertical: 6 },
});

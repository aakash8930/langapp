import { Link, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/Button';
import { FormError } from '@/components/FormError';
import { PasswordStrength } from '@/components/PasswordStrength';
import { TextField } from '@/components/TextField';
import {
  authErrorMessage,
  validateConfirmPassword,
  validateDateOfBirth,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
} from '@/lib/auth-form';
import { useTheme } from '@/theme';

/**
 * Field order and copy follow web's `SignupForm` (`web/src/components/signup/`)
 * — full name, email, password, confirm password, date of birth — so the two
 * signup flows read as one product asking the same things in the same order,
 * not two forms that happen to end at the same account.
 *
 * OAuth is omitted on both clients until the API has a real provider flow.
 * Advertising a button whose backend route does not exist is worse than
 * offering email signup clearly.
 */
export default function Register() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const dateOfBirthRef = useRef<TextInput>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dateOfBirthError, setDateOfBirthError] = useState<string>();
  const [displayNameError, setDisplayNameError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [confirmPasswordError, setConfirmPasswordError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const nextDisplayNameError = validateDisplayName(displayName);
    const nextEmailError = validateEmail(email);
    const nextPasswordError = validateNewPassword(password);
    const nextConfirmPasswordError = validateConfirmPassword(password, confirmPassword);
    const nextDobError = validateDateOfBirth(dateOfBirth);

    setDisplayNameError(nextDisplayNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmPasswordError);
    setDateOfBirthError(nextDobError);
    setFormError(undefined);

    if (
      nextDisplayNameError ||
      nextEmailError ||
      nextPasswordError ||
      nextConfirmPasswordError ||
      nextDobError
    ) {
      return;
    }

    setSubmitting(true);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        dateOfBirth: dateOfBirth.trim(),
      });
      router.replace('/verify-email');
    } catch (error) {
      setFormError(authErrorMessage(error, 'register'));
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
            Create your account
          </Text>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              lineHeight: theme.lineHeight.body,
              color: theme.colors.inkSoft,
            }}
          >
            Start your language journey today.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <TextField
            label="Full name"
            value={displayName}
            onChangeText={(value) => {
              setDisplayName(value);
              if (displayNameError) setDisplayNameError(undefined);
            }}
            error={displayNameError}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            editable={!submitting}
          />

          <TextField
            ref={emailRef}
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

          <View style={{ gap: theme.spacing.md }}>
            <TextField
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (passwordError) setPasswordError(undefined);
                // A password edited after confirm was already typed can turn a
                // matching pair into a mismatch — recheck rather than leave a
                // stale "they match" green light on screen.
                if (confirmPassword && confirmPasswordError) setConfirmPasswordError(undefined);
              }}
              error={passwordError}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              editable={!submitting}
            />
            <PasswordStrength password={password} />
          </View>

          <TextField
            ref={confirmPasswordRef}
            label="Confirm password"
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              if (confirmPasswordError) setConfirmPasswordError(undefined);
            }}
            error={confirmPasswordError}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => dateOfBirthRef.current?.focus()}
            editable={!submitting}
          />

          {/* A typed date rather than a picker: a picker needs
              @react-native-community/datetimepicker, and this repo asks before
              adding a dependency. `numeric` gives the digit keyboard on both
              platforms; the hyphens still have to be typed. */}
          <TextField
            ref={dateOfBirthRef}
            label="Date of birth"
            placeholder="YYYY-MM-DD"
            value={dateOfBirth}
            onChangeText={(value) => {
              setDateOfBirth(value);
              if (dateOfBirthError) setDateOfBirthError(undefined);
            }}
            error={dateOfBirthError}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            autoComplete="birthdate-full"
            maxLength={10}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            editable={!submitting}
          />

          {formError ? <FormError message={formError} /> : null}
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.small,
              lineHeight: theme.lineHeight.small,
              color: theme.colors.inkSoft,
              textAlign: 'center',
            }}
          >
            {'By creating an account, you agree to our '}
            <Text
              accessibilityRole="link"
              onPress={() => router.push('/legal/terms')}
              style={{ color: theme.colors.ai }}
            >
              Terms of Service
            </Text>
            {' and '}
            <Text
              accessibilityRole="link"
              onPress={() => router.push('/legal/privacy')}
              style={{ color: theme.colors.ai }}
            >
              Privacy Policy
            </Text>
            {'.'}
          </Text>

          <Button label="Create account" onPress={() => void submit()} loading={submitting} />

          <Link href="/login" asChild>
            <Text
              accessibilityRole="link"
              style={{
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.body,
                color: theme.colors.inkSoft,
                textAlign: 'center',
                // A bare line of text is a ~20pt target. The padding is what
                // takes it past 44pt; there is no box drawn around it.
                paddingVertical: theme.spacing.md,
              }}
            >
              {'Already have an account? '}
              <Text style={{ color: theme.colors.ai }}>Sign in</Text>
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

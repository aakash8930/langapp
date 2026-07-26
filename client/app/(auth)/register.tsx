import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/Button';
import { FormError } from '@/components/FormError';
import { TextField } from '@/components/TextField';
import {
  authErrorMessage,
  PASSWORD_MIN_LENGTH,
  validateDateOfBirth,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
} from '@/lib/auth-form';
import { useTheme } from '@/theme';

export default function Register() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dateOfBirthError, setDateOfBirthError] = useState<string>();
  const [displayNameError, setDisplayNameError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const nextDisplayNameError = validateDisplayName(displayName);
    const nextEmailError = validateEmail(email);
    const nextPasswordError = validateNewPassword(password);
    const nextDobError = validateDateOfBirth(dateOfBirth);

    setDisplayNameError(nextDisplayNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setDateOfBirthError(nextDobError);
    setFormError(undefined);

    if (nextDisplayNameError || nextEmailError || nextPasswordError || nextDobError) return;

    setSubmitting(true);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        dateOfBirth: dateOfBirth.trim(),
      });
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
            Create an account
          </Text>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              lineHeight: theme.lineHeight.body,
              color: theme.colors.inkSoft,
            }}
          >
            Start your first Japanese lesson.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <TextField
            label="Display name"
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
            editable={!submitting}
          />

          {/* A typed date rather than a picker: a picker needs
              @react-native-community/datetimepicker, and this repo asks before
              adding a dependency. `numeric` gives the digit keyboard on both
              platforms; the hyphens still have to be typed. */}
          <TextField
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

          <TextField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (passwordError) setPasswordError(undefined);
            }}
            error={passwordError}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
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
          <Button label="Create account" onPress={() => void submit()} loading={submitting} />

          <Link href="/login" asChild>
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
              Sign in instead
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

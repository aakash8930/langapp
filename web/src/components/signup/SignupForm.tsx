import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';

import { useSignup } from '../../hooks/useSignup';
import {
  INITIAL_SIGNUP_FORM,
  type SignupForm as SignupFormData,
  validateSignup,
} from '../../validation/signup.schema';
import { cn } from '../../lib';
import { playSignupEntrance, playSuccessTransition } from '../../animations/signup.motion';
import { PasswordStrength } from './PasswordStrength';
import { SignupFooter } from './SignupFooter';
import { SignupInput } from './SignupInput';

/** Show errors after blur, after submit, or while correcting a non-empty value. */
function shouldShowError(
  field: keyof SignupFormData,
  error: string | undefined,
  form: SignupFormData,
  touched: Record<keyof SignupFormData, boolean>,
  submitted: boolean,
): boolean {
  if (!error) return false;
  return submitted || touched[field] || !!form[field];
}

function yearsAgoIso(years: number): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

export function SignupForm() {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<SignupFormData>(INITIAL_SIGNUP_FORM);
  const [touched, setTouched] = useState<Record<keyof SignupFormData, boolean>>({
    displayName: false,
    email: false,
    password: false,
    confirmPassword: false,
    dateOfBirth: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signup, isPending, isError, error: serverError } = useSignup();

  useEffect(() => {
    playSignupEntrance(cardRef.current);
  }, []);

  const errors = useMemo(() => validateSignup(form), [form]);
  const maxDateOfBirth = useMemo(() => yearsAgoIso(13), []);

  function updateField(field: keyof SignupFormData, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function touchField(field: keyof SignupFormData) {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    if (!acceptedTerms) {
      termsRef.current?.focus();
      return;
    }

    const registered = await signup(form);
    if (!registered) return;

    // Registration creates the session and sends a verification code. Verify
    // ownership before collecting learning preferences.
    playSuccessTransition(cardRef.current, () => {
      navigate({ to: '/verify-email', replace: true });
    });
  }

  return (
    <div className="signup-form-side">
      <div className="signup-card" ref={cardRef}>
        <Link to="/" className="signup-brand" aria-label="GENKŌ home" data-signup-reveal>
          <span className="signup-logo-mark" aria-hidden="true">言</span>
          <span className="signup-logo-text">GENKŌ</span>
        </Link>

        <div className="signup-stepper" aria-label="Account setup progress" data-signup-reveal>
          <span className="is-current"><i>1</i> Account</span>
          <span><i>2</i> Verify</span>
          <span><i>3</i> Personalize</span>
        </div>

        <div className="signup-heading" data-signup-reveal>
          <p className="signup-kicker">YOUR JAPANESE LEARNING PROFILE</p>
          <h1 className="signup-title">Start learning Japanese</h1>
          <p className="signup-subtitle">
            Create one account for lessons, review schedules, streaks, and progress on every device.
          </p>
        </div>

        <form
          ref={formRef}
          className="signup-form"
          onSubmit={handleSubmit}
          noValidate
          aria-busy={isPending}
          data-signup-reveal
        >
          <SignupInput
            label="Display name"
            name="displayName"
            type="text"
            value={form.displayName}
            onChange={(value) => updateField('displayName', value)}
            error={shouldShowError('displayName', errors.displayName, form, touched, submitted) ? errors.displayName : undefined}
            onBlur={() => touchField('displayName')}
            hint="This is how you will appear in community features. You can change it later."
            placeholder="What should we call you?"
            autoComplete="name"
            required
            maxLength={60}
            disabled={isPending}
          />

          <SignupInput
            label="Email address"
            name="email"
            type="email"
            value={form.email}
            onChange={(value) => updateField('email', value)}
            error={shouldShowError('email', errors.email, form, touched, submitted) ? errors.email : undefined}
            onBlur={() => touchField('email')}
            placeholder="you@example.com"
            autoComplete="email"
            required
            maxLength={254}
            disabled={isPending}
          />

          <SignupInput
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={(value) => updateField('password', value)}
            error={shouldShowError('password', errors.password, form, touched, submitted) ? errors.password : undefined}
            onBlur={() => touchField('password')}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            maxLength={128}
            passwordVisible={showPassword}
            onTogglePassword={() => setShowPassword((previous) => !previous)}
            disabled={isPending}
          />

          <PasswordStrength password={form.password} />

          <SignupInput
            label="Confirm password"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={(value) => updateField('confirmPassword', value)}
            error={shouldShowError('confirmPassword', errors.confirmPassword, form, touched, submitted) ? errors.confirmPassword : undefined}
            onBlur={() => touchField('confirmPassword')}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            required
            maxLength={128}
            passwordVisible={showPassword}
            onTogglePassword={() => setShowPassword((previous) => !previous)}
            disabled={isPending}
          />

          <SignupInput
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={(value) => updateField('dateOfBirth', value)}
            error={shouldShowError('dateOfBirth', errors.dateOfBirth, form, touched, submitted) ? errors.dateOfBirth : undefined}
            onBlur={() => touchField('dateOfBirth')}
            hint="Used for the 13+ safety check and never shown on your profile."
            autoComplete="bday"
            required
            max={maxDateOfBirth}
            disabled={isPending}
          />

          <label className={cn('signup-consent', submitted && !acceptedTerms && 'signup-consent--error')}>
            <input
              ref={termsRef}
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              disabled={isPending}
              aria-describedby={submitted && !acceptedTerms ? 'signup-consent-error' : undefined}
            />
            <span>
              I agree to the <Link to="/terms">Terms of Service</Link> and acknowledge the{' '}
              <Link to="/privacy">Privacy Policy</Link>.
            </span>
          </label>
          {submitted && !acceptedTerms ? (
            <p className="signup-consent-error" id="signup-consent-error" role="alert">
              Please accept the terms to create your account.
            </p>
          ) : null}

          {isError && serverError ? (
            <div className="signup-server-error" role="alert">
              <AlertCircle size={17} aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          ) : null}

          <button
            type="submit"
            className={cn('signup-continue', isPending && 'signup-continue--pending')}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="signup-spinner" aria-hidden="true" size={18} strokeWidth={2} />
                <span>Creating your profile…</span>
              </>
            ) : (
              <>
                <span>Create my learning profile</span>
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>

          <p className="signup-security-note">
            <ShieldCheck size={15} aria-hidden="true" />
            Your password is hashed securely. Your birth date is private.
          </p>
        </form>

        <SignupFooter />
      </div>
    </div>
  );
}

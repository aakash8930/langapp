import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

import { useSignup } from '../../hooks/useSignup';
import {
  INITIAL_SIGNUP_FORM,
  isSignupValid,
  type SignupForm as SignupFormData,
  validateSignup,
} from '../../validation/signup.schema';
import { cn } from '../../lib';
import { playSignupEntrance, playSuccessTransition } from '../../animations/signup.motion';
import { OAuthButtons } from './OAuthButtons';
import { PasswordStrength } from './PasswordStrength';
import { SignupFooter } from './SignupFooter';
import { SignupInput } from './SignupInput';

/** Field-level error visibility: show only after touch, value, or submit. */
function shouldShowError(
  field: keyof SignupFormData,
  error: string | undefined,
  form: SignupFormData,
  touched: Record<keyof SignupFormData, boolean>,
  submitted: boolean,
): boolean {
  if (!error) return false;
  if (submitted) return true;
  if (touched[field]) return true;
  return !!form[field];
}

export function SignupForm() {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<SignupFormData>(INITIAL_SIGNUP_FORM);
  const [touched, setTouched] = useState<Record<keyof SignupFormData, boolean>>({
    fullName: false,
    email: false,
    password: false,
    confirmPassword: false,
    dateOfBirth: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signup, isPending, isError, error: serverError } = useSignup();

  useEffect(() => {
    playSignupEntrance(cardRef.current);
  }, []);

  const errors = useMemo(() => validateSignup(form), [form]);
  const isFormValid = useMemo(() => isSignupValid(form), [form]);

  const maxDateOfBirth = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().slice(0, 10);
  }, []);

  const minDateOfBirth = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 100);
    return d.toISOString().slice(0, 10);
  }, []);

  function updateField(field: keyof SignupFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function touchField(field: keyof SignupFormData) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!isFormValid) return;

    const ok = await signup(form);
    if (ok) {
      playSuccessTransition(cardRef.current, () => {
        navigate({ to: '/' });
      });
    }
  }

  return (
    <div className="signup-form-side">
      <div className="signup-card" ref={cardRef}>
        <div className="signup-brand" data-signup-reveal>
          <span className="signup-logo-mark" aria-hidden="true" />
          <span className="signup-logo-text">GENKŌ</span>
        </div>

        <h1 className="signup-title" data-signup-reveal>
          Create your account
        </h1>
        <p className="signup-subtitle" data-signup-reveal>
          Start your language journey today.
        </p>

        <form
          className="signup-form"
          onSubmit={handleSubmit}
          noValidate
          data-signup-reveal
        >
          <SignupInput
            label="Full Name"
            name="fullName"
            type="text"
            value={form.fullName}
            onChange={(value) => updateField('fullName', value)}
            error={
              shouldShowError('fullName', errors.fullName, form, touched, submitted)
                ? errors.fullName
                : undefined
            }
            onBlur={() => touchField('fullName')}
            autoComplete="name"
            required
            maxLength={60}
          />

          <SignupInput
            label="Email Address"
            name="email"
            type="email"
            value={form.email}
            onChange={(value) => updateField('email', value)}
            error={
              shouldShowError('email', errors.email, form, touched, submitted)
                ? errors.email
                : undefined
            }
            onBlur={() => touchField('email')}
            autoComplete="email"
            required
            maxLength={254}
          />

          <SignupInput
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={(value) => updateField('password', value)}
            error={
              shouldShowError('password', errors.password, form, touched, submitted)
                ? errors.password
                : undefined
            }
            onBlur={() => touchField('password')}
            autoComplete="new-password"
            required
            maxLength={128}
            passwordVisible={showPassword}
            onTogglePassword={() => setShowPassword((prev) => !prev)}
          />

          <PasswordStrength password={form.password} />

          <SignupInput
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={(value) => updateField('confirmPassword', value)}
            error={
              shouldShowError('confirmPassword', errors.confirmPassword, form, touched, submitted)
                ? errors.confirmPassword
                : undefined
            }
            onBlur={() => touchField('confirmPassword')}
            autoComplete="new-password"
            required
            maxLength={128}
            passwordVisible={showPassword}
            onTogglePassword={() => setShowPassword((prev) => !prev)}
          />

          <SignupInput
            label="Date of Birth"
            name="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={(value) => updateField('dateOfBirth', value)}
            error={
              shouldShowError('dateOfBirth', errors.dateOfBirth, form, touched, submitted)
                ? errors.dateOfBirth
                : undefined
            }
            onBlur={() => touchField('dateOfBirth')}
            autoComplete="bday"
            required
            min={minDateOfBirth}
            max={maxDateOfBirth}
          />

          {isError && serverError ? (
            <div className="signup-server-error" role="alert" data-signup-reveal>
              {serverError}
            </div>
          ) : null}

          <button
            type="submit"
            className={cn('btn signup-continue', isPending && 'signup-continue--pending')}
            disabled={!isFormValid || isPending}
            data-signup-reveal
          >
            {isPending ? (
              <>
                <Loader2
                  className="signup-spinner"
                  aria-hidden="true"
                  size={18}
                  strokeWidth={2}
                />
                <span>Creating account…</span>
              </>
            ) : (
              'Continue'
            )}
          </button>
        </form>

        <OAuthButtons />
        <SignupFooter />
      </div>
    </div>
  );
}

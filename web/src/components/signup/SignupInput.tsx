import type { ChangeEvent } from 'react';
import { useEffect, useRef } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

import { shakeInput } from '../../animations/signup.motion';
import { cn } from '../../lib';

export interface SignupInputProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'date';
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoComplete?: string;
  required?: boolean;
  maxLength?: number;
  min?: string;
  max?: string;
  passwordVisible?: boolean;
  onTogglePassword?: () => void;
  onBlur?: () => void;
}

/**
 * A reusable, accessible signup input.
 *
 * Wraps a label, the native input, an optional show/hide toggle for password
 * fields, hint text, and an error message. Error state is announced to screen
 * readers and also triggers a small shake on the input.
 */
export function SignupInput({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  hint,
  autoComplete,
  required,
  maxLength,
  min,
  max,
  passwordVisible,
  onTogglePassword,
  onBlur,
}: SignupInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) shakeInput(inputRef.current);
  }, [error]);

  const isPassword = type === 'password';
  const inputType = isPassword && passwordVisible ? 'text' : type;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  return (
    <div className={cn('signup-field', error && 'signup-field--error')}>
      <label className="signup-field-label" htmlFor={name}>
        {label}
        {required ? <span className="signup-required" aria-hidden="true" /> : null}
      </label>
      <div className="signup-input-wrap">
        {isPassword ? (
          <Lock
            className="signup-input-icon signup-input-icon--left"
            aria-hidden="true"
            size={18}
            strokeWidth={1.75}
          />
        ) : null}
        <input
          ref={inputRef}
          id={name}
          name={name}
          className="signup-input"
          type={inputType}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          autoComplete={autoComplete}
          required={required}
          maxLength={maxLength}
          min={min}
          max={max}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${name}-error` : hint ? `${name}-hint` : undefined
          }
        />
        {isPassword && onTogglePassword ? (
          <button
            type="button"
            className="signup-input-toggle"
            onClick={onTogglePassword}
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            aria-pressed={passwordVisible}
          >
            {passwordVisible ? (
              <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Eye size={18} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {hint && !error ? (
        <span className="signup-field-hint" id={`${name}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span
          className="signup-field-error"
          id={`${name}-error`}
          role="alert"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

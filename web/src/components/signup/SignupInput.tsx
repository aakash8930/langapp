import type { ChangeEvent } from 'react';
import { useEffect, useRef } from 'react';
import { CalendarDays, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';

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
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  maxLength?: number;
  min?: string;
  max?: string;
  passwordVisible?: boolean;
  onTogglePassword?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
}

function FieldIcon({ name, type }: { name: string; type: SignupInputProps['type'] }) {
  const props = {
    className: 'signup-input-icon',
    'aria-hidden': true as const,
    size: 18,
    strokeWidth: 1.75,
  };

  if (type === 'password') return <Lock {...props} />;
  if (type === 'email') return <Mail {...props} />;
  if (type === 'date') return <CalendarDays {...props} />;
  if (name === 'displayName') return <UserRound {...props} />;
  return null;
}

/** Labelled account field with a stable hint/error relationship. */
export function SignupInput({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  hint,
  placeholder,
  autoComplete,
  required,
  maxLength,
  min,
  max,
  passwordVisible,
  onTogglePassword,
  onBlur,
  disabled,
}: SignupInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) shakeInput(inputRef.current);
  }, [error]);

  const isPassword = type === 'password';
  const inputType = isPassword && passwordVisible ? 'text' : type;
  const describedBy = [hint ? `${name}-hint` : null, error ? `${name}-error` : null]
    .filter(Boolean)
    .join(' ') || undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  return (
    <div className={cn('signup-field', error && 'signup-field--error')}>
      <label className="signup-field-label" htmlFor={name}>
        {label}
        {required ? <span className="signup-required" aria-hidden="true" /> : null}
      </label>
      <div className="signup-input-wrap">
        <FieldIcon name={name} type={type} />
        <input
          ref={inputRef}
          id={name}
          name={name}
          className="signup-input"
          type={inputType}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          maxLength={maxLength}
          min={min}
          max={max}
          disabled={disabled}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
        />
        {isPassword && onTogglePassword ? (
          <button
            type="button"
            className="signup-input-toggle"
            onClick={onTogglePassword}
            aria-label={passwordVisible ? 'Hide passwords' : 'Show passwords'}
            aria-pressed={passwordVisible}
            disabled={disabled}
          >
            {passwordVisible ? (
              <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Eye size={18} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {hint ? (
        <span className="signup-field-hint" id={`${name}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="signup-field-error" id={`${name}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

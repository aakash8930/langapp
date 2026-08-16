/**
 * Signup validation mirrors the public registration contract. These checks are
 * intentionally no stricter than `RegisterDto`: client-side validation should
 * explain a rejected value, not invent an extra account requirement.
 */

export interface SignupForm {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
}

export const INITIAL_SIGNUP_FORM: SignupForm = {
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
  dateOfBirth: '',
};

export type SignupErrors = Partial<Record<keyof SignupForm, string>>;

/** A practical RFC-5322 subset. The server's `@IsEmail` remains authoritative. */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MIN_AGE_TO_REGISTER = 13;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

/**
 * Signals used by the strength meter, not registration requirements. A long
 * passphrase is valid even when it does not contain every character category.
 */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: '12+ characters', test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'long', label: '16+ is stronger', test: (p) => p.length >= 16 },
  { id: 'upper-lower', label: 'Mixed letter case', test: (p) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
  { id: 'number', label: 'A number', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'A symbol', test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

export type PasswordLevel = 'none' | 'weak' | 'fair' | 'strong';

export interface PasswordScore {
  level: PasswordLevel;
  label: string;
  passed: number;
  total: number;
}

const PASSWORD_LEVEL_LABELS: Record<PasswordLevel, string> = {
  none: '',
  weak: 'Weak',
  fair: 'Good',
  strong: 'Strong',
};

export function passwordScore(password: string): PasswordScore {
  const total = PASSWORD_RULES.length;
  if (!password) return { level: 'none', label: '', passed: 0, total };

  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  let level: PasswordLevel;
  if (passed <= 2) level = 'weak';
  else if (passed < total) level = 'fair';
  else level = 'strong';
  return { level, label: PASSWORD_LEVEL_LABELS[level], passed, total };
}

function parseDateOfBirth(iso: string): Date | null {
  const match = DATE_REGEX.exec(iso);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  // `Date` normalises impossible values such as 2024-02-31. Compare the
  // resulting calendar parts so those values are rejected instead.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function ageFromIso(iso: string): number {
  const born = parseDateOfBirth(iso);
  if (!born) return -1;

  const now = new Date();
  let years = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) {
    years -= 1;
  }
  return years;
}

function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return 'Email is required.';
  if (email.length > 254) return 'Use an email address under 255 characters.';
  return EMAIL_REGEX.test(email) ? undefined : 'Enter a valid email address.';
}

function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required.';
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return undefined;
}

function validateDateOfBirth(value: string): string | undefined {
  if (!value) return 'Date of birth is required.';
  const born = parseDateOfBirth(value);
  if (!born || born.getTime() > Date.now()) return 'Enter a valid date of birth.';

  const age = ageFromIso(value);
  if (age < MIN_AGE_TO_REGISTER) {
    return `You must be at least ${MIN_AGE_TO_REGISTER} to create an account.`;
  }
  return undefined;
}

function validateConfirmPassword(confirm: string, password: string): string | undefined {
  if (!confirm) return 'Please confirm your password.';
  return confirm === password ? undefined : 'Passwords do not match.';
}

/** Validate one field after blur or while correcting a visible error. */
export function validateSignupField(
  field: keyof SignupForm,
  value: string,
  all: SignupForm,
): string | undefined {
  switch (field) {
    case 'displayName':
      if (!value.trim()) return 'Display name is required.';
      return value.trim().length > 60 ? 'Use at most 60 characters.' : undefined;
    case 'email':
      return validateEmail(value);
    case 'password':
      return validatePassword(value);
    case 'confirmPassword':
      return validateConfirmPassword(value, all.password);
    case 'dateOfBirth':
      return validateDateOfBirth(value);
  }
}

/** Validate every field at once — the submit gate and source of truth. */
export function validateSignup(form: SignupForm): SignupErrors {
  const errors: SignupErrors = {};

  (Object.keys(form) as Array<keyof SignupForm>).forEach((field) => {
    const error = validateSignupField(field, form[field], form);
    if (error) errors[field] = error;
  });

  return errors;
}

export function isSignupValid(form: SignupForm): boolean {
  return Object.keys(validateSignup(form)).length === 0;
}

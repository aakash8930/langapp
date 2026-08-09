/**
 * Signup form validation, kept dependency-free (no Zod) to match the manual
 * validation style already used across the app's forms.
 *
 * The server's `RegisterDto` is the authority — email length, password length,
 * and the age gate are all re-enforced there — so these checks exist only to
 * fail fast and give the learner immediate, per-field feedback before a round
 * trip. A 400 from the server is still surfaced as a submit error; the client
 * never claims to have validated something the server didn't.
 */

export interface SignupForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
}

export const INITIAL_SIGNUP_FORM: SignupForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  dateOfBirth: '',
};

export type SignupErrors = Partial<Record<keyof SignupForm, string>>;

/** A practical RFC-5322 subset. The server's `@IsEmail` is the real check. */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const MIN_AGE_TO_REGISTER = 13;

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

/**
 * The password contract from the design spec, stated as data so the strength
 * indicator and the submit validator read from one source.
 */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'A number', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'A special character', test: (p) => /[^a-zA-Z0-9]/.test(p) },
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
  fair: 'Moderate',
  strong: 'Strong',
};

export function passwordScore(password: string): PasswordScore {
  const total = PASSWORD_RULES.length;
  if (!password) {
    return { level: 'none', label: '', passed: 0, total };
  }
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  let level: PasswordLevel;
  if (passed <= 2) level = 'weak';
  else if (passed < total) level = 'fair';
  else level = 'strong';
  return { level, label: PASSWORD_LEVEL_LABELS[level], passed, total };
}

/**
 * `display` lets the strength bar colour itself without a switch at the call
 * site; the CSS reads `--signup-strength-level` and paints the track.
 */
export const PASSWORD_LEVEL_DISPLAY: Record<PasswordLevel, string> = {
  none: 'idle',
  weak: 'weak',
  fair: 'fair',
  strong: 'strong',
};

function parseDateOfBirth(iso: string): Date | null {
  if (!DATE_REGEX.test(iso)) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ageFromIso(iso: string): number {
  const born = parseDateOfBirth(iso);
  if (!born) return -1;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const months = now.getMonth() - born.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < born.getDate())) years -= 1;
  return years;
}

function validateEmail(value: string): string | undefined {
  if (!value.trim()) return undefined; // "required" handled as the field error
  return EMAIL_REGEX.test(value.trim()) ? undefined : 'Enter a valid email address.';
}

function validatePassword(value: string): string | undefined {
  if (!value) return undefined;
  const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
  if (!failed) return undefined;
  return 'Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character.';
}

function validateDateOfBirth(value: string): string | undefined {
  if (!value) return undefined;
  const age = ageFromIso(value);
  if (age < 0) return 'Enter a valid date of birth.';
  if (age < MIN_AGE_TO_REGISTER) {
    return `You must be at least ${MIN_AGE_TO_REGISTER} to create an account.`;
  }
  return undefined;
}

function validateConfirmPassword(
  confirm: string,
  password: string,
): string | undefined {
  if (!confirm) return undefined;
  return confirm === password ? undefined : 'Passwords do not match.';
}

/**
 * Real-time validator for a single field while the user is typing. Returns
 * `undefined` for empty required fields — the "required" message is only shown
 * after the field is blurred or the user hits submit, so a pristine form does
 * not light up with red the instant it mounts.
 */
export function validateSignupField(
  field: keyof SignupForm,
  value: string,
  all: SignupForm,
): string | undefined {
  switch (field) {
    case 'fullName':
      return value.trim() ? undefined : 'Full name is required.';
    case 'email':
      return validateEmail(value) ?? (value.trim() ? undefined : 'Email is required.');
    case 'password':
      return validatePassword(value) ?? (value ? undefined : 'Password is required.');
    case 'confirmPassword':
      return validateConfirmPassword(value, all.password);
    case 'dateOfBirth':
      return validateDateOfBirth(value) ?? (value ? undefined : 'Date of birth is required.');
  }
}

/** Validate every field at once — the submit gate and the source of truth. */
export function validateSignup(form: SignupForm): SignupErrors {
  const errors: SignupErrors = {};

  if (!form.fullName.trim()) errors.fullName = 'Full name is required.';

  if (!form.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_REGEX.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!form.password) {
    errors.password = 'Password is required.';
  } else {
    const failed = PASSWORD_RULES.find((rule) => !rule.test(form.password));
    if (failed) {
      errors.password =
        'Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character.';
    }
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (!form.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required.';
  } else {
    const age = ageFromIso(form.dateOfBirth);
    if (age < 0) errors.dateOfBirth = 'Enter a valid date of birth.';
    else if (age < MIN_AGE_TO_REGISTER) {
      errors.dateOfBirth = `You must be at least ${MIN_AGE_TO_REGISTER} to create an account.`;
    }
  }

  return errors;
}

export function isSignupValid(form: SignupForm): boolean {
  return Object.keys(validateSignup(form)).length === 0;
}

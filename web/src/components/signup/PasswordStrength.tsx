import { Check } from 'lucide-react';

import { cn } from '../../lib';
import { passwordScore, PASSWORD_RULES } from '../../validation/signup.schema';

export interface PasswordStrengthProps {
  password: string;
}

/**
 * A strength guide, deliberately separate from validity. Registration requires
 * 8–128 characters; these suggestions help a learner make that password harder
 * to guess without rejecting valid passphrases the API accepts.
 */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const score = passwordScore(password);

  return (
    <div className="signup-pw-strength" aria-live="polite">
      <div className="signup-pw-heading">
        <span>Password strength</span>
        <strong className={`signup-pw-label signup-pw-label--${score.level}`}>
          {score.label}
        </strong>
      </div>
      <div
        className="signup-pw-track"
        role="progressbar"
        aria-label="Password strength suggestions met"
        aria-valuemin={0}
        aria-valuemax={score.total}
        aria-valuenow={score.passed}
      >
        <div className={cn('signup-pw-fill', `signup-pw-fill--${score.level}`)} />
      </div>
      <ul className="signup-pw-rules" aria-label="Password strength suggestions">
        {PASSWORD_RULES.map((rule) => {
          const passed = rule.test(password);
          return (
            <li
              key={rule.id}
              className={cn('signup-pw-rule', passed && 'signup-pw-rule--passed')}
            >
              <span className="signup-pw-check" aria-hidden="true">
                {passed ? <Check size={13} strokeWidth={2.5} /> : <span className="signup-pw-check-dot" />}
              </span>
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>
      <p className="signup-pw-note">Suggestions improve strength; only the 8-character minimum is required.</p>
    </div>
  );
}

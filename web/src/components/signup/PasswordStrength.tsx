import { Check } from 'lucide-react';

import { cn } from '../../lib';
import { passwordScore, PASSWORD_RULES } from '../../validation/signup.schema';

export interface PasswordStrengthProps {
  password: string;
}

/**
 * Real-time password strength indicator.
 *
 * Shows a progress bar and a checklist of the five required rules. The bar
 * width and colour are driven entirely by the level class, so there are no
 * inline styles to maintain.
 */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const score = passwordScore(password);

  return (
    <div className="signup-pw-strength" data-signup-reveal>
      <div className="signup-pw-track">
        <div
          className={cn(
            'signup-pw-fill',
            `signup-pw-fill--${score.level}`,
          )}
        />
      </div>
      <div className="signup-pw-meta">
        <span className="signup-pw-label">{score.label}</span>
        <span className="signup-pw-count">
          {score.passed}/{score.total}
        </span>
      </div>
      <ul className="signup-pw-rules">
        {PASSWORD_RULES.map((rule) => {
          const passed = rule.test(password);
          return (
            <li
              key={rule.id}
              className={cn(
                'signup-pw-rule',
                passed && 'signup-pw-rule--passed',
              )}
            >
              <span className="signup-pw-check" aria-hidden="true">
                {passed ? (
                  <Check size={14} strokeWidth={2} />
                ) : (
                  <span className="signup-pw-check-dot" />
                )}
              </span>
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { Link } from '@tanstack/react-router';

/**
 * Footer prompt for existing accounts.
 *
 * There is no dedicated login route yet, so the link lands on `/` where the
 * public shell / landing page can direct a signed-out visitor appropriately.
 */
export function SignupFooter() {
  return (
    <p className="signup-footer" data-signup-reveal>
      Already have an account?{' '}
      <Link to="/" className="signup-link">
        Sign In
      </Link>
    </p>
  );
}

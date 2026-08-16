import { Link } from '@tanstack/react-router';

export function SignupFooter() {
  return (
    <p className="signup-footer" data-signup-reveal>
      Already learning with GENKŌ?{' '}
      <Link to="/signin" className="signup-link">
        Sign in
      </Link>
    </p>
  );
}

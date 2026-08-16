import { SignupForm } from './SignupForm';
import '../../styles/signup.css';
import { SignupHero } from './SignupHero';

/**
 * Full-screen signup takeover.
 *
 * Rendered without the AppShell (no header, sidebar, or footer) because the
 * root route checks `pathname === '/signup'` and emits the `<Outlet />` alone.
 * The left 45% holds the form; the right 55% holds the Japanese Ink hero image.
 */
export function SignupPage() {
  return (
    <div className="signup-page">
      <main className="signup-layout">
        <SignupForm />
        <SignupHero />
      </main>
    </div>
  );
}

import { SigninForm } from './SigninForm';
import { SigninHero } from './SigninHero';

/**
 * Full-screen signin takeover.
 *
 * Rendered without the AppShell (no header, sidebar, or footer) because the
 * root route checks for `/signin` and emits the `<Outlet />` alone.
 * The left 40% holds the form; the right 60% holds the Japanese Ink hero.
 */
export function SigninPage() {
  return (
    <div className="signin-page">
      <main className="signin-layout">
        <SigninForm />
        <SigninHero />
      </main>
    </div>
  );
}

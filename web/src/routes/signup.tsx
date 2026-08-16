import { createFileRoute } from '@tanstack/react-router';

import { SignupPage } from '../components/signup';

/**
 * Full-screen signup takeover — no AppShell (no header, sidebar, or footer).
 *
 * The form, validation, service layer, and animation helpers all live in
 * `components/signup/` so this file stays a thin route wrapper, matching the
 * pattern the other leaf routes follow.
 */
export const Route = createFileRoute('/signup')({
  component: SignupPage,
});

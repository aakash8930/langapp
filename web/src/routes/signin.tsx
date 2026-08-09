import { createFileRoute } from '@tanstack/react-router';

import { SigninPage } from '../components/signin';
import '../styles/signin.css';

/**
 * Full-screen signin takeover — no AppShell (no header, sidebar, or footer).
 *
 * The form supports sign in, sign up, forgot password, and reset password
 * modes, plus OAuth redirects for Google and GitHub.
 */
export const Route = createFileRoute('/signin')({
  component: SigninPage,
});

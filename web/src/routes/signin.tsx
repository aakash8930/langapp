import { createFileRoute } from '@tanstack/react-router';

import { SigninPage } from '../components/signin';
import '../styles/signin.css';

/**
 * Full-screen signin takeover — no AppShell (no header, sidebar, or footer).
 *
 * The form supports sign in, forgot password, and reset password. Account
 * creation stays on `/signup` so there is one registration contract.
 */
export const Route = createFileRoute('/signin')({
  component: SigninPage,
});

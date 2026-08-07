import { createFileRoute } from '@tanstack/react-router';

import { VerifyEmailPage } from '../components/verify-email/VerifyEmailPage';
import '../styles/verify-email.css';

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
});

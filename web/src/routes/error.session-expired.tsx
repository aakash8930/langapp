import { createFileRoute } from '@tanstack/react-router';
import { SystemPage } from '../components/system/SystemPage';

export const Route = createFileRoute('/error/session-expired')({
  component: SessionExpiredPage,
});

function SessionExpiredPage() {
  return (
    <SystemPage
      icon="shield"
      heading="Session Expired"
      message="Your session has expired. Sign in again to continue."
      actions={[
        { label: 'Sign In', to: '/', primary: true },
      ]}
    />
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { SystemPage } from '../components/system/SystemPage';

export const Route = createFileRoute('/error/500')({
  component: Error500,
});

function Error500() {
  return (
    <SystemPage
      icon="zap"
      heading="Something Went Wrong"
      message="An unexpected error occurred. Our team has been notified."
      actions={[
        { label: 'Try Again', onClick: () => window.location.reload(), primary: true },
        { label: 'Back to Dashboard', to: '/' },
      ]}
    />
  );
}

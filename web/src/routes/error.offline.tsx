import { createFileRoute } from '@tanstack/react-router';
import { SystemPage } from '../components/system/SystemPage';

export const Route = createFileRoute('/error/offline')({
  component: OfflinePage,
});

function OfflinePage() {
  return (
    <SystemPage
      icon="zap"
      heading="No Internet Connection"
      message="You're currently offline. Check your connection and try again."
      actions={[
        {
          label: 'Try Again',
          onClick: () => window.location.reload(),
          primary: true,
        },
      ]}
    />
  );
}

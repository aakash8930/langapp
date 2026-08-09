import { createFileRoute } from '@tanstack/react-router';
import { SystemPage } from '../components/system/SystemPage';

export const Route = createFileRoute('/error/coming-soon')({
  component: ComingSoonPage,
});

function ComingSoonPage() {
  return (
    <SystemPage
      icon="sparkles"
      heading="Coming Soon"
      message="We're working on something great. This feature will be available soon."
      actions={[
        { label: 'Back to Dashboard', to: '/', primary: true },
      ]}
    />
  );
}

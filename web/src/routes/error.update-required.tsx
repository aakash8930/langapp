import { createFileRoute } from '@tanstack/react-router';
import { SystemPage } from '../components/system/SystemPage';

export const Route = createFileRoute('/error/update-required')({
  component: UpdateRequiredPage,
});

function UpdateRequiredPage() {
  return (
    <SystemPage
      icon="refresh-cw"
      heading="Update Required"
      message="A new version of GENKŌ is available."
      detail="Please refresh to get the latest features and fixes."
      actions={[
        { label: 'Refresh Now', onClick: () => window.location.reload(), primary: true },
      ]}
    />
  );
}

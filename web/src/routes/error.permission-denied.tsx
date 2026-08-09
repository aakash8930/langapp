import { createFileRoute } from '@tanstack/react-router';
import { SystemPage } from '../components/system/SystemPage';

export const Route = createFileRoute('/error/permission-denied')({
  component: PermissionDeniedPage,
});

function PermissionDeniedPage() {
  return (
    <SystemPage
      icon="lock"
      heading="Permission Denied"
      message="You don't have access to this area."
      detail="If you believe this is a mistake, contact the administrator."
      actions={[
        { label: 'Back to Dashboard', to: '/', primary: true },
      ]}
    />
  );
}

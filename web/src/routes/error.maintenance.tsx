import { createFileRoute } from '@tanstack/react-router';
import { SystemPage } from '../components/system/SystemPage';

export const Route = createFileRoute('/error/maintenance')({
  component: MaintenancePage,
});

function MaintenancePage() {
  return (
    <SystemPage
      icon="settings"
      heading="Under Maintenance"
      message="GENKŌ is currently undergoing scheduled maintenance."
      detail="We'll be back shortly. Your learning progress is safe."
      actions={[
        { label: 'Check Status', to: '/', primary: true },
      ]}
    />
  );
}

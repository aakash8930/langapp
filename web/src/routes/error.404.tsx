import { createFileRoute } from '@tanstack/react-router';
import { SystemPage } from '../components/system/SystemPage';

export const Route = createFileRoute('/error/404')({
  component: NotFoundPage,
});

function NotFoundPage() {
  return (
    <SystemPage
      icon="search"
      heading="Page Not Found"
      message="The page you're looking for doesn't exist or has been moved."
      actions={[
        { label: 'Back to Dashboard', to: '/', primary: true },
        { label: 'Go to Courses', to: '/courses' },
      ]}
    />
  );
}

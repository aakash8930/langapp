import { createFileRoute } from '@tanstack/react-router';

import { SystemPage } from '../components/system/SystemPage';

/** A neutral, reusable empty state for data-backed areas with no records yet. */
export const Route = createFileRoute('/error/empty-state')({
  component: EmptyStatePage,
});

function EmptyStatePage() {
  return (
    <SystemPage
      icon="book-open"
      heading="Nothing here yet"
      message="This area will fill up as you learn, save content, or create your first item."
      actions={[
        { label: 'Explore Courses', to: '/courses', primary: true },
        { label: 'Back to Dashboard', to: '/' },
      ]}
    />
  );
}

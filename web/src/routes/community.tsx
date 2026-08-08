import { createFileRoute } from '@tanstack/react-router';

import { CommunityPage } from '../components/practice/CommunityHub';

export const Route = createFileRoute('/community')({
  component: () => <CommunityPage />,
});

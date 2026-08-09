import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { logError } from '../debug';
import { SystemPage } from './system/SystemPage';

export function NotFound() {
  const router = useRouter();
  const routerHref = router.state.location.href;
  const browserHash = window.location.hash;

  useEffect(() => {
    logError('nav', `No route matches ${routerHref}`, {
      routerHref,
      browserHash: window.location.hash,
      knownRoutes: Object.keys(router.routesById)
        .filter((id) => id !== '__root__')
        .sort(),
      hint: 'A hash link pointing at a path the route tree does not contain.',
    });
  }, [routerHref, router]);

  return (
    <SystemPage
      icon="search"
      heading="Page Not Found"
      message="The page you're looking for doesn't exist or has been moved."
      detail={browserHash || '#/'}
      actions={[
        { label: 'Back to Dashboard', to: '/', primary: true },
        { label: 'Go to Courses', to: '/courses' },
      ]}
    />
  );
}

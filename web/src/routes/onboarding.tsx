import { createFileRoute } from '@tanstack/react-router';

import { OnboardingWizard } from '../components/onboarding';

export const Route = createFileRoute('/onboarding')({
  component: OnboardingWizard,
});

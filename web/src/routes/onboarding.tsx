import { createFileRoute } from '@tanstack/react-router';

import { OnboardingWizard } from '../components/onboarding';
import '../styles/onboarding.css';

export const Route = createFileRoute('/onboarding')({
  component: OnboardingWizard,
});

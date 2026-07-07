import { redirect } from 'next/navigation';
import { getCurrentOrg } from '@/lib/org';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

export const metadata = {
  title: 'Get Started - RedFox CRM',
};

export default async function OnboardingPage() {
  const org = await getCurrentOrg();
  // Already set up → straight to the app.
  if (org) redirect('/dashboard');

  return <OnboardingWizard />;
}

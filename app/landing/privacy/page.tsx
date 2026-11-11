import { LegalDoc } from "@/components/legal/legal-doc";
import { LEGAL_UPDATED, PRIVACY } from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy - RedFox CRM",
  description: "How RedFox CRM collects, uses, and protects information.",
};

export default function PrivacyPage() {
  return <LegalDoc title="Privacy Policy" updated={LEGAL_UPDATED} sections={PRIVACY} />;
}

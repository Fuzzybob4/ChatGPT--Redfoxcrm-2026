import { LegalDoc } from "@/components/legal/legal-doc";
import { LEGAL_UPDATED, TERMS } from "@/lib/legal";

export const metadata = {
  title: "Terms of Service - RedFox CRM",
  description: "RedFox CRM Terms of Service for businesses using the platform.",
};

export default function TermsPage() {
  return <LegalDoc title="Terms of Service" updated={LEGAL_UPDATED} sections={TERMS} />;
}

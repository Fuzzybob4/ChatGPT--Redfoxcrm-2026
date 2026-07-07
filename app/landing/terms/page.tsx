import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service - RedFox CRM',
  description: 'RedFox CRM Terms of Service. Read our terms and conditions.',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-foreground mb-8">Terms of Service</h1>
      <p className="text-muted-foreground mb-8">
        Last updated: July 6, 2025
      </p>

      <div className="prose prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground mb-4">
            By accessing and using RedFox CRM ("Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">2. Use License</h2>
          <p className="text-muted-foreground mb-4">
            Permission is granted to temporarily download one copy of the materials (information or software) on RedFox CRM for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Modifying or copying the materials</li>
            <li>Using the materials for any commercial purpose or for any public display</li>
            <li>Attempting to decompile or reverse engineer any software contained on RedFox CRM</li>
            <li>Removing any copyright or other proprietary notations from the materials</li>
            <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">3. Disclaimer</h2>
          <p className="text-muted-foreground mb-4">
            The materials on RedFox CRM are provided on an 'as is' basis. RedFox CRM makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">4. Limitations of Liability</h2>
          <p className="text-muted-foreground mb-4">
            In no event shall RedFox CRM or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on RedFox CRM, even if RedFox CRM or an authorized representative has been notified orally or in writing of the possibility of such damage.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">5. Accuracy of Materials</h2>
          <p className="text-muted-foreground mb-4">
            The materials appearing on RedFox CRM could include technical, typographical, or photographic errors. RedFox CRM does not warrant that any of the materials on the Service are accurate, complete, or current. RedFox CRM may make changes to the materials contained on the Service at any time without notice.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">6. Materials and Content</h2>
          <p className="text-muted-foreground mb-4">
            Unless otherwise stated, RedFox CRM and/or its licensors own the intellectual property rights for all material on the Service. All intellectual property rights are reserved. You may access this from the Service for your personal use subject to restrictions set in these terms and conditions.
          </p>
          <p className="text-muted-foreground mb-4">
            You must not reproduce, redistribute, transmit, or publish any content from the Service without our written permission or proper attribution.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">7. User-Generated Content</h2>
          <p className="text-muted-foreground mb-4">
            You retain all rights to any content you submit, post, or display on or through the Service. By submitting, posting, or displaying content on the Service, you grant RedFox CRM a worldwide, non-exclusive, royalty-free license to use, modify, and distribute such content.
          </p>
          <p className="text-muted-foreground mb-4">
            You represent and warrant that: (i) you own or have the necessary licenses, rights, consents, and permissions to use the content; (ii) the content does not infringe any third-party intellectual property rights; and (iii) the content does not contain any viruses, malware, or other harmful code.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">8. User Accounts</h2>
          <p className="text-muted-foreground mb-4">
            When you create an account with us, you must provide accurate, complete, and current information. You are responsible for maintaining the confidentiality of your password and account information and for all activity that occurs under your account. You agree to notify us immediately of any unauthorized use of your account.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">9. Prohibited Conduct</h2>
          <p className="text-muted-foreground mb-4">
            You agree not to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe upon the intellectual property rights of others</li>
            <li>Harass, abuse, or threaten other users</li>
            <li>Transmit malware or malicious code</li>
            <li>Attempt to gain unauthorized access to the Service</li>
            <li>Use automated tools to access the Service without permission</li>
            <li>Engage in any form of spam or unsolicited communications</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">10. Limitation of Subscription</h2>
          <p className="text-muted-foreground mb-4">
            You may cancel your subscription at any time. Cancellation will take effect at the end of your current billing cycle. You will not receive a refund of any fees already paid for the current billing period.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">11. Payment Terms</h2>
          <p className="text-muted-foreground mb-4">
            You agree to pay all charges and fees that are incurred through your account at the rates in effect at the time the charges are incurred. All fees are exclusive of applicable sales tax. You are responsible for paying all sales tax, VAT, or other taxes that may apply.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">12. Service Level Agreement</h2>
          <p className="text-muted-foreground mb-4">
            RedFox CRM strives to maintain a 99.5% uptime guarantee for the Service. In the event of service interruptions, we will work diligently to restore service. However, we are not liable for damages resulting from service interruptions, except as provided in our Service Level Agreement (SLA) for Enterprise customers.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">13. Modifications to Service</h2>
          <p className="text-muted-foreground mb-4">
            RedFox CRM reserves the right to modify or discontinue, temporarily or permanently, the Service (or any part thereof) with or without notice. You agree that RedFox CRM will not be liable to you or to any third party for any modification, suspension, or discontinuance of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">14. Indemnification</h2>
          <p className="text-muted-foreground mb-4">
            You agree to indemnify and hold harmless RedFox CRM and its officers, directors, employees, agents, and successors from any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or relating to your use of the Service or violation of these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">15. Governing Law</h2>
          <p className="text-muted-foreground mb-4">
            These terms and conditions are governed by and construed in accordance with the laws of the United States, and you irrevocably submit to the exclusive jurisdiction of the courts located in Austin, Texas.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">16. Changes to Terms</h2>
          <p className="text-muted-foreground mb-4">
            RedFox CRM reserves the right to modify these Terms at any time. We will notify you of significant changes by posting the updated Terms on this page and updating the "effective date" at the top of these Terms. Your continued use of the Service following the posting of revised Terms means that you accept and agree to the changes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">17. Contact Us</h2>
          <p className="text-muted-foreground mb-4">
            If you have any questions about these Terms, please contact us at:
          </p>
          <div className="text-muted-foreground space-y-1">
            <p>RedFox CRM</p>
            <p>Email: legal@redfoxcrm.com</p>
            <p>Support: <Link href="/landing/support" className="text-primary hover:text-primary/80">Contact Support</Link></p>
          </div>
        </section>
      </div>
    </div>
  );
}

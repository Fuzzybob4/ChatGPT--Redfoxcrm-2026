import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - RedFox CRM',
  description: 'RedFox CRM Privacy Policy. Learn how we protect your data.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8">
        Last updated: July 6, 2025
      </p>

      <div className="prose prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">1. Introduction</h2>
          <p className="text-muted-foreground mb-4">
            RedFox CRM ("Company", "we", "our", or "us") operates the RedFox CRM website and application. This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">2. Information Collection and Use</h2>
          <p className="text-muted-foreground mb-4">
            We collect several different types of information for various purposes to provide and improve our Service to you.
          </p>
          <h3 className="text-xl font-semibold text-foreground mb-2 mt-4">Types of Data Collected:</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Account information (name, email, phone, company name)</li>
            <li>Customer information (contact details, service history, photos)</li>
            <li>Job and estimate data (dates, amounts, descriptions)</li>
            <li>Payment information (processed securely through third-party providers)</li>
            <li>Usage data (pages visited, features used, time spent)</li>
            <li>Device information (IP address, browser type, operating system)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">3. Use of Data</h2>
          <p className="text-muted-foreground mb-4">
            RedFox CRM uses the collected data for various purposes:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>To provide and maintain our Service</li>
            <li>To notify you about changes to our Service</li>
            <li>To allow you to participate in interactive features of our Service</li>
            <li>To provide customer support</li>
            <li>To gather analysis or valuable information to improve our Service</li>
            <li>To monitor the usage of our Service</li>
            <li>To detect, prevent, and address technical and security issues</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">4. Security of Data</h2>
          <p className="text-muted-foreground mb-4">
            The security of your data is important to us, but remember that no method of transmission over the Internet or method of electronic storage is 100% secure. We use industry-standard encryption and security protocols to protect your information, including SSL/TLS encryption for data in transit and encrypted storage for data at rest.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">5. Data Retention</h2>
          <p className="text-muted-foreground mb-4">
            RedFox CRM will retain your Personal Data only for as long as necessary for the purposes set out in this Privacy Policy. We will retain and use your Personal Data to the extent necessary to comply with our legal obligations.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">6. Sharing of Information</h2>
          <p className="text-muted-foreground mb-4">
            We do not sell, trade, or rent your personal information to third parties. We may share information only in the following circumstances:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>With third-party service providers who assist us in operating our website and conducting our business</li>
            <li>In response to legal process or government requests</li>
            <li>To protect the rights, privacy, safety, or property of RedFox CRM</li>
            <li>With your explicit consent for specific purposes</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">7. Your Rights</h2>
          <p className="text-muted-foreground mb-4">
            You have the right to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate personal data</li>
            <li>Request deletion of your personal data</li>
            <li>Opt out of marketing communications</li>
            <li>Data portability (receive your data in a structured, commonly used format)</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            To exercise these rights, please contact us at privacy@redfoxcrm.com.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">8. Cookies</h2>
          <p className="text-muted-foreground mb-4">
            We use cookies and similar tracking technologies to track activity on our Service. We use both session ID cookies and persistent cookies. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">9. Third-Party Links</h2>
          <p className="text-muted-foreground mb-4">
            Our Service may contain links to other sites that are not operated by us. This Privacy Policy applies only to our Service. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services. We encourage you to review the Privacy Policy of any site before providing your personal information.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">10. GDPR Compliance</h2>
          <p className="text-muted-foreground mb-4">
            RedFox CRM is GDPR compliant and follows all data protection requirements for users in the European Union and other regions with similar data protection regulations.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">11. Changes to This Privacy Policy</h2>
          <p className="text-muted-foreground mb-4">
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "effective date" at the top of this Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">12. Contact Us</h2>
          <p className="text-muted-foreground mb-4">
            If you have any questions about this Privacy Policy, please contact us at:
          </p>
          <div className="text-muted-foreground space-y-1">
            <p>RedFox CRM</p>
            <p>Email: privacy@redfoxcrm.com</p>
            <p>Support: <Link href="/landing/support" className="text-primary hover:text-primary/80">Contact Support</Link></p>
          </div>
        </section>
      </div>
    </div>
  );
}

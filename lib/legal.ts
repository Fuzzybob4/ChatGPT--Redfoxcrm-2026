/**
 * RedFox CRM Terms of Service and Privacy Policy.
 * Bump LEGAL_VERSION when either document changes in a way businesses should
 * re-accept; every business owner is then asked to accept on their next visit.
 */
export const LEGAL_VERSION = "2026-11-11";
export const LEGAL_UPDATED = "November 11, 2026";
export const LEGAL_EMAIL = "legal@redfoxcrm.com";
export const PRIVACY_EMAIL = "privacy@redfoxcrm.com";

export type LegalBlock = string | { list: string[] };
export interface LegalSection {
  id: string;
  title: string;
  body: LegalBlock[];
}

export const TERMS: LegalSection[] = [
  {
    id: "agreement",
    title: "1. The agreement",
    body: [
      'These Terms of Service ("Terms") are a contract between RedFox CRM ("RedFox," "we," "us") and the business that creates an account ("you," "your business"). They cover the RedFox CRM website, office app, crew app, customer portal, and related services (the "Service").',
      "The Service is for business use only. By checking the box at signup, clicking \"I agree,\" or using the Service, you accept these Terms and our Privacy Policy. If you accept on behalf of a business, you confirm you have authority to bind it.",
    ],
  },
  {
    id: "accounts",
    title: "2. Accounts and users",
    body: [
      "You are responsible for your account, everyone you invite (office staff, crew leads, installers), what they do in the Service, and keeping logins secure. Tell us right away at " +
        LEGAL_EMAIL +
        " if you think an account has been compromised.",
      "You must give accurate business and billing information and keep it current.",
    ],
  },
  {
    id: "billing",
    title: "3. Free trial, subscription, and billing",
    body: [
      {
        list: [
          "New businesses get a 30-day free trial. A card is collected at signup. Unless you cancel before the trial ends, your plan starts and your card is charged.",
          "Subscriptions renew automatically each month or year, based on the plan you pick, until cancelled. You can cancel at any time; cancellation takes effect at the end of the current billing period.",
          "Fees are non-refundable, including for partial periods, unless the law requires otherwise.",
          "We may change prices with at least 30 days' notice. The new price applies at your next renewal.",
          "You are responsible for applicable taxes. If a payment fails, we may suspend the Service until the balance is paid.",
          "Card payments are processed by Stripe. We never see or store full card numbers.",
        ],
      },
    ],
  },
  {
    id: "your-data",
    title: "4. Your data",
    body: [
      '"Your Data" means the information you or your users put into or connect to the Service: your customers, their contact details and addresses, estimates, invoices, payments, job schedules, photos, notes, crew records, and time entries.',
      "You own Your Data. You give us permission to host, store, back up, copy, process, transmit, and display Your Data only as needed to run, secure, support, and improve the Service for you, and as described in Section 5.",
      "You are responsible for having the right to put Your Data into the Service, including any notices or consents your customers and employees need, and for following the laws that apply to messages you send through the Service, including CAN-SPAM, the TCPA, and do-not-contact requests.",
      "We will not sell Your Data, rent or hand out your customer lists, or contact your customers to market our own products or anyone else's.",
    ],
  },
  {
    id: "aggregated-data",
    title: "5. Usage data and aggregated, de-identified data",
    body: [
      'Usage data. We collect information about how the Service is used, such as features used, pages visited, device and browser type, errors, and performance ("Usage Data"). We use it to run, secure, and improve the Service.',
      'Aggregated data. We may also create information from Your Data and Usage Data that is de-identified and combined with data from other businesses, so it does not identify you, your business, your employees, or your customers ("Aggregated Data"). Examples include:',
      {
        list: [
          "Industry-level counts and trends: installs and removals per season, job sizes and crew hours, booking and rebooking rates.",
          "Revenue and pricing ranges and averages across many businesses, such as average job value by region or service type.",
          "Where demand is concentrated and what customers buy, at the market or ZIP-code level, never tied to a named person or address.",
          "Seasonality, scheduling patterns, and how features are used.",
        ],
      },
      "We may use Aggregated Data to improve RedFox, build new features (such as pricing guidance, benchmarks, and forecasting), publish industry reports and benchmarks, and for other lawful business purposes. We own Aggregated Data, and this right continues after your account ends.",
      "Our promises about Aggregated Data:",
      {
        list: [
          "We take reasonable steps so it cannot be linked back to you, your business, or any person, and we will not try to re-identify it.",
          "We only publish or share figures built from multiple businesses, never your business's own revenue, customer list, or results in a way others could pick out.",
          "We do not sell personal information about you, your employees, or your customers.",
        ],
      },
      "Before we use Your Data in a new way that is materially different from this section, we will tell you in advance and ask you to accept the change. It will not apply retroactively without your agreement.",
    ],
  },
  {
    id: "integrations",
    title: "6. Connected apps and third parties",
    body: [
      "If you connect other services (for example Stripe, Square, HubSpot, Google, or email and text providers), you authorize us to exchange data with them so the connection works. Those services are governed by their own terms and privacy policies, and we are not responsible for them.",
    ],
  },
  {
    id: "acceptable-use",
    title: "7. Acceptable use",
    body: [
      "You agree not to:",
      {
        list: [
          "Send spam, or message people who opted out or asked not to be contacted.",
          "Upload content that is unlawful, infringing, or harmful, or that you don't have the right to use.",
          "Attempt to access another business's data, probe or break the Service's security, or overload the Service.",
          "Copy, resell, reverse engineer, or build a competing product from the Service.",
          "Use the Service in violation of any law.",
        ],
      },
      "We may suspend accounts that break these rules or put the Service or other customers at risk.",
    ],
  },
  {
    id: "security",
    title: "8. Security and confidentiality",
    body: [
      "We use reasonable administrative, technical, and physical safeguards to protect Your Data, including keeping each business's data separate from every other business's. No system is perfectly secure. If we learn of a breach that affects Your Data, we will notify you without unreasonable delay.",
      "Our staff access Your Data only to provide support you request, keep the Service secure and running, or meet legal requirements.",
    ],
  },
  {
    id: "termination",
    title: "9. Cancelling, termination, and your data afterwards",
    body: [
      "You can cancel at any time in Settings or by contacting us. We may end or suspend the Service if you seriously or repeatedly break these Terms or don't pay.",
      "After your account ends, you have 30 days to export Your Data. After that we may delete it. Copies in backups are deleted on our normal backup schedule, and we may keep records the law requires us to keep. Aggregated Data is not deleted.",
    ],
  },
  {
    id: "changes-service",
    title: "10. Changes to the Service",
    body: [
      "We regularly add, change, and remove features. If we remove a feature you rely on in a way that materially reduces the Service, you can cancel and we will refund any prepaid fees for the unused part of your billing period.",
    ],
  },
  {
    id: "disclaimers",
    title: "11. Disclaimers",
    body: [
      'The Service is provided "as is" and "as available." To the fullest extent the law allows, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. Scheduling, routing, pricing suggestions, weather, and similar tools are aids; you remain responsible for your business decisions, your crews, and your work sites.',
    ],
  },
  {
    id: "liability",
    title: "12. Limitation of liability",
    body: [
      "To the fullest extent the law allows, neither party is liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, or data. Our total liability for any claim relating to the Service is limited to the amount you paid us in the 12 months before the claim arose.",
    ],
  },
  {
    id: "indemnity",
    title: "13. Indemnification",
    body: [
      "You will defend and indemnify RedFox against third-party claims arising from Your Data, the messages you send through the Service, your work for your customers, or your breach of these Terms.",
    ],
  },
  {
    id: "changes-terms",
    title: "14. Changes to these Terms",
    body: [
      "We may update these Terms. For material changes, we will give at least 30 days' notice by email or in the app, and we will ask you to accept them. Changes apply going forward. If you don't agree, you may cancel before they take effect.",
    ],
  },
  {
    id: "law",
    title: "15. Governing law",
    body: [
      "These Terms are governed by the laws of the State of Texas, without regard to conflict-of-law rules. Any dispute will be brought in the state or federal courts located in Travis County, Texas, and both parties consent to those courts.",
    ],
  },
  {
    id: "general",
    title: "16. General",
    body: [
      "These Terms and the Privacy Policy are the entire agreement between us about the Service. If any part is found unenforceable, the rest remains in effect. Not enforcing a right is not a waiver of it. You may not transfer these Terms without our consent; we may transfer them in connection with a merger, acquisition, or sale of assets.",
    ],
  },
  {
    id: "contact",
    title: "17. Contact",
    body: ["Questions about these Terms: " + LEGAL_EMAIL],
  },
];

export const PRIVACY: LegalSection[] = [
  {
    id: "intro",
    title: "1. Who this covers",
    body: [
      "This Privacy Policy explains how RedFox CRM collects and uses information. It covers (a) the businesses that use RedFox and their staff and crew, and (b) visitors to our website.",
      "Each business decides what information about its own customers goes into RedFox. For that information, the business is in charge of it and RedFox acts as its service provider. If you are a customer of a business that uses RedFox, please contact that business about your information.",
    ],
  },
  {
    id: "collect",
    title: "2. Information we collect",
    body: [
      {
        list: [
          "Account information: business name, owner and user names, email, phone, address, and login details.",
          "Billing information: plan, billing history, and card brand and last 4 digits. Stripe processes card payments; we never receive full card numbers.",
          "Business data you put into RedFox: your customers, addresses, estimates, invoices, payments, schedules, photos, notes, crew records, and time entries.",
          "Crew app location: when a crew member taps Start day, End day, or Start job, the crew app records the device's location at that moment so the business can see where work started and ended. We do not track location continuously.",
          "Usage and device data: pages and features used, device and browser type, IP address, errors, and performance, collected through logs and cookies.",
          "Information from connected apps you choose to link, such as Stripe, Square, HubSpot, or Google.",
        ],
      },
    ],
  },
  {
    id: "use",
    title: "3. How we use it",
    body: [
      {
        list: [
          "To provide the Service: scheduling, invoicing, payments, crew tools, customer portal, and emails and texts the business sends.",
          "To provide support, keep the Service secure, prevent fraud, and fix problems.",
          "To bill your subscription.",
          "To improve RedFox and build new features, including with aggregated, de-identified data as described below.",
          "To send you account, billing, and product updates. You can unsubscribe from marketing emails at any time; account and billing messages will still be sent.",
          "To meet legal obligations.",
        ],
      },
    ],
  },
  {
    id: "aggregated",
    title: "4. Aggregated and de-identified data",
    body: [
      "We may combine information from many businesses and remove anything that identifies a business or a person, for example, average job value by region, installs per season, or demand by ZIP code. We use this to improve RedFox, offer benchmarks and pricing guidance, and publish industry reports. We take reasonable steps so this data cannot be linked back to a business or person, we commit not to re-identify it, and we require anyone we share it with to do the same.",
    ],
  },
  {
    id: "share",
    title: "5. How we share information",
    body: [
      "We do not sell personal information, and we do not share it for cross-context behavioral advertising. We share information only:",
      {
        list: [
          "With service providers who help us run RedFox, under contracts that limit their use of the data. These include hosting and database (Vercel, Supabase), payments (Stripe), email delivery, maps and address lookup (Google), and error monitoring.",
          "With apps you choose to connect, so the connection works.",
          "When the law requires it, or to protect the rights, safety, and security of RedFox, our users, or others.",
          "In a merger, acquisition, or sale of assets, subject to this Policy.",
          "With your permission.",
        ],
      },
    ],
  },
  {
    id: "retention",
    title: "6. How long we keep it",
    body: [
      "We keep account and business data while your account is active. After cancellation you have 30 days to export it. We then delete it, except for backups (deleted on our normal schedule) and records we must keep for tax, accounting, or legal reasons. Aggregated, de-identified data may be kept.",
    ],
  },
  {
    id: "security",
    title: "7. Security",
    body: [
      "We use encryption in transit, access controls, and database rules that keep each business's data separate. No method of storage or transmission is 100% secure, but we work to protect your information and will notify affected businesses of a breach as the law requires.",
    ],
  },
  {
    id: "rights",
    title: "8. Your choices and rights",
    body: [
      "You can view and update most information in the app. Depending on where you live, including Texas and California, you may have the right to access, correct, delete, or get a copy of your personal information, and to opt out of targeted advertising, sales, or profiling. Email " +
        PRIVACY_EMAIL +
        " to make a request; we will respond within the time the law requires and won't treat you differently for exercising your rights. If we deny a request, you can appeal by replying to our response.",
      "If you are a customer of a business that uses RedFox, we will forward your request to that business.",
    ],
  },
  {
    id: "cookies",
    title: "9. Cookies",
    body: [
      "We use cookies needed to keep you signed in and the Service working, and basic analytics to understand how the site is used. You can control cookies in your browser; blocking required cookies may stop the Service from working.",
    ],
  },
  {
    id: "children",
    title: "10. Children",
    body: ["RedFox is a business tool and is not directed to children under 13. We do not knowingly collect their information."],
  },
  {
    id: "changes",
    title: "11. Changes to this Policy",
    body: [
      "We will post updates here and change the date above. For material changes, especially any new use of your data, we will notify you in advance by email or in the app and ask businesses to accept them before they apply.",
    ],
  },
  {
    id: "contact",
    title: "12. Contact",
    body: ["Privacy questions or requests: " + PRIVACY_EMAIL],
  },
];

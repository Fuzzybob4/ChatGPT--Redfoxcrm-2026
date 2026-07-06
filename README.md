# RedFox CRM 2026

Fresh RedFox CRM build inspired by the previous version, rebuilt around the simplest MVP flow.

## MVP flow

Customer profile -> service property -> job -> invoice -> customer portal approval.

## Current foundation

- Next.js app router
- TypeScript
- Tailwind CSS
- RedFox branded shell
- Client profiles
- Job board
- Invoice add-on builder
- Customer portal preview
- Integration checklist

## Local setup

```bash
npm install
npm run dev
```

## Integrations to connect

- Supabase for auth and database
- Stripe for payments
- Resend for emails
- Mapbox for routing and maps
- Vercel for hosting and DNS

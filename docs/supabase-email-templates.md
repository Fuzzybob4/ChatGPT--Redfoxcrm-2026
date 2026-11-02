# Supabase auth email templates and URL settings

These settings live in the Supabase dashboard, not in the repo. **Nothing here
has been applied.** Change them by hand only after the code in this branch is
deployed to production, because the new links need `/auth/confirm` to support
`token_hash`.

## Why

The stock templates use `{{ .ConfirmationURL }}`. For password reset that is a
PKCE `?code=` link, and the code only works in the browser that requested the
reset (it needs a verifier cookie). Opening the email on a phone or in another
browser fails. For invites, the link carries tokens in a `#fragment` and lands
on the Site URL root, which ignores them.

The templates below send a `token_hash` to `/auth/confirm`, which calls
`verifyOtp({ token_hash, type })` on the server. That works in any browser.

`/auth/confirm` still accepts the old `?code=` and `#access_token` links, so
emails sent before or after the template change keep working.

## Authentication → URL Configuration

- **Site URL:** `https://www.redfoxcrm.com`
  - Verify the current value. It appears to be `http://redfoxcrm.com`, which is
    where broken invite links have been landing.
- **Redirect URLs (allowlist):**
  - `https://www.redfoxcrm.com/**`
  - `http://localhost:3000/**` (local development)
  - `https://redfoxcrm.com/**` (optional, only if the apex is still used)
  - Add preview URLs only if you test auth on previews. Previews without
    `NEXT_PUBLIC_SITE_URL` build links that point to production.

If `redirectTo` is not on the allowlist, Supabase silently uses the Site URL
instead. That is how invites lost their destination before.

## Authentication → Email Templates

Keep the subject and body copy. Replace only the link `href`.

### Invite user

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next={{ .RedirectTo }}">Accept the invite</a>
```

`next` must stay **last**. `{{ .RedirectTo }}` is the full URL passed by the app,
for example `https://www.redfoxcrm.com/auth/confirm?next=/auth/set-password`.
Its own `?next=` is unwrapped server-side, and only same-site paths are kept.
This also keeps the admin invite flow (`/admin/setup`) working.

Alternative (simpler, but every invite goes to crew setup, including admin
invites from `app/admin/actions.ts`):

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password">Accept the invite</a>
```

### Reset password

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}">Reset your password</a>
```

The app sends `redirectTo = https://www.redfoxcrm.com/auth/confirm?next=/update-password`.
If `next` is missing or untrusted, recovery defaults to `/update-password`.

### Confirm signup / Magic link (optional, same pattern)

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Confirm your email</a>
```

## Link lifetime

- Each link works once. The default expiry is 1 hour (Auth → Providers → Email
  → "Email OTP Expiration"). Expired or used links go to `/auth/error` with
  a "send a new reset link" option. For invites, the copy says to ask for a
  new invite.
- Owners can resend an invite from **Crew → Invite** with the same email.

## Deliverability (to verify; not checked)

- [ ] **Custom SMTP.** Supabase's built-in sender is rate-limited (a few emails
  per hour) and is meant for testing. Configure custom SMTP (for example Resend)
  under Auth → SMTP Settings, with a sender such as `no-reply@redfoxcrm.com`.
- [ ] **SPF** for the sending domain includes the SMTP provider.
- [ ] **DKIM** records for the provider are published and verified.
- [ ] **DMARC** record exists (start with `p=none` and monitoring).
- [ ] Sender name and reply-to look like RedFox CRM, not Supabase.
- [ ] **Link scanners.** Some corporate mail scanners open links before the
  user does, which can use up a one-time `token_hash`. If customers report
  "link already used" right away, add a confirm-button page that verifies on
  POST (follow-up; not in this change).

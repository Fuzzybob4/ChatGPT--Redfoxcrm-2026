import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isReusableSignupCustomer,
  profileFromSignupMetadata,
  publicAppUrl,
  signupCheckoutReturnUrl,
} from './signup-policy.ts';

describe('publicAppUrl', () => {
  it('prefers NEXT_PUBLIC_APP_URL and strips a trailing slash', () => {
    assert.equal(
      publicAppUrl({
        NEXT_PUBLIC_APP_URL: 'https://www.redfoxcrm.com/',
        VERCEL_ENV: 'production',
        VERCEL_URL: 'redfox-crm-abc.vercel.app',
      }),
      'https://www.redfoxcrm.com',
    );
  });

  it('does not use the protected VERCEL_URL host in production', () => {
    assert.equal(
      publicAppUrl({
        VERCEL_ENV: 'production',
        VERCEL_URL: 'redfox-crm-abc.vercel.app',
      }),
      'https://www.redfoxcrm.com',
    );
  });

  it('uses the deployment host on preview when no public app url is set', () => {
    assert.equal(
      publicAppUrl({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'redfox-crm-git-preview.vercel.app',
      }),
      'https://redfox-crm-git-preview.vercel.app',
    );
  });
});

describe('signupCheckoutReturnUrl', () => {
  it('keeps the Stripe session id placeholder unencoded', () => {
    assert.equal(
      signupCheckoutReturnUrl('https://www.redfoxcrm.com'),
      'https://www.redfoxcrm.com/signup?session_id={CHECKOUT_SESSION_ID}',
    );
  });
});

describe('isReusableSignupCustomer', () => {
  const customer = {
    email: 'owner@example.com',
    metadata: { purpose: 'redfox_signup' },
  };

  it('reuses an abandoned signup customer with the same email', () => {
    assert.equal(isReusableSignupCustomer(customer, 'Owner@Example.com', 0), true);
  });

  it('does not reuse a customer that has ever had a subscription', () => {
    assert.equal(isReusableSignupCustomer(customer, 'owner@example.com', 1), false);
  });

  it('does not reuse an untagged customer', () => {
    assert.equal(
      isReusableSignupCustomer({ email: 'owner@example.com', metadata: {} }, 'owner@example.com', 0),
      false,
    );
  });
});

describe('profileFromSignupMetadata', () => {
  it('clamps plan, interval, and location count', () => {
    const profile = profileFromSignupMetadata({
      full_name: 'Ada Lovelace',
      location_name: 'Austin',
      plan: 'nope',
      billing_interval: 'yearly',
      location_count: '500',
    });
    assert.deepEqual(profile, {
      fullName: 'Ada Lovelace',
      locationName: 'Austin',
      plan: 'starter',
      billingInterval: 'yearly',
      locationCount: '1',
    });
  });
});

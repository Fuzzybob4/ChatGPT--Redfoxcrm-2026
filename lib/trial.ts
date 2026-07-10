// Pure helpers for computing trial / subscription state. Safe on client & server.

export interface TrialInput {
  trialEndsAt: string | null;
  subscriptionStatus: string;
}

export interface TrialState {
  isActive: boolean;
  isTrialing: boolean;
  /** Whole days remaining in the trial (0 when expired). Null when no trial set. */
  daysLeft: number | null;
  expired: boolean;
  /** True when the app should be blocked behind the paywall. */
  shouldBlock: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getTrialState({ trialEndsAt, subscriptionStatus }: TrialInput): TrialState {
  const isActive = subscriptionStatus === 'active';

  if (!trialEndsAt) {
    // No trial info (e.g. legacy orgs) — never block.
    return { isActive, isTrialing: false, daysLeft: null, expired: false, shouldBlock: false };
  }

  const end = new Date(trialEndsAt).getTime();
  const now = Date.now();
  const expired = now >= end;
  const daysLeft = expired ? 0 : Math.ceil((end - now) / DAY_MS);

  return {
    isActive,
    isTrialing: !isActive && !expired,
    daysLeft,
    expired,
    shouldBlock: !isActive && expired,
  };
}

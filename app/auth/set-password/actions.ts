'use server';

import { createClient } from '@/lib/supabase/server';
import { acceptCrewInviteForUser, lookupCrewInviteForUser, type AcceptCrewInviteResult } from '@/lib/crew-invite';
import { changePasswordWithIntent, passwordChangeAllowed, stampAuthIntentFromSession } from '@/lib/password-change';

export type CompleteInviteResult = { ok: true; next: string } | { ok: false; error: string };

function inviteErrorMessage(error: Extract<AcceptCrewInviteResult, { ok: false }>['error']): string {
  if (error === 'no_invite') {
    return "We couldn't find a pending invite for this email. Ask your employer to send a new one.";
  }
  if (error === 'ambiguous_invite') {
    return 'More than one business has invited this email. Ask your employer to resend the invite.';
  }
  return 'Something went wrong finishing your invite. Please try again.';
}

export async function invitePasswordAllowed() {
  return passwordChangeAllowed('invite');
}

export async function stampInviteIntent() {
  return stampAuthIntentFromSession('invite');
}

/** Sets the invited user's password only after a pending invite is confirmed. */
export async function completeInviteAction(password: string): Promise<CompleteInviteResult> {
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Your invite session has expired. Ask your employer to send a new invite.' };
  }

  const preview = await lookupCrewInviteForUser(user);
  if (!preview.ok) return { ok: false, error: inviteErrorMessage(preview.error) };
  if (preview.profileCompleted) {
    return { ok: false, error: 'This invite was already accepted. Sign in with your password.' };
  }

  const updated = await changePasswordWithIntent('invite', password);
  if (!updated.ok) return updated;

  const result = await acceptCrewInviteForUser(user);
  if (!result.ok) return { ok: false, error: inviteErrorMessage(result.error) };

  return { ok: true, next: result.profileCompleted ? '/dashboard' : '/crew-setup/profile' };
}

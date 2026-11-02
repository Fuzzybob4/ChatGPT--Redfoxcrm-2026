'use server'

import { changePasswordWithIntent, passwordChangeAllowed, stampAuthIntentFromSession } from '@/lib/password-change'

export async function recoveryPasswordAllowed() {
  return passwordChangeAllowed('recovery')
}

export async function stampRecoveryIntent() {
  return stampAuthIntentFromSession('recovery')
}

export async function updatePasswordAction(password: string) {
  return changePasswordWithIntent('recovery', password)
}

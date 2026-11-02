'use server'

import { changePasswordWithIntent, passwordChangeAllowed } from '@/lib/password-change'

export async function adminPasswordAllowed() {
  return passwordChangeAllowed(['invite', 'recovery'])
}

export async function setAdminPasswordAction(password: string) {
  return changePasswordWithIntent(['invite', 'recovery'], password)
}

import { redirect } from 'next/navigation';

// Step 1 (password) now lives at /auth/set-password, which also links the
// invite and creates the membership server-side.
export default function CrewSetupPage() {
  redirect('/auth/set-password');
}

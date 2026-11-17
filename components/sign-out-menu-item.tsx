"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

/** Sign out. Not a <Link>: Next.js would prefetch it and sign the user out just from opening the menu. */
export function SignOutMenuItem() {
  return (
    <DropdownMenuItem
      className="text-destructive"
      onClick={() => {
        window.location.href = "/auth/signout";
      }}
    >
      Sign out
    </DropdownMenuItem>
  );
}

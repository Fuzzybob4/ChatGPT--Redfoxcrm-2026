"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function FieldHeader({ name, officeLink }: { name: string; officeLink: boolean }) {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
        <Link href="/field" className="flex min-h-11 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-primary">
            <Image src="/favicon.png" alt="" width={22} height={22} className="size-5 object-contain" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight text-foreground">RedFox Field</span>
            <span className="max-w-40 truncate text-xs text-muted-foreground">{name}</span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {officeLink && (
            <Link
              href="/dashboard"
              className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Office
            </Link>
          )}
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

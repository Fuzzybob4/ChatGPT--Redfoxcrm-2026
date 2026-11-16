'use client';

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LocationSelector } from "@/components/location-selector";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    // Phones: title on its own row, page buttons on a second row that scrolls
    // sideways if needed, so neither gets squeezed. Wider screens: one row.
    <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-border bg-background px-4 py-2.5 sm:h-14 sm:flex-nowrap sm:py-0">
      <SidebarTrigger className="-ml-1 size-8" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="contents sm:flex sm:min-w-0 sm:flex-1 sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:flex-none">
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground text-base leading-none truncate">
              {title}
            </h1>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
            )}
          </div>
          {/* On phones there's no room beside the page buttons; the location picker shows on wider screens. */}
          <div className="hidden items-center gap-4 md:flex">
            <Separator orientation="vertical" className="h-6" />
            <LocationSelector />
          </div>
        </div>
        {actions && (
          <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:shrink-0 sm:overflow-visible sm:px-0 sm:pb-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

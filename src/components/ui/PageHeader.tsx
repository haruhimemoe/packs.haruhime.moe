/**
 * @file src/components/ui/PageHeader.tsx
 * @desc The one way to title a page: h1 at the shared scale, optional lead, meta line, actions.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

type PageHeaderProps = {
  title: ReactNode;
  lead?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, lead, meta, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 max-w-3xl">
        <h1 className="wrap-anywhere font-extrabold text-3xl text-c1 tracking-tight sm:text-4xl">
          {title}
        </h1>
        {lead ? <p className="mt-2 max-w-2xl text-base text-c3 sm:text-lg">{lead}</p> : null}
        {meta ? <p className="mt-2 text-c4 text-sm">{meta}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

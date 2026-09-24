/**
 * @file src/components/ui/Card.tsx
 * @desc osu!-web panel: rounded b4 surface, optional h2 title that labels the region.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { type ComponentProps, useId } from "react";
import { cn } from "@/utils/cn";

type CardProps = ComponentProps<"section"> & { title?: string };

export function Card({ title, className, children, ...props }: CardProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn("rounded-[10px] bg-b4 p-5 text-c2", className)}
      {...props}
    >
      {title ? (
        <h2 id={headingId} className="mb-2 font-bold text-c1 text-lg">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

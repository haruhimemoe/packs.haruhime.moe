/**
 * @file src/components/ui/Prose.tsx
 * @desc Long-form typography for MDX content, styled with the osu!-web tokens.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-3xl text-c2 leading-relaxed [&_a:hover]:text-c1 [&_a]:text-h1 [&_a]:underline [&_code]:rounded [&_code]:bg-b4 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-bold [&_h2]:text-2xl [&_h2]:text-c1 [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-bold [&_h3]:text-c1 [&_h3]:text-lg [&_hr]:my-8 [&_hr]:border-b3 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_pre]:mt-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-b6 [&_pre]:p-3 [&_pre]:text-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:text-c1 [&_table]:mt-4 [&_table]:w-full [&_table]:text-sm [&_td]:border-b3 [&_td]:border-b [&_td]:px-2 [&_td]:py-1.5 [&_th]:border-b3 [&_th]:border-b [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-c1 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * @file src/app/(public)/new/page.tsx
 * @desc /new: the anonymous pack builder.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { PackBuilder } from "@/components/pack/PackBuilder";

export const metadata: Metadata = {
  title: "New pack",
  description: "Build an osu! beatmap pack from IDs, links, or a pasted mappool.",
  alternates: { canonical: "/new" },
};

export default function NewPackPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New pack"
        lead="Your draft saves in this browser as you go. Share it with the pack key when you're done."
      />
      <PackBuilder />
    </div>
  );
}

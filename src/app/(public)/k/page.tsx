/**
 * @file src/app/(public)/k/page.tsx
 * @desc /k#<pack key>: open a shared pack. The key lives in the fragment, so it never reaches the
 *       server or its logs; all decoding happens in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { Metadata } from "next";
import { PackKeyView } from "@/components/pack/PackKeyView";

export const metadata: Metadata = {
  title: "Open pack",
  description: "Open an osu! beatmap pack from a pack key.",
  // Every /k URL renders the same shell (the key lives in the #fragment): nothing to index.
  robots: { index: false, follow: true },
};

export default function OpenPackPage() {
  return <PackKeyView />;
}

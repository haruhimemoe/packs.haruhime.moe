/**
 * @file src/app/(public)/k/page.tsx
 * @desc /k#<pack key>: open a shared pack. The key lives in the fragment, so it never reaches the
 *       server or its logs; all decoding happens in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import type { Metadata } from "next";
import { PackKeyView } from "@/components/pack/PackKeyView";
import { SEO_SITE } from "@/constants/seo";

// Every /k URL renders the same shell (the key lives in the #fragment): nothing to index.
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/k",
  title: "Open a pack key",
  description: "Open an osu! beatmap pack from a pack key.",
  index: false,
});

/**
 * @function OpenPackPage
 * @returns {JSX.Element} the page
 */
export default function OpenPackPage() {
  return <PackKeyView />;
}

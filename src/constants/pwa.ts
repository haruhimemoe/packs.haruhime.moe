/**
 * @file src/constants/pwa.ts
 * @desc The app as an installable web app: names, description and the hue its home-screen
 *       window, splash screen and offline page are colored with (globals.css's --hue).
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Oct 9, 2026
 * @modified Fri Oct 9, 2026
 */

import type { PwaApp } from "@haruhimemoe/next-kit/pwa";
import { SEO_SITE } from "@/constants/seo";

/** What next-kit's pwa helpers need to know about this app. */
export const PWA: PwaApp = {
  name: SEO_SITE.name,
  shortName: "packs",
  description: SEO_SITE.description,
  hue: 30,
};

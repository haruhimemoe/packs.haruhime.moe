/**
 * @file src/app/manifest.ts
 * @desc The web app manifest (/manifest.webmanifest): installs the app standalone, colored
 *       like the page, with home-screen shortcuts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Oct 9, 2026
 * @modified Fri Oct 9, 2026
 */

import { pwaManifest } from "@haruhimemoe/next-kit/pwa";
import type { MetadataRoute } from "next";
import { PWA } from "@/constants/pwa";

/**
 * @function manifest
 * @returns {MetadataRoute.Manifest} the app's manifest, from next-kit's pwaManifest
 */
export default function manifest(): MetadataRoute.Manifest {
  return pwaManifest(PWA, {
    shortcuts: [
      { name: "New pack", url: "/new" },
      { name: "Public packs", url: "/packs" },
    ],
  });
}

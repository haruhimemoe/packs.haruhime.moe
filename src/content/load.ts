/**
 * @file src/content/load.ts
 * @desc One MDX loader per registered content page, by section and slug. Static imports:
 *       @next/mdx compiles only files named in the source, so each page is listed here
 *       (tests/unit/content/registry.test.ts holds it to the registry and the files on disk).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import type { ContentSection } from "@haruhimemoe/next-kit/docs";
import type { ComponentType } from "react";

type Loader = () => Promise<{ default: ComponentType }>;

/** Static imports: @next/mdx compiles only files named in the source. */
export const LOADERS: Partial<Record<ContentSection, Record<string, Loader>>> = {
  docs: { api: () => import("@content/docs/api.mdx") },
  guides: {
    "make-a-pack": () => import("@content/guides/make-a-pack.mdx"),
    "osu-collections": () => import("@content/guides/osu-collections.mdx"),
    "download-a-torrent": () => import("@content/guides/download-a-torrent.mdx"),
    "seed-a-torrent": () => import("@content/guides/seed-a-torrent.mdx"),
    "pack-key": () => import("@content/guides/pack-key.mdx"),
  },
  legal: {
    terms: () => import("@content/legal/terms.mdx"),
    privacy: () => import("@content/legal/privacy.mdx"),
    "your-privacy-rights": () => import("@content/legal/your-privacy-rights.mdx"),
    copyright: () => import("@content/legal/copyright.mdx"),
    disclaimers: () => import("@content/legal/disclaimers.mdx"),
  },
};

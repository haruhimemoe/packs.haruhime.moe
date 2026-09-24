/**
 * @file src/lib/revalidate.ts
 * @desc Marks everything that lists public packs stale (/packs, its pages, /packs/index.json,
 *       the homepage's recent-packs strip, /sitemap.xml). The next visit
 *       rebuilds it with one query; nothing is rebuilt eagerly.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import "server-only";
import { revalidatePath } from "next/cache";

/**
 * @function revalidatePublicPacks
 * @returns {void} invalidates every cached /packs page and the search index
 */
export const revalidatePublicPacks = (): void => {
  // Layout revalidation matches the route's file path, route group included: every page under
  // src/app/(public)/packs carries the tag "_N_T_/(public)/packs/layout". Plain "/packs" misses.
  revalidatePath("/(public)/packs", "layout");
  revalidatePath("/packs/index.json");
  // The homepage's recent-packs strip and the sitemap list public packs too.
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
};

/**
 * @function revalidatePack
 * @param slug {string} a saved pack's slug
 * @returns {void} invalidates that pack's cached /p/[slug] page
 */
export const revalidatePack = (slug: string): void => {
  revalidatePath(`/p/${slug}`);
};

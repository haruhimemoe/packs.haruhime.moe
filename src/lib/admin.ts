/**
 * @file src/lib/admin.ts
 * @desc Who is admin: osu! user ids listed in ADMIN_OSU_IDS, read on every request, so a
 *       removed admin loses access at the next one.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { getAdminOsuIds } from "@/env";

/**
 * @function isAdminOsuId
 * @param osuId {number} a signed-in user's osu! id
 * @returns {boolean} true when ADMIN_OSU_IDS lists it
 */
export const isAdminOsuId = (osuId: number): boolean => getAdminOsuIds().has(osuId);

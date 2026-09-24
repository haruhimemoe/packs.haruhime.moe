/**
 * @file src/lib/admin.ts
 * @desc Who is admin: osu! user ids listed in ADMIN_OSU_IDS (validated with the server env).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import "server-only";
import { getServerEnv } from "@/env";

/**
 * @function adminOsuIds
 * @param raw {string | undefined} ADMIN_OSU_IDS as validated ("12231334, 2")
 * @returns {ReadonlySet<number>} the ids; empty when unset
 */
export const adminOsuIds = (raw: string | undefined): ReadonlySet<number> =>
  new Set(
    (raw ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map(Number),
  );

/**
 * @function isAdminOsuId
 * @param osuId {number} a signed-in user's osu! id
 * @returns {boolean} true when ADMIN_OSU_IDS lists it
 */
export const isAdminOsuId = (osuId: number): boolean =>
  adminOsuIds(getServerEnv().ADMIN_OSU_IDS).has(osuId);

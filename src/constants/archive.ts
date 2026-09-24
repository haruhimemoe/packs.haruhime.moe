/**
 * @file src/constants/archive.ts
 * @desc The system account that owns imported tournament pools: a users record nobody can sign in
 *       as.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { SITE } from "@/constants/site";

/**
 * A users record with `system: true` and no linked osu! account, so nobody can sign in as it
 * (src/lib/auth.ts refuses its sessions too). Its email can't be an osu! sign-in's (those are
 * `<osu id>@osu.local`); `.invalid` never resolves.
 */
export const ARCHIVE_ACCOUNT = Object.freeze({
  name: "haruhime archive",
  email: "archive@packs.invalid",
  avatarUrl: `${SITE.url}/brand/packs-icon.svg`,
});

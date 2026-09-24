/**
 * @file src/constants/pools.ts
 * @desc pools.haruhime.moe publishes past tournament pools as packs: the haruhime pools account
 *       that owns them. A users record with `system: true` and no linked osu! account, so nobody
 *       can sign in as it (src/lib/auth.ts refuses its sessions too). Its id is fixed, so two
 *       first syncs at once make one record, and queries can name it without a lookup.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { SITE } from "@/constants/site";

/**
 * The account. The id spells "haruhimepool" in ASCII hex. Its email can't be an osu! sign-in's
 * (those are `<osu id>@osu.local`), and `.invalid` never resolves.
 */
export const POOLS_ACCOUNT = Object.freeze({
  id: "6861727568696d65706f6f6c",
  name: "haruhime pools",
  email: "pools@packs.invalid",
  avatarUrl: `${SITE.url}/brand/packs-icon.svg`,
});

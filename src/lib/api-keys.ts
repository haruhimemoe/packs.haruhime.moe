/**
 * @file src/lib/api-keys.ts
 * @desc packs' API keys (hpk_): @haruhimemoe/next-kit's store on the shared api_keys collection.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import "server-only";
import { createApiKeyStore } from "@haruhimemoe/next-kit/api-keys";
import { API_KEY_PREFIX, API_KEY_SCOPES } from "@/constants/api";
import { connectedDb } from "@/lib/db";

export const apiKeys = createApiKeyStore({
  prefix: API_KEY_PREFIX,
  db: connectedDb,
  scopes: API_KEY_SCOPES,
});

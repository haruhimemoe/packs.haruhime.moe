/**
 * @file src/app/api/v1/me/route.ts
 * @desc GET /api/v1/me: who the API key belongs to.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { withApiKey } from "@/lib/api-auth";

export const GET = withApiKey(async (_request, caller) =>
  Response.json({ user: { id: caller.id, osuId: caller.osuId, username: caller.username } }),
);

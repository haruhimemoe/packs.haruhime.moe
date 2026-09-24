/**
 * @file src/lib/osu/index.ts
 * @desc The one osu! API client for the server, from @haruhimemoe/osu. Credentials come from server
 *       env on first use; every call spends packs' shared osu! budget (see attributes.ts). Every
 *       request sends SERVER_USER_AGENT.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { createOsuClient, type OsuClient } from "@haruhimemoe/osu";
import { SERVER_USER_AGENT } from "@/constants/site";
import { getServerEnv } from "@/env";

export type { OsuClient } from "@haruhimemoe/osu";
export { OsuApiError } from "@haruhimemoe/osu";

let client: OsuClient | undefined;

/**
 * @function getOsuClient
 * @returns {OsuClient} the process-wide client (its token is cached on it)
 */
export const getOsuClient = (): OsuClient => {
  client ??= createOsuClient({
    userAgent: SERVER_USER_AGENT,
    credentials: () => {
      const env = getServerEnv();
      return { clientId: env.OSU_CLIENT_ID, clientSecret: env.OSU_CLIENT_SECRET };
    },
  });
  return client;
};

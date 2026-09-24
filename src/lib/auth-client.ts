/**
 * @file src/lib/auth-client.ts
 * @desc better-auth browser client with typed additional user fields. genericOAuth providers
 *       register as social providers in better-auth 1.7, so sign-in is signIn.social().
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { Auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
  // Nothing subscribes to useSession (src/hooks/useAccount.ts asks once); never poll on focus.
  sessionOptions: { refetchOnWindowFocus: false },
});

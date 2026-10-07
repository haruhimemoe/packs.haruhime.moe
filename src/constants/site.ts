/**
 * @file src/constants/site.ts
 * @desc Site identity, the source repo, our Discord server, the parent brand and GitHub org,
 *       navigation, the ppy trademark notice, the User-Agent our server sends, the haruhime.moe
 *       hub's account page and the shared signed-in marker.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { SHARED_MARKER_COOKIE } from "@haruhimemoe/next-kit/auth-react";

export const SITE = {
  name: "packs",
  title: "packs.haruhime.moe",
  url: "https://packs.haruhime.moe",
  description:
    "Build osu! tournament mappool packs from beatmap IDs or links, download them as one zip or a torrent, and share them with a pack key or a short link.",
  contactEmail: "haruhime@haruhime.moe",
  /** Public source repository, linked from the footer. */
  repoUrl: "https://github.com/haruhimemoe/packs.haruhime.moe",
  /** Our public Discord server, linked from the footer's Discord icon. */
  discordUrl: "https://haruhime.moe/discord",
  /** The parent brand, linked from the footer wordmark. */
  parentUrl: "https://www.haruhime.moe",
  /** The GitHub organization, linked from the footer's GitHub mark. */
  githubOrg: "https://github.com/haruhimemoe",
  trademarkNotice:
    "Not affiliated with or endorsed by ppy Pty Ltd. osu! is a trademark of ppy Pty Ltd.",
} as const;

/** Sent as User-Agent on every request our server makes to the osu! API (see /legal/disclaimers). */
/** GitHub private vulnerability reporting: the first place to report a security problem. */
export const SECURITY_REPORT_URL = `${SITE.repoUrl}/security/advisories/new`;

/** Where sign-in comes back to when it has no safe `next`. */
export const DEFAULT_AFTER_SIGN_IN = "/me";

/** The haruhime.moe account page: the osu! account, sessions and deleting the account. */
export const HUB_ACCOUNT_URL = "https://www.haruhime.moe/account";

/** The hub route that starts osu! sign-in straight away, coming back to `next`. */
export const HUB_SIGN_IN_PATH = "/api/signin/osu";

/** The hub's sign-out route, which /api/signout forwards the session cookie to. */
export const HUB_SIGN_OUT_PATH = "/api/auth/sign-out";

/** The domain the hub's cookies live on. Sign-out clears them there, but only when packs itself
 * runs under it (locally the cookies are host-only, so no Domain). */
export const SHARED_COOKIE_DOMAIN = ".haruhime.moe";

/** The readable "signed in" marker the hub sets on .haruhime.moe (it holds no secret): pages ask
 * for the session only when it's there. packs only reads it. */
export const SIGNED_IN_COOKIE = SHARED_MARKER_COOKIE;

export const SERVER_USER_AGENT = `${SITE.title} (+${SITE.url}; ${SITE.contactEmail})`;

export const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/new", label: "New pack" },
  { href: "/packs", label: "Packs" },
  { href: "/guides", label: "Guides" },
];

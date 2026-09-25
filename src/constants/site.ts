/**
 * @file src/constants/site.ts
 * @desc Site identity, the source repo, our Discord server, the parent brand and GitHub org, navigation, the ppy trademark notice, and the User-Agent our server sends.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Fri Sep 25, 2026
 */

export const SITE = {
  name: "packs",
  title: "packs.haruhime.moe",
  url: "https://packs.haruhime.moe",
  description:
    "Build osu! tournament mappool packs from beatmap IDs or links, download them as one zip or a torrent, and share them with a pack key or a short link.",
  contactEmail: "contact@haruhime.moe",
  /** Public source repository, linked from the footer. */
  repoUrl: "https://github.com/haruhimemoe/packs.haruhime.moe",
  /** Our public Discord server, linked from the footer's Discord icon. */
  discordUrl: "https://discord.gg/bKy9kjMV4y",
  /** The parent brand, linked from the footer wordmark. */
  parentUrl: "https://www.haruhime.moe",
  /** The GitHub organization, linked from the footer's GitHub mark. */
  githubOrg: "https://github.com/haruhimemoe",
  trademarkNotice:
    "Not affiliated with or endorsed by ppy Pty Ltd. osu! is a trademark of ppy Pty Ltd.",
} as const;

/** Sent as User-Agent on every request our server makes to the osu! API (see /legal/disclaimers). */
export const SERVER_USER_AGENT = `${SITE.title} (+${SITE.url}; ${SITE.contactEmail})`;

export const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/new", label: "New pack" },
  { href: "/packs", label: "Packs" },
  { href: "/guide", label: "Guides" },
];

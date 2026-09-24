/**
 * @file src/constants/archive.ts
 * @desc Archived tournament pools: the sources archive packs come from, their names, and the
 *       system account that owns every archive pack. Shared by the server and the /packs cards.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { SITE } from "@/constants/site";

/** Where archive packs come from. otdb first; o!TR and wybin get their own importers later. */
export const ARCHIVE_SOURCE_KINDS = ["otdb", "otr", "wybin"] as const;

export type ArchiveSourceKind = (typeof ARCHIVE_SOURCE_KINDS)[number];

/** Each source's name on cards. */
export const ARCHIVE_SOURCE_LABELS: Readonly<Record<ArchiveSourceKind, string>> = Object.freeze({
  otdb: "otdb",
  otr: "o!TR",
  wybin: "wybin",
});

/**
 * The system account that owns archive packs: a users record with `system: true` and no linked
 * osu! account, so nobody can sign in as it (src/lib/auth.ts refuses its sessions too). Its
 * email can't be an osu! sign-in's (those are `<osu id>@osu.local`); `.invalid` never resolves.
 */
export const ARCHIVE_ACCOUNT = Object.freeze({
  name: "haruhime archive",
  email: "archive@packs.invalid",
  avatarUrl: `${SITE.url}/brand/packs-icon.svg`,
});

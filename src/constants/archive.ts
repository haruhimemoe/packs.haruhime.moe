/**
 * @file src/constants/archive.ts
 * @desc Archived tournament pools (pool archive spec): the sources archive packs come from, how
 *       they're named, otdb's export and pool pages, and the system account that owns every
 *       archive pack. Shared by the importer, the server and the /packs cards.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { SITE } from "@/constants/site";

/** Where archive packs come from. otdb first; o!TR and wybin get their own importers later. */
export const ARCHIVE_SOURCE_KINDS = ["otdb", "otr", "wybin"] as const;

export type ArchiveSourceKind = (typeof ARCHIVE_SOURCE_KINDS)[number];

/** Each source's name on cards and in import reports. */
export const ARCHIVE_SOURCE_LABELS: Readonly<Record<ArchiveSourceKind, string>> = Object.freeze({
  otdb: "otdb",
  otr: "o!TR",
  wybin: "wybin",
});

/** otdb's public export of every pool (Sheppsu OK'd using it on 2026-09-23). */
export const OTDB_EXPORT_URL = "https://otdb.sheppsu.me/static/mappools-export.json";

/**
 * otdb's page for one pool is this plus the pool id. The export has no links, so this shape
 * wasn't checked against the live site: fix it here if otdb uses another one.
 */
export const OTDB_POOL_URL_PREFIX = "https://otdb.sheppsu.me/mappool/";

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

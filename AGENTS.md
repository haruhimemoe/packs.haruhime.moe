# AGENTS.md

Rules for any agent (or human) working in this repo. Authoritative; `CLAUDE.md` only layers on top.

## 1. What this is

packs.haruhime.moe: a browser-first osu! beatmap pack builder. Internal specs live outside the repo; `CLAUDE.local.md` (untracked) says where.

**Hard rule: we never host files.** No `.osz`, audio, image, or video bytes may pass through or be stored by our server code. Downloads go browser → mirror; exports are built in the browser.

## 2. Layout

```
src/app/          routes only (thin; compose components)
src/components/   layout/ and feature folders (beatmap/, pack/, export/); primitives come from @haruhimemoe/ui
src/hooks/        client hooks (useBeatmapMeta, usePackDraft) + shared hook types
src/constants/    static data (site, legal registry, mod buckets)
src/utils/        pure, stateless helpers grouped by domain
src/lib/          integration plumbing (API clients, auth, db, storage)
src/services/     server-side DB operations
src/models/       mongoose models (registered lazily on the shared connection)
src/schemas/      zod schemas shared by client + server
content/          MDX (legal/, guide/, docs/; docs stay plain Markdown: /docs/<slug>.md serves them as is)
scripts/          admin runners for `bun run` (thin: the work lives in src/lib and src/services)
tests/            unit/ (node), components/ (jsdom), integration/ (node + in-memory Mongo)
```

## 3. Code style

- TypeScript 7, `strict`, `noUncheckedIndexedAccess`. No `any`; validate external data with zod.
- Biome is the only linter/formatter (`bun run check`, `bun run check:fix`). No ESLint or Prettier: typescript-eslint doesn't support TS 7.
- No barrel files in `src/`. Import exact local paths (`@/components/pack/PoolTable`). npm packages (`@haruhimemoe/ui`, `@haruhimemoe/pool` and the rest) are imported from their published entry points: the package root, or a subpath the package exports such as `@haruhimemoe/osu/shapes`.
- One component per file, PascalCase filename, Tailwind only, no CSS modules. Components are presentational; data fetching lives in hooks or services.
- `utils/` is pure. Integration code goes in `lib/`. Don't make one-function files in `lib/`.
- Server-only modules `import "server-only"`. Browser-only integrations are imported only from client components.

## 4. File headers

Every `.ts`, `.tsx`, `.mjs`, and `.css` source file starts with:

```ts
/**
 * @file <repo-relative path>
 * @desc <what it is and why>
 * @author David @dvhsh (https://dvh.sh)
 * @created Ddd MMM D, YYYY
 * @modified Ddd MMM D, YYYY
 */
```

Dates match `date "+%a %b %-d, %Y"`. Update `@modified` on edits, never `@created`. Exported functions get a JSDoc block with `@function`, `@param`, `@returns` (and `@throws` when they throw).

## 5. Tests

- Everything under `tests/`, mirroring `src/` paths. Never co-locate tests in `src/`.
- `bun run test` runs all three Vitest projects; `test:unit`, `test:components`, `test:integration` run one.
- The unit project runs with `TZ=America/Los_Angeles` on purpose. Don't remove it.
- Tests never hit the network. Mock HTTP with recorded fixtures in `tests/fixtures/`.
- Coverage floor: 90% on `src/utils/**` (and `src/schemas/**` once it exists).
- Write the failing test first.

## 6. Visual system

osu!-web look from `@haruhimemoe/ui`: `src/app/globals.css` imports its theme (`b1`–`b6` backgrounds, `c1`–`c4` text, `h1`/`h2` accent, all from `--hue`, pinned to 333 there). Dark only. Font: Nunito via `--font-sans`. Never copy osu-web source (AGPL-3.0) or ship the Torus font.

- Buttons, cards, form fields, pagination, the header, footer and page frame come from `@haruhimemoe/ui`. Use them instead of rebuilding one here; a missing piece belongs in the library.
- Page titles go through `PageHeader` (`@haruhimemoe/ui`); don't hand-build page `h1`s. Structured data goes through `JsonLd` (`@haruhimemoe/ui`).

## 7. Legal copy

Legal pages live in `content/legal/*.mdx`, registered in `src/constants/legal.ts`. When the wording changes, bump `lastUpdated` in the same commit. `tests/unit/content/legal-content.test.ts` guards the required clauses; if a test fails after an edit, the edit removed something that protects us. Every archive source (otdb today) is credited in the Sources section of `content/legal/copyright.mdx` and in the Archived pools guide (`content/guide/archived-pools.mdx`); a new source gets both. A new per-IP counter gets listed in `privacy.mdx` ("Your IP address") and the table in `your-privacy-rights.mdx`.

## 8. Commits and PRs

- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
- Work on a branch, open a PR into `main`, merge when CI is green.
- Before pushing: `bun run check && bun run typecheck && bun run test && SKIP_ENV_VALIDATION=true bun run build`.
- When a change affects conventions, update this file in the same PR.

## 9. Pack data

- Pack identity (`Pool` from `@haruhimemoe/pool`, re-exported by `src/schemas/pack.ts`) is name + slots + an optional ordered bucket list (`buckets`, omitted when it is the six built-ins in default order); that is what keys, drafts, and saved packs hold. Metadata (`BeatmapMeta`) is always fetched fresh from the mirror. A slot's `mod` is a bucket code or `null` (no slot). Bucket rules (`checkPoolBuckets`), bucket edits, pool order, slot edits, mod rules and pasted-pool parsing all come from `@haruhimemoe/pool`; don't reimplement them here.
- The key format is specified in `content/guide/pack-key.mdx` and implemented by `@haruhimemoe/pool` (`encodePackKey`, `decodePackKey`): `pk1.` for packs v1 can hold (so old keys never change), `pk2.` for custom slots, a changed order, or no-slot maps, `pk3.` only when a custom slot has mods. Changing the wire format means a new package version with a new key version, never editing an existing one: add its section and a "Version history" line to the guide in the same PR (`tests/unit/constants/guide.test.ts` enforces it), and add its keys to `tests/fixtures/pack-keys/legacy.json` only once that version has shipped. `PALETTE_STYLES` in `src/constants/palette.ts` is indexed like the package's `PALETTE` (the stored color id): append only.
- A custom slot's `mods` (`{ kind: "forced", set }` or `{ kind: "free" }`, absent = no mods) and every mod rule come from `@haruhimemoe/pool`. Its shared tables (`DEFAULT_BUCKETS`, `NO_MODS`, `PALETTE` and the rest) are frozen: copy before changing one.
- The mirror client is `@haruhimemoe/hinai`. Tests never hit the mirror: use `tests/helpers/hinai-server.ts` and the recorded fixtures.
- Downloads go browser → mirror only (`src/lib/downloads/fetch-sets.ts`) and are cached in OPFS (`src/lib/storage/osz-cache.ts`). Zips are built in the browser (`src/lib/zip/`); the archive layout and `pack.txt` come from `src/utils/pack-archive.ts`, which the torrent export will reuse. Never commit a real `.osz`; tests use synthetic zips.

## 10. Accounts and data

- Sign-in is osu! only (better-auth `genericOAuth`, `src/lib/auth.ts`).
- Server env comes from `getServerEnv()` in `src/env.ts`, validated on first use. Don't read `process.env` elsewhere on the server; add every new variable to the schema and `.env.example`.
- Nothing may touch env, the database, or better-auth at import time. `/`, `/new`, `/k`, `/guide`, and `/legal` must build and run with no database env; `/packs` and `/packs/index.json` prerender empty under `SKIP_ENV_VALIDATION=true`. Real builds (preview and production deploys) prerender them against the database, so those environments need the full server env and the database must accept connections from the build machines. Never set `SKIP_ENV_VALIDATION` outside CI: it also empties `/packs` at runtime. A production server (`VERCEL_ENV=production` when `VERCEL_ENV` is set, so Vercel Preview still starts; otherwise `NODE_ENV=production`; never during `next build`) with the flag set refuses to start while `BETTER_AUTH_SECRET`, `OSU_CLIENT_SECRET` or `MONGODB_URI` would be a placeholder (`src/instrumentation.ts`, `assertNoPlaceholderSecrets` in `src/env.ts`).
- `src/lib/db.ts` owns the one `MongoClient`. better-auth uses `getDb()`; models register on `getModelConnection()` through a `getXModel()` function; services call `connectDb()` first.
- Services (`src/services/`) do every query and every owner check. "Not yours" and "doesn't exist" both come back as null/false, and routes answer 404 for both.
- Route handlers read the caller with `getUserFromHeaders(request.headers)` and parse bodies with `parseJsonBody` (`src/lib/api.ts`). Server pages use `getCurrentUser()` / `requireUser()` (`src/lib/auth-session.ts`).
- Saved packs store identity (name, slots, buckets) plus an optional description, a moderation flag (`hiddenAt`, `hiddenBy`) and server-computed `stats`. Keys and drafts never carry the description or the stats.
- Admins are the osu! ids in `ADMIN_OSU_IDS` (`SessionUser.isAdmin`). Moderation lives in `src/services/moderation.ts` and only ever reads or writes public and unlisted packs; admin routes answer 404 to everyone else. Removing one magnet link as an admin goes through `src/services/pack-exports.ts` (the owner's remove, scoped by `MODERATED` instead of the owner).
- Pinned packs (`pinnedAt`, `pinOrder` on the pack) are the "Pinned" row above the `/packs` list, on every list page, in pin order, and gone once anything is searched, filtered or sorted (it lives in `PublicPackBrowser`'s children). Admins pin, unpin and reorder from `/admin` and pin or unpin from the pack page (`/api/admin/pins`, `src/services/pins.ts`); the rules are in `src/utils/pins.ts`: public packs that aren't hidden only, at most `MAX_PINNED_PACKS` (6), a new pin goes last. A pin that finds the limit passed once written backs out, so racing pins can both be refused but never both stay. Hiding a pack or saving it as anything but public unsets its pin in the same write (`UNPIN` from `src/models/Pack.ts`); a pin is stored or absent, never null: the partial pin index (`pinOrder, pinnedAt, _id`, the keys of `PIN_SORT`) needs `$exists`, and `PINNED` names both fields so every pin query uses it. Pin writes go through the driver so `updatedAt` never moves, and call `revalidatePublicPacks()`.
- `/packs`, `/packs/page/[n]` and `/packs/index.json` are ISR (`revalidate = 86400`, a daily safety net). Any service change that touches a public pack calls `revalidatePublicPacks()` (`src/lib/revalidate.ts`). Search runs in the browser over the index; keep per-visitor database work off public pages.
- `/packs` lists community packs newest created first, then archive packs newest created first (`listedRows` in `src/services/public-packs.ts`; the index cap drops archive packs first, and the browser's Newest sort keeps the same split). The homepage strip is community packs only (`listRecentPacks`). Its filters and sorts run in the browser: `src/utils/pack-filters.ts` (pure: overlap for star rating, length and BPM, every ticked mod and mode, map count inside its range, open ends at the slider edges) and `PublicPackBrowser`. Plain `/packs` stays the cached list and fetches nothing; any search, filter or sort loads `/packs/index.json` once, and the tab keeps it for `INDEX_REUSE_MS`, so coming back doesn't fetch it again. Back or Forward to filtered results shows as many as before at the same scroll position (`usePackListView`, saved per URL in sessionStorage by `src/lib/storage/pack-list-view.ts`); any other visit starts at the top. Filter state lives in the query string (`sr`, `mods`, `len`, `bpm`, `mode`, `maps`, `source`, `sort`, `q`), written with a throttled `history.replaceState(null, ...)` and read back on load, on `popstate`, and when the router's query changes under the mounted page (a link to `/packs` with other params: `SearchParamsWatcher`, inside `<Suspense>` so `/packs` still prerenders); a URL the page wrote itself is never read back as a change; params that can't be read are ignored, never an error. A pack without the stats a filter needs is hidden and counted, and so is one with incomplete stats (`k: false`) that a star rating, length, BPM or mode row rules out, since the maps not looked up yet might match; the map count comes from `c`, so it needs no stats.
- Archive packs (pool archive spec) are past tournament pools imported as public packs: `archive` on the pack (tournament, round, year, badged, fingerprint, sources) is written only by the importer, sent read-only in pack objects, and never accepted from a body. One pack per fingerprint (sha256 of the sorted `beatmapId:mods` entries; a partial unique index). They're owned by the system account (`ensureArchiveAccount`, `src/services/archive.ts`): a users record with `system: true`, no osu! id and no linked account. `src/lib/auth.ts` refuses any session or osu! account link for a system user and reads a session that reaches one as signed out; `authenticateApiKey` refuses its keys; it has no pack cap. Admins moderate its packs like any other (its admin row has `ownerOsuId: null`).
- `bun run archive:import otdb [--dry-run] [--file <path>]` (`scripts/archive-import.ts` → `src/lib/archive-import.ts`) runs with the `react-server` condition so server-only modules load outside Next, and connects with `MONGODB_URI` from the environment (Bun also loads `.env.local`: check which database it points at). The pure core is `src/utils/otdb.ts` (export → source pools; submitters are never read), `src/utils/archive-pools.ts` (labels through `parsePoolText`, custom labels force the mods they spell, fingerprints, stats seeded from the export), `src/utils/archive-names.ts` (tournament, round, year) and `src/utils/archive-import.ts` (the plan and the report). Seeded stats are always stored incomplete, so the stats job replaces the source's ratings with osu!'s at least once; `computeStats` takes seeded metadata without a plain rating (`starRating: null`). A hidden archive pack is never imported again, not even once its pool changed at the source; a deleted one is. When a pool changes at its source, the new version gets its own pack, and the old pack is unlisted once every source of it changed (off `/packs` and map usage, so the pool counts once; its link still works). After a real import that wrote something, the runner asks the site to refresh through `POST /api/cron/revalidate-packs` with `CRON_SECRET` (same check as the stats cron, `src/lib/cron-auth.ts`). Tests never reach otdb: the runner takes injected fetch and file reads, and `tests/fixtures/otdb/sample.json` holds 22 real pools without submitter data.
- Map usage (pool archive spec, part 2) is the `map_usage` collection: one document per beatmap id (`{ _id, entries, updatedAt }`), one entry per archive pack slot the map fills (slug, tournament, round, year, badged, slot label, mods code as fingerprints write it, and the pack's fingerprint), most recent year first. Only public archive packs that aren't hidden count; `count` in answers is pools, not entries. `src/utils/map-usage.ts` is pure (building, order, the fewest writes); `src/services/map-usage.ts` rebuilds (`rebuildMapUsage(ids?)`, writing only documents that change, then reading the packs again and going round once more when they changed meanwhile, so two racing rebuilds never leave a hidden pack listed) and reads. Hiding, unhiding or deleting an archive pack, and editing or deleting it as its owner, call `refreshMapUsage` for its maps (a failure is logged, never thrown); every real `archive:import` run rebuilds all of them. `GET /api/v1/beatmaps/{id}/usage` and `GET /api/v1/beatmaps/usage?ids=` (up to `MAX_USAGE_IDS`) need no key: `withPublicApi` (`src/lib/api-auth.ts`) counts them per IP (`RATE_LIMITS.mapUsage`), and only a success keeps its `Cache-Control` (`MAP_USAGE_CACHE`: fresh and stale windows add up to an hour, which the API docs promise), so they carry no RateLimit headers. Pack pages (`/p/[slug]`, `/k`) and the editor ask once per pool through `useMapUsage` (ids sorted, so every viewer shares one cached URL; the first ask goes out at once, and in the editor later ones wait `MAP_USAGE_EDITOR_DELAY_MS` for the pool to hold still and ask only for new maps), leave out the pack's own entries and those of the pool shown (its fingerprint, `fingerprintText` hashed with `crypto.subtle`, so a key or a copy of an archive pool doesn't count itself), and show "Used in N pools" in each map row's stats line once the map's details show (`MapUsage`), so it never adds a line after the fact.
- `/packs` has a Source filter (Community, Archive; both on by default, `?source=community`, `?source=archive` or `?source=none`): index entries for archive packs carry `x: 1` plus `xk`/`xu` (the first source's kind and link), and archive cards show an "Archived pool" badge linking it.
- `/`, `/sitemap.xml`, `/packs` and `/packs/index.json` are ISR, and `revalidatePublicPacks()` covers all of them. Keep `/robots.txt`, `/opengraph-image`, `/brand` and `/guide` static. The homepage's recent-packs strip must never throw (`loadRecentPacks`).
- Account deletion lives in `src/services/account.ts`. A new collection holding user data gets deleted there and listed in `content/legal/privacy.mdx` in the same PR.
- Integration tests use `setupTestDb()` (`tests/helpers/db.ts`) and `createTestUser()` (`tests/helpers/auth.ts`), and call route handlers directly with real session cookies. Work scheduled with `after()` waits in a queue until the test calls `flushAfter()` (`tests/helpers/after.ts`); `tests/helpers/stats-lookups.ts` mocks the mirror and osu! for it.
- Pack stats (`stats` on the pack document: star, length and BPM ranges, mods, rulesets, count, `complete`) are only ever computed on the server, never accepted from a body. `computeStats` (`src/utils/saved-pack-stats.ts`) is pure; `src/lib/pack-stats.ts` looks up metadata (hinai JSON, 100 ids a call, then osu! for misses) and ratings with mods (`getStarRatings`); `src/services/pack-stats.ts` stores them. `createPack` and `updatePack` schedule them with `after()` on the saver's osu! share, so a save never waits for or fails on them; a slot or bucket change clears the old ones first. Stats writes use `timestamps: false` and only land while `updatedAt` is unchanged. A map osu! says doesn't exist comes back from the lookup as null: it's left out of the numbers and doesn't make the stats incomplete. The daily cron (`/api/cron/pack-stats`, `vercel.json`) and the /admin button run the same capped batch (`PACK_STATS_JOB_LIMIT`): packs with no stats first, then incomplete ones due for a retry (`statsRetryAt`: at once, then about 1, 2, 4, 8, 16 and at most 30 days, counted in `stats.attempts` and `stats.retryAt`, which never leave the server), listed public and unlisted packs before private and hidden ones in each group; archive packs due for a retry come last and only in a run that took no other pack, so an import's backlog (seeded stats are always incomplete) never delays a community pack or shares its osu! allowance. At one allowance (`MAX_OSU_FETCHES_PER_REQUEST`, 20 ratings) a run, the ~2,900 rating pairs of the first otdb import take months of daily runs; the /admin button and visitors' own lookups (the shared `star_ratings` cache) shorten that. The cron needs `CRON_SECRET` and refuses everything without it. `CRON_SECRET` stays out of `getServerEnv()`: `getCronSecret()` reads it alone, so a missing or bad value only stops the cron, never sign-in.
- Star ratings with mods come from the osu! API through `/api/osu/star-ratings` and `src/lib/osu/attributes.ts` only: Mongo cache first (`star_ratings`, 30-day TTL), then osu! under the global budget in `rate_limits` (50 calls a minute across all instances, 20 per request) and each IP's share of it (`OSU_API_BUDGET_PER_IP`, 20 a minute, shared with `/api/osu/beatmaps`). Any new server call to osu! goes through the same budget and passes the caller's subject. Per-IP counters key on `rateLimitSubject(clientIp(headers))` (`src/utils/client-ip.ts`): IPv4 whole, IPv6 by its /64. No-mod ratings come with the metadata.

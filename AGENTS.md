# AGENTS.md

Rules for any agent (or human) working in this repo. Authoritative; `CLAUDE.md` only layers on top.

## 1. What this is

packs.haruhime.moe: a browser-first osu! beatmap pack builder. Internal specs live outside the repo; `CLAUDE.local.md` (untracked) says where.

**Hard rule: we never host files.** No `.osz`, audio, image, or video bytes may pass through or be stored by our server code. Downloads go browser → mirror; exports are built in the browser.

## 2. Layout

```
src/app/          routes only (thin; compose components)
src/components/   ui/ (primitives), layout/, and feature folders (beatmap/, pack/, export/)
src/hooks/        client hooks (useBeatmapMeta, usePackDraft) + shared hook types
src/constants/    static data (site, legal registry, mod buckets)
src/utils/        pure, stateless helpers grouped by domain
src/lib/          integration plumbing (API clients, auth, db, storage)
src/services/     server-side DB operations
src/models/       mongoose models (registered lazily on the shared connection)
src/schemas/      zod schemas shared by client + server
content/          MDX (legal/, guide/, docs/; docs stay plain Markdown: /docs/<slug>.md serves them as is)
tests/            unit/ (node), components/ (jsdom), integration/ (node + in-memory Mongo)
```

## 3. Code style

- TypeScript 7, `strict`, `noUncheckedIndexedAccess`. No `any`; validate external data with zod.
- Biome is the only linter/formatter (`bun run check`, `bun run check:fix`). No ESLint or Prettier: typescript-eslint doesn't support TS 7.
- No barrel files. Import exact paths (`@/components/ui/Button`).
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

osu!-web look, rebuilt from tokens in `src/app/globals.css`: `b1`–`b6` backgrounds, `c1`–`c4` text, `h1`/`h2` accent, all from `--hue`. Dark only. Font: Nunito via `--font-sans`. Never copy osu-web source (AGPL-3.0) or ship the Torus font.

- Page titles go through `PageHeader` (`src/components/ui/PageHeader.tsx`); don't hand-build page `h1`s. Structured data goes through `JsonLd`.

## 7. Legal copy

Legal pages live in `content/legal/*.mdx`, registered in `src/constants/legal.ts`. When the wording changes, bump `lastUpdated` in the same commit. `tests/unit/content/legal-content.test.ts` guards the required clauses; if a test fails after an edit, the edit removed something that protects us.

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
- Saved packs store identity (name, slots, buckets) plus an optional description and a moderation flag (`hiddenAt`, `hiddenBy`). Keys and drafts never carry the description.
- Admins are the osu! ids in `ADMIN_OSU_IDS` (`SessionUser.isAdmin`). Moderation lives in `src/services/moderation.ts` and only ever reads or writes public and unlisted packs; admin routes answer 404 to everyone else. Removing one magnet link as an admin goes through `src/services/pack-exports.ts` (the owner's remove, scoped by `MODERATED` instead of the owner).
- `/packs`, `/packs/page/[n]` and `/packs/index.json` are ISR (`revalidate = 300`). Any service change that touches a public pack calls `revalidatePublicPacks()` (`src/lib/revalidate.ts`). Search runs in the browser over the index; keep per-visitor database work off public pages.
- `/`, `/sitemap.xml`, `/packs` and `/packs/index.json` are ISR, and `revalidatePublicPacks()` covers all of them. Keep `/robots.txt`, `/opengraph-image`, `/brand` and `/guide` static. The homepage's recent-packs strip must never throw (`loadRecentPacks`).
- Account deletion lives in `src/services/account.ts`. A new collection holding user data gets deleted there and listed in `content/legal/privacy.mdx` in the same PR.
- Integration tests use `setupTestDb()` (`tests/helpers/db.ts`) and `createTestUser()` (`tests/helpers/auth.ts`), and call route handlers directly with real session cookies.
- Star ratings with mods come from the osu! API through `/api/osu/star-ratings` and `src/lib/osu/attributes.ts` only: Mongo cache first (`star_ratings`, 30-day TTL), then osu! under the global budget in `rate_limits` (50 calls a minute across all instances, 20 per request) and each IP's share of it (`OSU_API_BUDGET_PER_IP`, 20 a minute, shared with `/api/osu/beatmaps`). Any new server call to osu! goes through the same budget and passes the caller's subject. Per-IP counters key on `rateLimitSubject(clientIp(headers))` (`src/utils/client-ip.ts`): IPv4 whole, IPv6 by its /64. No-mod ratings come with the metadata.

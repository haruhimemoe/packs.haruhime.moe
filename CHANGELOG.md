# Changelog

All notable changes to packs.haruhime.moe are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). API changes are also listed under "Changes" in the [API docs](https://packs.haruhime.moe/docs/api).

## [Unreleased]

### Added

- Installs to a phone's home screen: a web app manifest, the page color as the browser's theme color, home-screen icons, and an offline page when a page can't load (a service worker that caches only the site's build files). The color picker's swatches are 44px touch targets.

### Fixed

- White text on primary buttons and the skip link meets 4.5:1 contrast on the orange theme (`--h2-l: 41%`; it was 3.99:1 at hue 30).

### Removed

- `/api/auth/*`, packs' own `user`, `account`, `session` and `verification` collections and their indexes (the identity migration moves their rows to the hub), and the per-IP sign-in counter.

### Added

- `POST /api/internal/account/export` and `/delete` for the haruhime.moe hub's account export and delete (next-kit's `createAccountHandlers`), behind `ACCOUNT_FANOUT_SECRET` (the hub's `ACCOUNT_SECRET_PACKS`). Unset, both answer 503.
- Pack history: every save of a saved pack is kept, with a page listing each version and what changed, map links included. Off by default; a pack's owner can make its history visible to anyone who can see the pack. Deleting a pack or your account deletes its history too.

### Fixed

- `@haruhimemoe/next-kit` 0.11.0: a legal page's `.md` mirror and llms-full.txt kept the text around a legal block (`<Processors />`, `<YourRights />`, ...) but dropped the block itself, since the Markdown converter treats unknown capitalized JSX as noise. `legalMarkdownTransform` turns each block into the same words its React counterpart renders, scoped to the legal section.

### Changed

- API keys carry scopes: `read` for GET, `write` for POST, PUT and DELETE on `/api/v1`. A key without the scope gets 403 `insufficient_scope`. Every existing and new key has `["*"]`, so nothing changes for callers yet. @haruhimemoe/next-kit 0.15.0.
- The hinai client now comes from `@haruhimemoe/mirror` 0.1.0 (`/hinai` and `/testing`) instead of `@haruhimemoe/hinai`, which is deprecated and `@haruhimemoe/osu` moves from 0.3.0 to 0.4.0, the version mirror needs. No change in behavior.
- Sign-in moves to the shared haruhime.moe account. packs no longer runs better-auth or its own osu! sign-in: it reads the hub's session (on `.haruhime.moe`) from the `identity` database with `@haruhimemoe/next-kit` 0.12.1's `createSessionReader`, read-only. `/signin` sends you straight to osu! through haruhime.moe and back. Sign out stays on packs (`POST /api/signout` ends the hub session and clears the shared cookies). Sessions and deleting the account are on haruhime.moe/account, linked from `/me`. Banned haruhime accounts read as signed out, and their API keys stop working.
- `/me` is your packs settings: "Delete account" is now "Delete my packs data" (API key, saved packs and their history), at most 3 times an hour. It no longer deletes the account itself. "Download my data" no longer lists sessions or the osu! link (they're haruhime.moe's).
- The signed-in marker is the shared `haruhime-signed-in` cookie, set by the hub. `packs-signed-in` is gone.
- The haruhime pools account is a system account under its fixed id, with no user row; `system` no longer lives on a user record (packs-side `SYSTEM_USER_IDS`). Pack owners' names and avatars are read from identity.
- Env: `BETTER_AUTH_SECRET` is now the hub's (shared), `BETTER_AUTH_URL` is gone, and `HUB_URL` (default `https://www.haruhime.moe`) is new. `OSU_CLIENT_ID` and `OSU_CLIENT_SECRET` stay, for osu! lookups. The database user needs read on `identity`.
- Guides moved from `/guide` to `/guides`. The old `/guide` pages are gone (404); the two retired guides that redirected to the guide index now redirect to `/guides`.
- Docs, guides and legal pages share one layout from `@haruhimemoe/ui` 0.11.0: a side nav for the section, the last-updated date and a "Copy as Markdown" button on every page. `/docs`, `/guides` and `/legal` each have an index page (the docs one is searchable).
- Every docs, guides and legal page has a plain Markdown copy at its address plus `.md` (like `/guides/make-a-pack.md` or `/legal/terms.md`), not only the API docs.
- llms.txt now has Docs, Guides, API and Legal sections, each page linked by its Markdown copy; the pages, pools, bb and our Discord server are in its opening notes. llms-full.txt adds the legal pages. The sitemap lists `/docs` and `/legal`.
- `/brand` is the shared haruhime brand page (`@haruhimemoe/brand` 0.7.0): logo, wordmark and banner files, the full palette, do's and don'ts and the contact address.
- `@haruhimemoe/ui` 0.11.1: decorative alt on brand page previews.
- `@haruhimemoe/ui` 0.11.2: Copy as Markdown works on Safari and iOS.
- Depends on `@haruhimemoe/ui` 0.12.0: buttons and form fields are 44px tall on touch screens, motion stops when your system asks for reduced motion, colors get stronger when it asks for more contrast, "See all public packs" is underlined, and pack names in lists underline on hover instead of turning pink.
- Depends on `@haruhimemoe/ui` 0.13.0: guide and legal index cards have rounder corners, the public packs grid is a little tighter, and on the torrent panel the Copy magnet link button now comes before Add magnet link to this pack.
- `@haruhimemoe/next-kit` 0.7.0 and `@haruhimemoe/vcs` 0.1.0 for pack history.
- Depends on `@haruhimemoe/ui` 0.14.0 and `@haruhimemoe/next-kit` 0.8.0: deleting your account opens a dialog that asks you to type your osu! username, deleting a saved pack (and, for admins, any pack) asks in a dialog, and the confirm buttons for clearing local data, removing a magnet link and regenerating or revoking an API key are red.
- Depends on `@haruhimemoe/ui` 0.15.0: slots in the pack editor move by dragging their handle with a mouse, a finger or the keyboard, each step read out, and their arrow buttons now say Up and Down; pinned packs on /admin drag the same way, with Up and Down turned off at the ends instead of hidden.
- Depends on `@haruhimemoe/ui` 0.16.0: a map that is still loading shows a placeholder card with its ID and Copy ID instead of a line of text, map rows keep one layout whatever the screen width of their column, and on narrow screens the "Copied." message sits under the Copy ID button.
- Depends on `@haruhimemoe/ui` 0.17.0: guides get an "On this page" list, dates on guides, docs and legal pages read like Oct 5, 2026, and legal text is a size smaller.

## [0.1.0] - 2026-10-04

### Changed

- API keys and the `/api/v1` guard come from `@haruhimemoe/next-kit` 0.5.0, shared with pools and bb. Every `/api/me/api-key` answer is `Cache-Control: no-store`, and a server error there is a JSON 500.

- Guides, docs and legal pages render through `@haruhimemoe/ui` 0.9.0's shared MDX components: headings get a visible `#` anchor link, `> [!NOTE]`/`[!TIP]`/`[!WARNING]` blockquotes render as labelled callouts, and the API docs' code blocks are syntax-highlighted.

- Depends on `@haruhimemoe/ui` 0.7.0, its accessibility release: one footer nav with headed columns, field errors read as polite status messages instead of alerts, a visible focus ring on fields, 24px slider thumbs and chips, and lighter accent links.

- A public pack's link preview is its own card: the pack's name with its map count, star range and mods, drawn by `@haruhimemoe/brand` 0.6.0. Unlisted and private packs keep the site's image.
- A long page title ends in "· packs" instead of "· packs.haruhime.moe", so search results show it whole (`@haruhimemoe/next-kit` 0.4.0).
- The footer links haruhime's other tools, pools and bb, and all of them on haruhime.moe (`@haruhimemoe/ui` 0.6.0). The home page's "More haruhime tools" card stays, with a line on what each does.
- A missing pack's 404 is titled "Pack not found · packs.haruhime.moe", and other 404s "Page not found".

- A saved pack's page lists its maps (artist, title, difficulty, mapper, stars) in the page itself, so search engines, link previews and AI assistants see the maps instead of "Loading beatmap…". Your browser still refreshes them when the page opens.
- Page titles, descriptions, canonical links, link previews, robots.txt, the sitemap, structured data and llms.txt now come from `@haruhimemoe/next-kit/seo` 0.3.0, shared by every haruhime.moe site. Every page has its own title and description and keeps the link preview image. A pack's page is titled "… map pack download" and its description leaves out the source link and ends with the map count, star range and mods.
- The sitemap dates guides, docs and legal pages by when they last changed. robots.txt names each AI crawler, all still allowed.
- Structured data: the home page describes packs as part of haruhime.moe, with a search box for public packs; guides and the API docs are articles with their update date; public pack pages and the public pack list describe their packs. ui moves to 0.5.1, which escapes `>`, `&` and line separators in structured data too.
- New: [/llms-full.txt](https://packs.haruhime.moe/llms-full.txt), every guide and the API docs in one Markdown file. llms.txt links it, pools and bb.
- The home page links pools and bb, haruhime's other osu! tools.
- The Sign in with osu! and Sign out buttons come from `@haruhimemoe/next-kit/auth-react` 0.2.0 (`createAuthComponents`), shared with pools, and ui moves to 0.5.0. A sign-in error now shows as a bold rose line under the button instead of a notice box.
- The site's server plumbing now comes from [@haruhimemoe/next-kit](https://github.com/haruhimemoe/next-kit), which pools.haruhime.moe shares. Where the two copies differed, packs takes pools' behavior:
  - A 503 without a code of its own answers `unavailable`, not `internal_error`. (packs' own 503s, from the cron and the pools service routes, keep `not_configured`.)
  - A request body that's too large or doesn't pass validation says "That request is too large." or "That request isn't valid." Pack saves still say "That pack is too large."
  - `?ids=` on `/api/osu/beatmaps` is strict: an empty part (`1,,2`), spaces, hex (`0x10`) or exponents (`1e3`) get a 400.
  - Signing in from `/signin?next=/signin` goes to your packs instead of back to the sign-in page.
  - A removed admin loses access at their next request, not when the server restarts.
  - An osu! sign-in that fails comes back to the sign-in page with where you were going kept, so trying again lands there. If an account was half-deleted, signing in with the same osu! account relinks it.
  - The first start after this change adds indexes to the sign-in collections (one user per osu! id, one link per osu! account, sessions by token). Existing duplicates are logged and that index is skipped until they're merged.
- Visitors together can use at most 30 of the 50 osu! API calls a minute; the other 20 stay for the daily stats job and the pools service, so a few busy visitors can't stall pack stats. A star rating osu! won't give (a map it doesn't have, or mods it won't rate) is remembered for an hour instead of being asked for again on every page view.
- Starting a sign-in is limited to 10 a minute per IP address, counted across all server instances. Sign-in state rows from abandoned sign-ins now expire on their own.
- The stat tiles on a pack's page count a forced DT or HT slot's length and BPM at that speed, as the saved stats behind the `/packs` filters already did.
- HD on its own doesn't change a star rating, so a slot's HD rating is its rating without mods and the page no longer asks osu! for it.

### Fixed

- Several saves sent at once can no longer take an account past 200 saved packs: the extra ones get the 409.
- When pools.haruhime.moe publishes a pool and takes its pack down at the same moment, the publish makes the pack again instead of failing with a 500.

### Security

- `/.well-known/security.txt` lists GitHub private vulnerability reporting as the first contact.
- The Content-Security-Policy also blocks plugins (`object-src 'none'`), a `<base>` pointing elsewhere (`base-uri 'self'`) and forms posting off-site (`form-action 'self'`).
- CI runs every GitHub Action from a pinned commit SHA.

[unreleased]: https://github.com/haruhimemoe/packs.haruhime.moe/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/haruhimemoe/packs.haruhime.moe/releases/tag/v0.1.0

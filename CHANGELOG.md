# Changelog

Changes people using packs.haruhime.moe or its API can notice. packs deploys every change on `main`, so there are no version numbers: entries are grouped by the date they went live. API changes are also listed under "Changes" in the [API docs](https://packs.haruhime.moe/docs/api).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Changed

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

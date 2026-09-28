# Changelog

Changes people using packs.haruhime.moe or its API can notice. packs deploys every change on `main`, so there are no version numbers: entries are grouped by the date they went live. API changes are also listed under "Changes" in the [API docs](https://packs.haruhime.moe/docs/api).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Changed

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

### Fixed

- Several saves sent at once can no longer take an account past 200 saved packs: the extra ones get the 409.
- When pools.haruhime.moe publishes a pool and takes its pack down at the same moment, the publish makes the pack again instead of failing with a 500.

### Security

- `/.well-known/security.txt` lists GitHub private vulnerability reporting as the first contact.
- The Content-Security-Policy also blocks plugins (`object-src 'none'`), a `<base>` pointing elsewhere (`base-uri 'self'`) and forms posting off-site (`form-action 'self'`).
- CI runs every GitHub Action from a pinned commit SHA.

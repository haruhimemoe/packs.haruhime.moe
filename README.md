<p align="center"><a href="https://packs.haruhime.moe"><picture><source media="(prefers-color-scheme: light)" srcset="https://www.haruhime.moe/brand/repos/packs.haruhime.moe-banner-on-light.svg"><img alt="packs.haruhime.moe" src="https://www.haruhime.moe/brand/repos/packs.haruhime.moe-banner.svg" width="640"></picture></a></p>

# packs.haruhime.moe

Build osu! beatmap packs for tournaments at **https://packs.haruhime.moe**. Paste beatmap IDs, osu! links or spreadsheet rows, sort the maps into a mappool (NM1 to TB, plus your own custom slots), and download the whole pool as one zip or a torrent. Every pack gets a pack key, a short piece of text that rebuilds the same pool when someone pastes it.

The site never hosts beatmap files. Each `.osz` goes from the beatmap mirror straight to your browser, and the zip and torrent are built in your browser too.

## Features

- **Pool builder:** paste IDs, links or rows like `NM1 129891`, move maps between slots, and add custom slots (like `EZ` or `RC`) with a color and forced or free mods. Every map row has a Copy ID button for `!mp map`.
- **Pack keys:** share a `pk1.` / `pk2.` / `pk3.` key and anyone can open the same pool, no account needed.
- **Downloads:** one zip for the whole pool, with or without videos and backgrounds, and a download cache in your browser so a second pack reuses maps you already have.
- **Torrents:** a `.torrent` file and a magnet link, built in your browser, with guides to seeding and downloading one.
- **Star ratings with mods:** each slot shows the ratings for the mods it's played with.
- **osu! collections:** add a pack's maps to an osu!stable collection (load your `collection.db`, download it back with the maps added) or import them into osu!lazer through its setup wizard. Your collection.db stays in your browser.
- **Accounts (optional):** sign in with osu! to save packs, get a short `/p/<slug>` link, and list a pack publicly.
- **Public packs:** search, filter by star rating, length, BPM, mods, mode and map count, and sort the packs other hosts chose to share. A few pinned packs sit on top. Tournament pools from [pools.haruhime.moe](https://pools.haruhime.moe) (in beta), haruhime's mappool builder, are listed too, owned by haruhime pools.
- **API:** read public packs and manage your own from scripts and bots. See [/docs/api](https://packs.haruhime.moe/docs/api).

## Docs

- [Guides](https://packs.haruhime.moe/guides): making a pack, osu! collections, torrents and pack keys.
- [API docs](https://packs.haruhime.moe/docs/api) and the [OpenAPI document](https://packs.haruhime.moe/api/v1/openapi.json).
- [llms.txt](https://packs.haruhime.moe/llms.txt): a map of the site for AI assistants, and [llms-full.txt](https://packs.haruhime.moe/llms-full.txt): every doc, guide and legal page in one Markdown file. Every docs, guides and legal page also has a Markdown copy at its address plus `.md`. This repo also has its own [llms.txt](llms.txt).

## Stack

Next.js 16 (App Router), React 19, TypeScript 7, Tailwind CSS v4 and MDX, on Bun. Accounts use better-auth with osu! OAuth and MongoDB. Tests run on Vitest, lint and format on Biome.

## Packages

packs uses these shared haruhime.moe packages:

- [`@haruhimemoe/pool`](https://www.npmjs.com/package/@haruhimemoe/pool): the mappool shape, slot and mod rules, pasted-pool parsing, and the pack key codec.
- [`@haruhimemoe/hinai`](https://www.npmjs.com/package/@haruhimemoe/hinai): the client for the hinai beatmap mirror (metadata and `.osz` downloads).
- [`@haruhimemoe/osu`](https://www.npmjs.com/package/@haruhimemoe/osu): osu! API v2 shapes, the osu! sign-in settings, the server client we use for maps the mirror doesn't have, star ratings with mods and pack stats, and the collection.db reader and writer behind "Add to osu! collection".
- [`@haruhimemoe/ui`](https://www.npmjs.com/package/@haruhimemoe/ui): the theme and colors the site uses, buttons, cards, form fields, pagination, and the site header, footer and page frame.
- [`@haruhimemoe/next-kit`](https://www.npmjs.com/package/@haruhimemoe/next-kit): the server plumbing packs shares with pools.haruhime.moe: JSON errors and body parsing, rate limits and the osu! API budget in MongoDB, sign-in with osu!, env checks, the database client, the test helpers, version history (the `vcs` module), and the page titles, robots.txt, sitemap, structured data and llms.txt format shared by every haruhime.moe site.
- [`@haruhimemoe/brand`](https://www.npmjs.com/package/@haruhimemoe/brand): the wordmark, icons and link preview image, each public pack's own preview card (drawn per request), and the palette file behind the colors on [/brand](https://packs.haruhime.moe/brand).
- [`@haruhimemoe/vcs`](https://www.npmjs.com/package/@haruhimemoe/vcs): the diff, merge and codec primitives behind pack version history.

## Changes

What changed for people using the site or the API is in [CHANGELOG.md](CHANGELOG.md). Every change on `main` goes live. To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE). Not affiliated with or endorsed by ppy Pty Ltd. osu! is a trademark of ppy Pty Ltd.

## Help

Ask questions in our [Discord server](https://discord.gg/bKy9kjMV4y), and report bugs in [GitHub issues](https://github.com/haruhimemoe/packs.haruhime.moe/issues). Report security issues privately, as [SECURITY.md](SECURITY.md) describes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

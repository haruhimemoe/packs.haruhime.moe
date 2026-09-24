# packs.haruhime.moe

Build osu! beatmap packs for tournaments at **https://packs.haruhime.moe**. Paste beatmap IDs, osu! links or spreadsheet rows, sort the maps into a mappool (NM1 to TB, plus your own custom slots), and download the whole pool as one zip or a torrent. Every pack gets a pack key, a short piece of text that rebuilds the same pool when someone pastes it.

The site never hosts beatmap files. Each `.osz` goes from the beatmap mirror straight to your browser, and the zip and torrent are built in your browser too.

## Features

- **Pool builder:** paste IDs, links or rows like `NM1 129891`, move maps between slots, and add custom slots (like `EZ` or `RC`) with a color and forced or free mods.
- **Pack keys:** share a `pk1.` / `pk2.` / `pk3.` key and anyone can open the same pool, no account needed.
- **Downloads:** one zip for the whole pool, with a download cache in your browser so a second pack reuses maps you already have.
- **Torrents:** a `.torrent` file and a magnet link, built in your browser, with a guide to seeding it.
- **Star ratings with mods:** each slot shows the ratings for the mods it's played with.
- **Accounts (optional):** sign in with osu! to save packs, get a short `/p/<slug>` link, and list a pack publicly.
- **Public packs:** browse and search packs other hosts chose to share.
- **API:** read public packs and manage your own from scripts and bots. See [/docs/api](https://packs.haruhime.moe/docs/api).

## Stack

Next.js 16 (App Router), React 19, TypeScript 7, Tailwind CSS v4 and MDX, on Bun. Accounts use better-auth with osu! OAuth and MongoDB. Tests run on Vitest, lint and format on Biome.

## Packages

packs uses these shared haruhime.moe packages:

- [`@haruhimemoe/pool`](https://www.npmjs.com/package/@haruhimemoe/pool): the mappool shape, slot and mod rules, pasted-pool parsing, and the pack key codec.
- [`@haruhimemoe/hinai`](https://www.npmjs.com/package/@haruhimemoe/hinai): the client for the hinai beatmap mirror (metadata and `.osz` downloads).
- [`@haruhimemoe/osu`](https://www.npmjs.com/package/@haruhimemoe/osu): osu! API v2 shapes and the server client used for star ratings with mods.
- [`@haruhimemoe/ui`](https://www.npmjs.com/package/@haruhimemoe/ui): the theme and colors the site uses, buttons, cards, form fields, pagination, and the site header, footer and page frame.
- [`@haruhimemoe/brand`](https://www.npmjs.com/package/@haruhimemoe/brand): the wordmark, icons and link preview image, and the palette file behind the colors on [/brand](https://packs.haruhime.moe/brand).

## License

MIT. See [LICENSE](LICENSE). Not affiliated with or endorsed by ppy Pty Ltd. osu! is a trademark of ppy Pty Ltd.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues as described in [SECURITY.md](SECURITY.md).

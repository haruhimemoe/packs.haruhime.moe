/**
 * @file src/constants/content.ts
 * @desc The content registry: every docs, guides and legal page (content/<section>/<slug>.mdx),
 *       its title, description, last update and HowTo steps. Pages, .md mirrors, nav, sitemap
 *       and both llms files read it. Bump an entry's lastUpdated in the same commit as its text.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { defineContent } from "@haruhimemoe/next-kit/docs";

export const CONTENT = defineContent({
  docs: [
    {
      slug: "api",
      title: "API",
      description:
        "Read public packs and manage your own from scripts and bots with a personal API key: endpoints, limits, errors and an OpenAPI document.",
      lastUpdated: "2026-09-26",
    },
  ],
  guides: [
    {
      slug: "make-a-pack",
      title: "How to make an osu! mappool pack",
      description:
        "Build an osu! mappool pack from beatmap IDs, links or a pasted pool, sort the maps into slots, download it as one zip, and share it with a pack key.",
      lastUpdated: "2026-09-25",
      howTo: [
        {
          name: "Open the builder",
          text: "Go to packs.haruhime.moe/new. Your draft saves in this browser.",
        },
        { name: "Name the pack", text: "Type the tournament and round. The name goes on the zip." },
        {
          name: "Paste the pool",
          text: "Paste beatmap IDs, links, or slot lines like NM1 129891 into Paste a mappool.",
        },
        {
          name: "Arrange the slots",
          text: "Reorder slots, add your own, or move a map to another slot.",
        },
        { name: "Download the zip", text: "Press Download maps, then Save .zip." },
        { name: "Share it", text: "Copy the pack key, or save the pack to get a short link." },
      ],
    },
    {
      slug: "osu-collections",
      title: "Add a pack to your osu! collections",
      navTitle: "osu! collections",
      description:
        "Put a pack's maps in an osu!stable or osu!lazer collection: what happens to your collection.db, the steps for each, and what to do when a map doesn't show.",
      lastUpdated: "2026-09-26",
    },
    {
      slug: "download-a-torrent",
      title: "Download a pack with a torrent",
      description:
        "Open a pack's magnet link in qBittorrent, download the maps from other players instead of the mirror, and import the whole pool into osu! in one go.",
      lastUpdated: "2026-09-23",
      howTo: [
        { name: "Get a torrent app", text: "Install qBittorrent. It's free and open source." },
        {
          name: "Open the magnet link",
          text: "On the pack's page, press Open next to a magnet link, or copy it and add it in your torrent app.",
        },
        {
          name: "Pick a download folder",
          text: "Choose where the pack goes and start the download.",
        },
        {
          name: "Wait for it to finish",
          text: "A torrent only downloads while someone is seeding it. If it stalls, download the maps from the mirror on the pack page instead.",
        },
        {
          name: "Import the maps",
          text: "A pack made on packs is a folder of .osz files. Double-click them, or drag them onto osu!, to import them. If a torrent has anything else in it, don't open it: delete it and use the mirror download instead.",
        },
        {
          name: "Seed it back",
          text: "Leave the torrent running for a while so the next player can download it too.",
        },
      ],
    },
    {
      slug: "seed-a-torrent",
      title: "How to seed an osu! mappool torrent",
      navTitle: "Seed a torrent",
      description:
        "Make a torrent of your osu! mappool pack in the browser, seed it from qBittorrent, and share the magnet link so players download from each other.",
      lastUpdated: "2026-09-23",
      howTo: [
        {
          name: "Download the maps",
          text: "Open your pack, and in the Download card press Download maps. Wait until every map is ready.",
        },
        {
          name: "Save and unzip the zip",
          text: "Press Save .zip and unzip it. You get one folder named after the pack.",
        },
        {
          name: "Make the torrent",
          text: "Press Make torrent, then Save .torrent. Copy the magnet link too.",
        },
        {
          name: "Open it in qBittorrent",
          text: "Open the .torrent and set the save location to the folder that holds the pack folder. qBittorrent checks the files and starts seeding.",
        },
        {
          name: "Share the magnet link",
          text: "Post the magnet link or the .torrent. On a saved pack, press Add magnet link to this pack so it shows on the pack page.",
        },
        {
          name: "Keep seeding",
          text: "Leave qBittorrent running until players have the pack. Players who finish can seed too.",
        },
      ],
    },
    {
      slug: "pack-key",
      title: "Pack keys",
      description:
        "What a pack key is, how to share one so anyone can open the pack with no account, and exactly how a key encodes the pool's name, slots and maps.",
      lastUpdated: "2026-09-23",
    },
  ],
  legal: [
    {
      slug: "terms",
      title: "Terms of Service",
      description:
        "The rules for using packs.haruhime.moe: your account, the packs you save and share, the API, what we don't host, and what happens when something goes wrong.",
      lastUpdated: "2026-09-25",
    },
    {
      slug: "privacy",
      title: "Privacy Policy",
      description: "What packs.haruhime.moe stores, why, and what stays in your browser.",
      lastUpdated: "2026-09-28",
    },
    {
      slug: "your-privacy-rights",
      title: "GDPR & CCPA",
      description:
        "Your rights over your data under the GDPR and the CCPA, what we hold and why, and how to use them.",
      lastUpdated: "2026-09-28",
    },
    {
      slug: "copyright",
      title: "Copyright & Takedown",
      description:
        "How to report a saved pack, where to send notices about beatmap files, and where tournament pools come from.",
      lastUpdated: "2026-09-25",
    },
    {
      slug: "disclaimers",
      title: "Disclaimers",
      description:
        "Who packs isn't affiliated with, how our requests identify themselves, and what our numbers mean.",
      lastUpdated: "2026-09-28",
    },
  ],
});

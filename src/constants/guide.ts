/**
 * @file src/constants/guide.ts
 * @desc Guide document registry (content/guide/<slug>.mdx).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

export const GUIDE_SLUGS = [
  "make-a-pack",
  "download-a-torrent",
  "seed-a-torrent",
  "pack-key",
  "archived-pools",
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export const GUIDE_DOCS: Record<
  GuideSlug,
  {
    title: string;
    description: string;
    lastUpdated: string;
    /** Numbered steps for HowTo structured data; the guide's MDX list uses the same names. */
    howTo?: readonly { name: string; text: string }[];
  }
> = {
  "make-a-pack": {
    title: "How to make an osu! mappool pack",
    description:
      "Build a pack from beatmap IDs or links, download it as one zip, and share it with a key.",
    lastUpdated: "2026-09-24",
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
  "download-a-torrent": {
    title: "Download a pack with a torrent",
    description:
      "Open a pack's magnet link in qBittorrent, download the maps from other players, and import them into osu!.",
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
  "seed-a-torrent": {
    title: "How to seed an osu! mappool torrent",
    description:
      "Make a torrent of your pack, seed it from qBittorrent, and share the magnet link with players.",
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
  "pack-key": {
    title: "Pack keys",
    description: "What a pack key is, how to share one, and exactly how it's encoded.",
    lastUpdated: "2026-09-23",
  },
  "archived-pools": {
    title: "Archived pools",
    description:
      "Past tournament mappools saved as packs: where they come from (otdb), how to find them, which pools used a map, and how to report a wrong one.",
    lastUpdated: "2026-09-24",
  },
};

/**
 * @function isGuideSlug
 * @param value {string} untrusted route segment
 * @returns {boolean} true only for a registered slug
 */
export const isGuideSlug = (value: string): value is GuideSlug =>
  (GUIDE_SLUGS as readonly string[]).includes(value);

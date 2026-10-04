/**
 * @file tests/unit/constants/guide.test.ts
 * @desc Guides in the content registry, the nav link, the pack key doc staying in sync with the codec, the
 *       make-a-pack tips (Copy ID, the osu! collections link), and the osu! collections guide
 *       covering both flows (osu! closed before the file is picked), why a map may not show, and
 *       what happens to the file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { findEntry } from "@haruhimemoe/next-kit/docs";
import { decodePackKey, PackKeyError } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { CONTENT } from "@/constants/content";
import { NAV_LINKS } from "@/constants/site";

const file = (slug: string) => path.join(process.cwd(), "content", "guides", `${slug}.mdx`);

const guide = (slug: string) => {
  const entry = findEntry(CONTENT, "guides", slug);
  if (!entry) throw new Error(`no guide ${slug}`);
  return entry;
};

describe("guides registry", () => {
  it("is linked from the main nav through the guides index", () => {
    expect(NAV_LINKS.some((l) => l.href === "/guides")).toBe(true);
  });
});

describe("pack-key guide", () => {
  const text = () => readFileSync(file("pack-key"), "utf8");

  it.each([
    "pk1.",
    "CRC-16/CCITT-FALSE",
    "base64url",
    "NM, HD, HR, DT, FM, TB",
    "/k#",
    "pk2.",
    "0xFE",
    "0xFF",
    "pk3.",
    "0xFD",
    "Version history",
    "`HD` and `DT` together is `10`",
  ])("documents %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it("has no h1 of its own", () => {
    expect(text()).not.toMatch(/^# /m);
  });
});

/** CRC-16/CCITT-FALSE, as the guide specifies it (the package doesn't export its own). */
const crc16 = (bytes: readonly number[]): number => {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
};

describe("pack-key guide covers every key version", () => {
  const text = () => readFileSync(file("pack-key"), "utf8");
  const signedKey = (version: number, body: number[]) => {
    const crc = crc16(body);
    return `pk${version}.${Buffer.from([...body, crc >> 8, crc & 0xff]).toString("base64url")}`;
  };
  /** The decoder refuses unknown versions with "version"; any other outcome means it reads it. */
  const reads = (version: number): boolean => {
    try {
      decodePackKey(signedKey(version, [version, 1, 0x61, 0]));
      return true;
    } catch (error) {
      return !(error instanceof PackKeyError && error.code === "version");
    }
  };
  let latest = 1;
  while (latest < 255 && reads(latest + 1)) latest++;
  const versions = Array.from({ length: latest }, (_, i) => i + 1);

  it("finds the decoder reads at least version 3", () => {
    expect(latest).toBeGreaterThanOrEqual(3);
  });

  it.each(versions)("has a Version %i section", (version) => {
    expect(text()).toMatch(new RegExp(`^## Version ${version}: `, "m"));
  });

  it.each(versions)("has a history line for pk%i.", (version) => {
    const history = text().split("## Version history")[1] ?? "";
    expect(history).toMatch(
      new RegExp(`^- \\*\\*pk${version}\\.\\*\\* \\(\\d{4}-\\d{2}-\\d{2}\\): `, "m"),
    );
  });

  it("names every version in the intro", () => {
    const intro = text().split("\n\n")[0] ?? "";
    for (const version of versions) expect(intro).toContain(`\`pk${version}.\``);
  });

  it("has no em dashes", () => {
    expect(text()).not.toContain("—");
  });
});

describe("make-a-pack guide", () => {
  const text = () => readFileSync(file("make-a-pack"), "utf8");

  it("names every HowTo step in its numbered list, in order", () => {
    const steps = guide("make-a-pack").howTo ?? [];
    expect(steps).toHaveLength(6);
    let from = 0;
    for (const { name } of steps) {
      const at = text().indexOf(`**${name}.**`, from);
      expect(at).toBeGreaterThan(from - 1);
      from = at;
    }
  });

  it("points to Copy ID", () => {
    expect(text()).toContain('Every map row has a "Copy ID" button that copies its beatmap ID');
    expect(text()).not.toContain("Used in N pools");
    expect(guide("make-a-pack").lastUpdated).toBe("2026-09-25");
  });

  it("answers the question in its first paragraph and links the builder", () => {
    const first = text().split("\n\n")[0] ?? "";
    expect(first).toContain("osu! mappool pack");
    expect(first).toContain("(/new)");
  });

  it("has no h1 and no em dashes", () => {
    expect(text()).not.toMatch(/^# /m);
    expect(text()).not.toContain("—");
  });
});

describe("seed-a-torrent guide", () => {
  const text = () => readFileSync(file("seed-a-torrent"), "utf8");

  it("names every HowTo step in its numbered list, in order", () => {
    const steps = guide("seed-a-torrent").howTo ?? [];
    expect(steps).toHaveLength(6);
    let from = 0;
    for (const { name } of steps) {
      const at = text().indexOf(`**${name}.**`, from);
      expect(at).toBeGreaterThan(from - 1);
      from = at;
    }
  });

  it("answers the question in its first paragraph", () => {
    const first = text().split("\n\n")[0] ?? "";
    expect(first).toContain("osu! mappool torrent");
    expect(first).toContain("qBittorrent");
  });

  it("has no h1 and no em dashes", () => {
    expect(text()).not.toMatch(/^# /m);
    expect(text()).not.toContain("—");
  });

  it("says the download options make a different torrent", () => {
    expect(text()).toMatch(/download options.*different torrent/i);
    expect(guide("seed-a-torrent").lastUpdated).toBe("2026-09-23");
  });

  it("is linked from the make-a-pack guide", () => {
    expect(readFileSync(file("make-a-pack"), "utf8")).toContain("(/guides/seed-a-torrent)");
  });
});

describe("download-a-torrent guide", () => {
  const text = () => readFileSync(file("download-a-torrent"), "utf8");

  it("names every HowTo step in its numbered list, in order", () => {
    const steps = guide("download-a-torrent").howTo ?? [];
    expect(steps).toHaveLength(6);
    let from = 0;
    for (const { name } of steps) {
      const at = text().indexOf(`**${name}.**`, from);
      expect(at).toBeGreaterThan(from - 1);
      from = at;
    }
  });

  it("answers the question in its first paragraph", () => {
    const first = text().split("\n\n")[0] ?? "";
    expect(first).toContain("magnet link");
    expect(first).toContain("qBittorrent");
  });

  it.each([
    "## What a magnet link is",
    "free and open source",
    "only downloads while someone is seeding",
    "from the mirror",
    "`.osz`",
    "drag them onto osu!",
    "(/guides/seed-a-torrent)",
    "Only download and share what you're allowed to where you live.",
    "your torrent app contacts the trackers in the link and other peers, and they see your IP address",
    "packs only lists its own set of trackers in magnet links",
    "A pack made on packs is a folder of numbered `.osz` files plus `pack.txt`",
    "don't open it: delete it and use the mirror download instead",
  ])("covers %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it("has no h1 and no em dashes", () => {
    expect(text()).not.toMatch(/^# /m);
    expect(text()).not.toContain("—");
  });

  it("is linked back from the seed-a-torrent guide", () => {
    expect(readFileSync(file("seed-a-torrent"), "utf8")).toContain("(/guides/download-a-torrent)");
  });

  it("the HowTo step matches the guide: softened claim, same warning", () => {
    const step = guide("download-a-torrent").howTo?.find((s) => s.name === "Import the maps");
    expect(step?.text).toContain("A pack made on packs is a folder of .osz files");
    expect(step?.text).toContain("don't open it");
  });
});

describe("osu-collections guide", () => {
  const text = () => readFileSync(file("osu-collections"), "utf8");

  it("is registered and dated", () => {
    expect(guide("osu-collections").title).toBeTruthy();
    expect(guide("osu-collections")).toMatchObject({
      title: "Add a pack to your osu! collections",
      lastUpdated: "2026-09-26",
    });
  });

  it("answers the question in its first paragraph", () => {
    const first = text().split("\n\n")[0] ?? "";
    expect(first).toContain('"Add to osu! collection"');
    expect(first).toContain("osu!stable");
    expect(first).toContain("osu!lazer");
    expect(first).toContain("packs doesn't upload it or keep it");
  });

  it.each([
    "## What a collection holds",
    "the MD5 checksum of its `.osu` file",
    "## osu!stable",
    "`%LOCALAPPDATA%\\osu!`",
    "paste `%LOCALAPPDATA%\\osu!` into the file picker's address bar",
    "No `collection.db` yet? Make any collection in osu!, close osu!, then load the file it writes.",
    "**Download collection.db.**",
    "named exactly `collection.db`",
    "**Close osu!.** osu!stable saves collection changes a while after you make them",
    "Keep it closed until the new file is in place.",
    "Keep a copy of your old `collection.db`",
    "`collection (1).db`",
    "The second download includes the first change",
    "## osu!lazer",
    '"Download zip for osu!lazer"',
    "an empty `osu!.import.cfg`",
    '"Run setup wizard"',
    "Untick Beatmaps, Scores and Skins, leave Collections ticked",
    "osu!lazer on Android and iOS can't import collections",
    "## When a map doesn't show up",
    "Update the map in osu!",
    "It isn't uploaded, saved or logged",
  ])("covers %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it("has no h1 and no em dashes", () => {
    expect(text()).not.toMatch(/^# /m);
    expect(text()).not.toContain("—");
  });

  it("closes osu! before the file is picked, not only before the swap", () => {
    const stable = text().slice(text().indexOf("## osu!stable"), text().indexOf("## osu!lazer"));
    expect(stable.indexOf("**Close osu!.**")).toBeGreaterThanOrEqual(0);
    expect(stable.indexOf("**Close osu!.**")).toBeLessThan(stable.indexOf("**Load it.**"));
  });

  it("is linked from the make-a-pack guide", () => {
    expect(readFileSync(file("make-a-pack"), "utf8")).toContain("(/guides/osu-collections)");
  });
});

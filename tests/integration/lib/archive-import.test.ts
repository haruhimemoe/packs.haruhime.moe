/**
 * @file tests/integration/lib/archive-import.test.ts
 * @desc The archive:import runner against the test database with the committed otdb sample: a
 *       dry run writes nothing; a real run creates public packs owned by the archive account,
 *       with archive details and seeded stats the stats job picks up; a second run changes
 *       nothing; a new source joins its stored pack; a changed pool gets its own pack and the
 *       old one stays; a hidden pack isn't imported again; every real run rebuilds map usage for
 *       every map, and a dry run doesn't. The export download, the file read and the site refresh
 *       are stubs: nothing reaches otdb or the site.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { ARCHIVE_ACCOUNT, OTDB_EXPORT_URL } from "@/constants/archive";
import { MAP_USAGE_COLLECTION } from "@/constants/map-usage";
import {
  type ArchiveImportDeps,
  REVALIDATE_PACKS_PATH,
  runArchiveImport,
} from "@/lib/archive-import";
import { getDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import { getMapUsage } from "@/services/map-usage";
import { setPackHidden } from "@/services/moderation";
import { countPacksNeedingStats } from "@/services/pack-stats";
import { buildSearchIndex, listPublicPacks } from "@/services/public-packs";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const SAMPLE_TEXT = readFileSync(
  path.join(process.cwd(), "tests", "fixtures", "otdb", "sample.json"),
  "utf8",
);
type SamplePool = {
  id: number;
  name: string;
  beatmap_connections: { slot: string; beatmap: { beatmap_metadata: { id: number } } }[];
};
const SAMPLE = (): SamplePool[] => JSON.parse(SAMPLE_TEXT) as SamplePool[];
const NOW = new Date("2026-09-24T12:00:00.000Z");

/** A run with every outside call stubbed; returns the exit code and what it printed. */
const run = async (
  argv: string[],
  deps: ArchiveImportDeps = {},
  files: Record<string, string> = {},
) => {
  const out: string[] = [];
  const err: string[] = [];
  const fetch = vi.fn(async () => new Response("unexpected", { status: 500 }));
  const code = await runArchiveImport(argv, {
    fetch,
    readFile: async (file) => {
      const text = files[file];
      if (text === undefined) throw new Error(`ENOENT: ${file}`);
      return text;
    },
    log: (text) => out.push(text),
    warn: (text) => err.push(text),
    now: () => NOW,
    cronSecret: () => undefined,
    ...deps,
  });
  return { code, out: out.join("\n"), err: err.join("\n"), fetch };
};

const withSample = (argv: string[], deps: ArchiveImportDeps = {}, text = SAMPLE_TEXT) =>
  run([...argv, "--file", "sample.json"], deps, { "sample.json": text });

const archivePacks = () =>
  getPackModel()
    .find({ "archive.fingerprint": { $exists: true } })
    .sort({ _id: 1 })
    .lean();

describe("archive:import", () => {
  it("writes nothing on a dry run, and prints the plan", async () => {
    const { code, out } = await withSample(["otdb", "--dry-run"]);
    expect(code).toBe(0);
    expect(out).toContain("otdb: 22 pools read. Dry run: nothing was written.");
    expect(out).toMatch(/New packs\s+17/);
    expect(out).toContain("otdb #418 is the same pool as otdb #71");
    expect(out).toContain("otdb #481  Lobby 42: Roulette Team Solos Round of 16: Slot DT1");
    expect(await getDb().collection("packs").countDocuments({})).toBe(0);
    expect(await getDb().collection("user").countDocuments({})).toBe(0);
  });

  it("creates public archive packs owned by the archive account", async () => {
    const { code, out } = await withSample(["otdb"]);
    expect(code).toBe(0);
    expect(out).toContain("Wrote 17 new packs and new sources on 0 packs.");
    const account = await getDb().collection("user").findOne({ email: ARCHIVE_ACCOUNT.email });
    expect(account).toMatchObject({ system: true, username: "haruhime archive" });
    const packs = await archivePacks();
    expect(packs).toHaveLength(17);
    for (const pack of packs) {
      expect(pack.ownerId.equals(account?._id as ObjectId)).toBe(true);
      expect(pack.visibility).toBe("public");
    }
    // Created in pool id order, so the newest pool is first on /packs.
    expect(packs[0]?.archive?.sources.map((source) => source.id)).toEqual(["58"]);
    const owc = packs.find((pack) => pack.name === "osu! World Cup 2023 Grand Finals");
    expect(owc).toMatchObject({
      description: "Archived from otdb pool #657: https://otdb.sheppsu.me/db/mappools/657/",
      archive: {
        tournament: "osu! World Cup 2023",
        round: "Grand Finals",
        year: 2023,
        badged: null,
        fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        sources: [
          {
            kind: "otdb",
            id: "657",
            url: "https://otdb.sheppsu.me/db/mappools/657/",
            importedAt: NOW,
          },
        ],
      },
      stats: { count: 20, modes: ["osu"], complete: false, attempts: 1, retryAt: NOW },
    });
    const usa = packs.find((pack) => pack.name === "United States Cup 2017 Quarter Finals");
    expect(usa?.archive?.sources.map((source) => source.id)).toEqual(["71", "418"]);
    // The stats job takes the seeded, incomplete stats at once.
    expect(await countPacksNeedingStats(NOW)).toBe(17);
    // They're on /packs and in its index like any public pack.
    expect((await listPublicPacks(1)).total).toBe(17);
    const index = await buildSearchIndex();
    // Newest created first: the highest pool id.
    expect(index.packs[0]?.n).toBe("5 Digit North American Draft Swiss Round 1 & 2");
    expect(index.packs.find((entry) => entry.s === owc?.slug)).toMatchObject({
      o: "haruhime archive",
      c: 20,
      k: false,
    });
  });

  it("changes nothing on a second run", async () => {
    await withSample(["otdb"]);
    const before = await archivePacks();
    const { code, out } = await withSample(["otdb"]);
    expect(code).toBe(0);
    expect(out).toMatch(/New packs\s+0/);
    expect(out).toMatch(/Unchanged\s+19/);
    expect(out).toContain("Wrote 0 new packs and new sources on 0 packs.");
    expect(await archivePacks()).toEqual(before);
    expect(await getDb().collection("user").countDocuments({})).toBe(1);
  });

  it("rebuilds map usage for every map on a real run, and never on a dry run", async () => {
    const usageCount = () => getDb().collection(MAP_USAGE_COLLECTION).countDocuments({});
    const dry = await withSample(["otdb", "--dry-run"]);
    expect(dry.out).not.toContain("Map usage");
    expect(await usageCount()).toBe(0);

    const { out } = await withSample(["otdb"]);
    const packs = await archivePacks();
    const maps = new Set(packs.flatMap((pack) => pack.slots.map((slot) => slot.beatmapId)));
    expect(await usageCount()).toBe(maps.size);
    expect(out).toContain(
      `Map usage: ${maps.size} maps used in archive pools; ${maps.size} updated, 0 removed.`,
    );
    const owc = packs.find((pack) => pack.name === "osu! World Cup 2023 Grand Finals");
    const [slot] = owc?.slots ?? [];
    if (!owc || !slot) throw new Error("OWC 2023 wasn't imported");
    const [usage] = await getMapUsage([slot.beatmapId]);
    expect(usage?.entries).toContainEqual(
      expect.objectContaining({
        slug: owc.slug,
        tournament: "osu! World Cup 2023",
        round: "Grand Finals",
        year: 2023,
      }),
    );

    const again = await withSample(["otdb"]);
    expect(again.out).toContain(
      `Map usage: ${maps.size} maps used in archive pools; 0 updated, 0 removed.`,
    );
  });

  it("adds a second copy of a stored pool as a new source on its pack", async () => {
    await withSample(["otdb"]);
    const [first] = SAMPLE();
    const copy = [{ ...first, id: 9001, name: "Cindelluna's Winter Tour 2019 Finals rerun" }];
    const { out } = await withSample(["otdb"], {}, JSON.stringify(copy));
    expect(out).toMatch(/Updated \(new source\)\s+1/);
    expect(out).toContain("gains otdb #9001");
    const pack = await getPackModel().findOne({ "archive.sources.id": "9001" }).lean();
    expect(pack?.name).toBe("Cindelluna's Winter Tour 2019 Finals (20k-10k)");
    expect(pack?.archive?.sources.map((source) => source.id)).toEqual(["58", "9001"]);
    expect(await archivePacks()).toHaveLength(17);
  });

  it("gives a changed pool its own pack, unlists the old one, and flags the pair", async () => {
    await withSample(["otdb"]);
    const [first] = SAMPLE();
    if (!first) throw new Error("empty sample");
    const [connection, ...rest] = first.beatmap_connections;
    if (!connection) throw new Error("empty pool");
    const changed = [
      {
        ...first,
        beatmap_connections: [
          {
            ...connection,
            beatmap: {
              ...connection.beatmap,
              beatmap_metadata: { ...connection.beatmap.beatmap_metadata, id: 4242 },
            },
          },
          ...rest,
        ],
      },
    ];
    const { out } = await withSample(["otdb"], {}, JSON.stringify(changed));
    expect(out).toMatch(/New packs\s+1/);
    expect(out).toMatch(/Changed pools\s+1/);
    expect(out).toMatch(/Unlisted old packs\s+1/);
    expect(out).toMatch(/otdb #58 {2}was [\w-]{10} \(Cindelluna's .*\), now a new pack/);
    expect(out).toContain("Unlisted 1 old pack whose every source changed.");
    const both = await getPackModel().find({ "archive.sources.id": "58" }).sort({ _id: 1 }).lean();
    expect(both.map((pack) => pack.visibility)).toEqual(["unlisted", "public"]);
    // The pool counts once in map usage: the new version only.
    const [usage] = await getMapUsage([4242]);
    expect(usage?.entries.map((entry) => entry.slug)).toEqual([both[1]?.slug]);
    // A map both versions share lists only the new one.
    const sharedId = rest[0]?.beatmap.beatmap_metadata.id;
    if (sharedId === undefined) throw new Error("one-map pool");
    const [shared] = await getMapUsage([sharedId]);
    expect(shared?.entries.map((entry) => entry.slug)).toContain(both[1]?.slug);
    expect(shared?.entries.map((entry) => entry.slug)).not.toContain(both[0]?.slug);
  });

  it("never brings back a pool an admin hid, even once it changed", async () => {
    await withSample(["otdb"]);
    const [first] = SAMPLE();
    if (!first) throw new Error("empty sample");
    const hidden = await getPackModel()
      .findOne({ "archive.sources.id": String(first.id) })
      .lean();
    if (!hidden) throw new Error("nothing imported");
    await setPackHidden(hidden.slug, new ObjectId().toHexString(), true);
    const [connection, ...rest] = first.beatmap_connections;
    if (!connection) throw new Error("empty pool");
    const changed = [
      {
        ...first,
        beatmap_connections: [
          {
            ...connection,
            beatmap: {
              ...connection.beatmap,
              beatmap_metadata: { ...connection.beatmap.beatmap_metadata, id: 4242 },
            },
          },
          ...rest,
        ],
      },
    ];
    const { out } = await withSample(["otdb"], {}, JSON.stringify(changed));
    expect(out).toMatch(/New packs\s+0/);
    expect(out).toContain("an admin hid its pack");
    expect(await getPackModel().countDocuments({ "archive.sources.id": String(first.id) })).toBe(1);
  });

  it("never imports a pool again after an admin hid its pack", async () => {
    await withSample(["otdb"]);
    const [pack] = await archivePacks();
    if (!pack) throw new Error("nothing imported");
    await setPackHidden(pack.slug, new ObjectId().toHexString(), true);
    const { out } = await withSample(["otdb"]);
    expect(out).toMatch(/New packs\s+0/);
    expect(await archivePacks()).toHaveLength(17);
  });

  it("downloads otdb's export when no file is given", async () => {
    const fetch = vi.fn(async () => new Response(SAMPLE_TEXT));
    const { code, out } = await run(["otdb", "--dry-run"], { fetch });
    expect(code).toBe(0);
    expect(out).toContain("otdb: 22 pools read.");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(OTDB_EXPORT_URL, expect.anything());
  });

  it.each([
    ["a failed download", ["otdb"], "Downloading the otdb export failed (500)."],
    ["a missing file", ["otdb", "--file", "missing.json"], "ENOENT: missing.json"],
  ])("stops with exit code 1 on %s", async (_label, argv, message) => {
    const { code, err } = await run(argv);
    expect(code).toBe(1);
    expect(err).toContain(`archive:import stopped: ${message}`);
    expect(await getDb().collection("packs").countDocuments({})).toBe(0);
  });

  it("stops on a file that isn't JSON or an export that isn't a list", async () => {
    expect((await withSample(["otdb"], {}, "not json")).code).toBe(1);
    const notAList = await withSample(["otdb"], {}, "{}");
    expect(notAList.code).toBe(1);
    expect(notAList.err).toContain("The otdb export isn't a list of pools.");
  });

  it("answers 2 with the usage for bad arguments", async () => {
    const { code, err } = await run(["otr"]);
    expect(code).toBe(2);
    expect(err).toContain("Usage: bun run archive:import otdb [--dry-run] [--file <path>]");
  });

  describe("refreshing the site", () => {
    const site = "https://packs.example";

    it("asks the site to refresh /packs after a real import that wrote something", async () => {
      const fetch = vi.fn(async () => Response.json({ revalidated: true }));
      const { code, out } = await withSample(["otdb"], {
        fetch,
        siteUrl: site,
        cronSecret: () => "cron-secret-for-tests-0123456789",
      });
      expect(code).toBe(0);
      expect(fetch).toHaveBeenCalledWith(`${site}${REVALIDATE_PACKS_PATH}`, {
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer cron-secret-for-tests-0123456789",
        }),
      });
      expect(out).toContain(`Refreshed /packs and its index on ${site}.`);
    });

    it("still asks, and says what it wrote, when the import stops after writing packs", async () => {
      const fetch = vi.fn(async () => Response.json({ revalidated: true }));
      let made = 0;
      const makeSlug = () => {
        made++;
        if (made > 2) throw new Error("the database went away");
        return `partial${String(made).padStart(3, "0")}`;
      };
      const { code, out, err } = await withSample(["otdb"], {
        fetch,
        siteUrl: site,
        makeSlug,
        cronSecret: () => "cron-secret-for-tests-0123456789",
      });
      expect(code).toBe(1);
      expect(err).toContain("archive:import stopped: the database went away");
      expect(out).toContain("Wrote 2 new packs and new sources on 0 packs before it stopped.");
      expect(await archivePacks()).toHaveLength(2);
      // /packs gets the two packs now, not at its daily refresh.
      expect(fetch).toHaveBeenCalledWith(`${site}${REVALIDATE_PACKS_PATH}`, expect.anything());
      expect(out).toContain(`Refreshed /packs and its index on ${site}.`);
    });

    it("asks nothing when an import stops before writing anything", async () => {
      const fetch = vi.fn(async () => Response.json({ revalidated: true }));
      const { code, out } = await withSample(["otdb"], {
        fetch,
        siteUrl: site,
        makeSlug: () => {
          throw new Error("the database went away");
        },
        cronSecret: () => "cron-secret-for-tests-0123456789",
      });
      expect(code).toBe(1);
      expect(out).toContain("Wrote 0 new packs and new sources on 0 packs before it stopped.");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("doesn't ask on a dry run or when nothing changed", async () => {
      const fetch = vi.fn(async () => Response.json({ revalidated: true }));
      const deps = { fetch, siteUrl: site, cronSecret: () => "cron-secret-for-tests-0123456789" };
      await withSample(["otdb", "--dry-run"], deps);
      await withSample(["otdb"]);
      await withSample(["otdb"], deps);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("says when it can't ask, and still finishes", async () => {
      const noSecret = await withSample(["otdb"], { siteUrl: site });
      expect(noSecret.code).toBe(0);
      expect(noSecret.out).toContain(
        `CRON_SECRET isn't set, so ${site} wasn't asked to refresh. /packs shows the changes at its daily refresh, or after the next pack save.`,
      );
    });

    it("warns when the site refuses or the secret is bad, and still finishes", async () => {
      const refused = await withSample(["otdb"], {
        fetch: async () => new Response("", { status: 401 }),
        siteUrl: site,
        cronSecret: () => "wrong-secret-for-tests-000000000",
      });
      expect(refused.code).toBe(0);
      expect(refused.err).toContain(`Couldn't refresh /packs on ${site}: the site answered 401.`);
      await getDb().collection("packs").deleteMany({});
      const bad = await withSample(["otdb"], {
        cronSecret: () => {
          throw new Error("Missing or invalid environment variables: CRON_SECRET.");
        },
      });
      expect(bad.code).toBe(0);
      expect(bad.err).toContain(
        "CRON_SECRET. /packs shows the changes at its daily refresh, or after the next pack save.",
      );
    });
  });
});

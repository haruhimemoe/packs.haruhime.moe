/**
 * @file tests/integration/app/packs-index.test.ts
 * @desc GET /packs/index.json serves the public search index; once a pack's stats are computed
 *       (after its save), its entry carries them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { GET } from "@/app/(public)/packs/index.json/route";
import { createPack } from "@/services/packs";
import { flushAfter } from "../../helpers/after";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";
import { beatmapRow, onMirror, setupStatsLookups } from "../../helpers/stats-lookups";

setupTestDb();
const lookups = setupStatsLookups();

describe("GET /packs/index.json", () => {
  it("returns public packs in the index shape", async () => {
    const host = await createTestUser({ username: "Chiyo" });
    const pack = await createPack(host.id, {
      name: "Cup",
      slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
      visibility: "public",
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      v: 1,
      packs: [{ s: pack.slug, n: "Cup", o: "Chiyo", c: 1, d: "", u: pack.updatedAt }],
    });
  });

  it("carries a pack's stats once they're computed", async () => {
    onMirror(
      lookups,
      beatmapRow(129891, { difficulty_rating: 7.8058, total_length: 258, bpm: 222.22 }),
      beatmapRow(75, { difficulty_rating: 2.55, total_length: 142, bpm: 119.999 }),
    );
    lookups.ratings.set("75:DT", 3.61);
    const host = await createTestUser({ username: "Chiyo" });
    const pack = await createPack(host.id, {
      name: "Cup",
      slots: [
        { mod: "NM", index: 1, beatmapId: 129891 },
        { mod: "DT", index: 1, beatmapId: 75 },
      ],
      visibility: "public",
    });
    await flushAfter();

    expect(await (await GET()).json()).toEqual({
      v: 1,
      packs: [
        {
          s: pack.slug,
          n: "Cup",
          o: "Chiyo",
          c: 2,
          d: "",
          u: pack.updatedAt,
          r: [3.61, 7.81],
          a: 5.71,
          l: [95, 258],
          b: [180, 222],
          m: "NM,DT",
          g: "osu",
          k: true,
        },
      ],
    });
  });
});

/**
 * @file tests/unit/config/vercel-json.test.ts
 * @desc vercel.json holds exactly one cron, once a day (all Vercel Hobby allows), and it points at
 *       the pack stats route, which answers GET.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type VercelJson = { crons?: { path: string; schedule: string }[] };

const config = (): VercelJson =>
  JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as VercelJson;

describe("vercel.json", () => {
  it("runs the pack stats job once a day", () => {
    const crons = config().crons ?? [];
    expect(crons).toHaveLength(1);
    expect(crons[0]?.path).toBe("/api/cron/pack-stats");
    // Minute and hour fixed, every day: "M H * * *".
    expect(crons[0]?.schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });

  it("points at a route that answers GET", async () => {
    const route = await import("@/app/api/cron/pack-stats/route");
    expect(typeof route.GET).toBe("function");
  });
});

/**
 * @file src/components/admin/PackStatsBackfill.tsx
 * @desc /admin "Pack stats" panel: runs one batch of the stats job now (the daily cron runs the
 *       same one) and says how many packs it updated and how many still need stats. Packs saved
 *       before filters existed get theirs this way.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { Button, Card, Notice } from "@haruhimemoe/ui";
import { useState } from "react";
import { PACK_STATS_JOB_LIMIT } from "@/constants/pack-stats";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import type { PackStatsJob } from "@/schemas/pack-stats";

type PackStatsBackfillProps = {
  api?: Pick<typeof packsApi, "fillPackStats">;
};

const packs = (count: number): string => `${count} ${count === 1 ? "pack" : "packs"}`;

const summary = ({ updated, remaining }: PackStatsJob): string =>
  `Updated ${packs(updated)}. ${
    remaining === 0
      ? "Every pack has stats."
      : `${remaining} still ${remaining === 1 ? "needs" : "need"} stats.`
  }`;

export function PackStatsBackfill({ api = packsApi }: PackStatsBackfillProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PackStatsJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.fillPackStats());
    } catch (cause) {
      setError(cause instanceof PacksApiError ? cause.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Pack stats" className="flex flex-col gap-3">
      <p className="text-c3 text-sm">
        Filters on /packs need each pack's star rating, length and mods. A daily job fills in
        missing ones, {PACK_STATS_JOB_LIMIT} packs at a time. Run it now to catch up faster.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={run} disabled={busy}>
          {busy ? "Filling in stats…" : "Fill in stats"}
        </Button>
        <Notice live>{result ? summary(result) : ""}</Notice>
      </div>
      {error ? (
        <Notice live tone="error">
          {error}
        </Notice>
      ) : null}
    </Card>
  );
}

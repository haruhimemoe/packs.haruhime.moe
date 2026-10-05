/**
 * @file src/components/admin/PackStatsBackfill.tsx
 * @desc /admin "Pack stats" panel: runs one batch of the stats job now (the daily cron runs the
 *       same one) and says how many packs it updated, how many still need stats, and how many wait
 *       to retry lookups that failed. Packs saved before filters existed get theirs this way.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import { AsyncButton, Card, Text } from "@haruhimemoe/ui";
import { PACK_STATS_JOB_LIMIT } from "@/constants/pack-stats";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import type { PackStatsJob } from "@/schemas/pack-stats";
import { countOf } from "@/utils/text";

type PackStatsBackfillProps = {
  api?: Pick<typeof packsApi, "fillPackStats">;
};

const summary = ({ updated, remaining, waiting }: PackStatsJob): string => {
  const retry = "missing some details and will be tried again later.";
  const parts = [`Updated ${countOf(updated, "pack")}.`];
  if (remaining > 0) {
    parts.push(`${remaining} still ${remaining === 1 ? "needs" : "need"} stats.`);
    if (waiting > 0) parts.push(`${waiting} more ${waiting === 1 ? "is" : "are"} ${retry}`);
  } else if (waiting > 0) {
    parts.push(
      `Nothing else is due. ${countOf(waiting, "pack")} ${waiting === 1 ? "is" : "are"} ${retry}`,
    );
  } else {
    parts.push("Every pack has stats.");
  }
  return parts.join(" ");
};

/**
 * @function PackStatsBackfill
 * @param props {PackStatsBackfillProps} the admin API (a test seam)
 * @returns {JSX.Element} the Pack stats card: what the job does, and a @haruhimemoe/ui AsyncButton
 *          that runs one batch and announces its counts (or the server's error)
 */
export function PackStatsBackfill({ api = packsApi }: PackStatsBackfillProps) {
  return (
    <Card title="Pack stats" className="flex flex-col gap-3">
      <Text tone="muted">
        Filters on /packs need each pack's star rating, length and mods. A daily job fills in
        missing ones, {PACK_STATS_JOB_LIMIT} packs at a time. Run it now to catch up faster.
      </Text>
      <AsyncButton
        variant="secondary"
        action={async () => summary(await api.fillPackStats())}
        pendingLabel="Filling in stats…"
        failedMessage={(cause) =>
          cause instanceof PacksApiError ? cause.message : "Something went wrong. Try again."
        }
      >
        Fill in stats
      </AsyncButton>
    </Card>
  );
}

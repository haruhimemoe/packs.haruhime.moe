/**
 * @file src/components/export/DownloadProgress.tsx
 * @desc Overall and per-slot download state while a pack's sets come down from the mirror.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { formatBytes } from "@haruhimemoe/osu/format";
import { cx } from "@haruhimemoe/ui";
import type { ProgressRow } from "@/hooks/usePackDownloads";
import type { SetStatus } from "@/lib/downloads/fetch-sets";
import { countOf } from "@/utils/text";

const statusText = (status: SetStatus | undefined): string => {
  switch (status?.status) {
    case undefined:
    case "queued":
      return "Waiting";
    case "checking":
      return "Checking…";
    case "downloading":
      return status.total
        ? `Downloading ${Math.min(100, Math.round((status.loaded / status.total) * 100))}%`
        : `Downloading ${formatBytes(status.loaded)}`;
    case "waiting":
      return `Mirror is busy, retrying in ${Math.ceil(status.retryInMs / 1000)}s`;
    case "removing":
      return "Removing backgrounds…";
    case "ready": {
      const text = status.fromCache ? "Ready (saved in this browser)" : "Ready";
      return status.backgroundsKept ? `${text}, backgrounds kept` : text;
    }
    case "failed":
      return status.message;
  }
};

type DownloadProgressProps = {
  rows: readonly ProgressRow[];
  statuses: ReadonlyMap<number, SetStatus>;
};

/**
 * @function DownloadProgress
 * @param props {DownloadProgressProps} rows, statuses
 * @returns {JSX.Element} overall and per-slot download state while a pack's sets come down from the
 *          mirror
 */
export function DownloadProgress({ rows, statuses }: DownloadProgressProps) {
  const setIds = [...new Set(rows.map((row) => row.setId))];
  const ready = setIds.filter((id) => statuses.get(id)?.status === "ready").length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <progress
          value={ready}
          max={setIds.length}
          aria-label="Download progress"
          className="h-2 w-full accent-h1"
        />
        <output className="text-c3 text-sm">
          {ready} of {countOf(setIds.length, "set")} ready
        </output>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map((row) => {
          const status = statuses.get(row.setId);
          return (
            <li key={row.key} className="flex flex-wrap items-baseline gap-x-3">
              <span className="w-10 shrink-0 font-bold text-c1">{row.label}</span>
              <span className="min-w-0 flex-1 truncate text-c2">{row.title}</span>
              <span
                className={cx(
                  "ml-auto text-right",
                  status?.status === "failed" ? "text-rose-300" : "text-c4",
                )}
              >
                {statusText(status)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

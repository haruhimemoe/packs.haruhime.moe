/**
 * @file src/components/export/ExportPanel.tsx
 * @desc The "Download" card on /new, /k and /p/[slug] (at the top of /k and /p): a saved pack's
 *       Torrent section first when it has magnet links, then the mirror flow: pick the download
 *       options (locked while anything runs), download every set once (browser → mirror, cached in
 *       this browser), then save the same files as a zip or a torrent. When map info fails to load,
 *       the card offers the retry itself (onRetryMeta).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { type ReactNode, useId, useState } from "react";
import { DownloadOptions } from "@/components/export/DownloadOptions";
import { DownloadProgress } from "@/components/export/DownloadProgress";
import {
  type MagnetTarget,
  TorrentExport,
  type TorrentSeams,
} from "@/components/export/TorrentExport";
import { ZipExport, type ZipSeams } from "@/components/export/ZipExport";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { MetaState } from "@/hooks/beatmapMetaState";
import { useDownloadChoices } from "@/hooks/useDownloadChoices";
import { usePackDownloads } from "@/hooks/usePackDownloads";
import type { FetchSetsDeps } from "@/lib/downloads/fetch-sets";
import type { DownloadChoices } from "@/schemas/download-choices";
import type { Pool } from "@/schemas/pack";
import { cn } from "@/utils/cn";

export type ExportPanelProps = {
  pack: Pool;
  packKey: string;
  getMeta: (beatmapId: number) => MetaState;
  /** The owner of a saved pack can add the made torrent's magnet link to it. */
  magnets?: MagnetTarget;
  /**
   * A saved pack's Torrent section (its recorded magnet links), shown first. Pass it only when
   * there are links: the mirror flow then gets its own "From the mirror" heading.
   */
  torrentLinks?: ReactNode;
  /** Retries loading map info; with it, the card offers "Retry loading maps" when some failed. */
  onRetryMeta?: () => void;
  /** Test seams. Defaults: the real mirror + OPFS cache, save dialog, and torrent builder. */
  deps?: FetchSetsDeps;
  zip?: ZipSeams;
  torrent?: TorrentSeams;
};

const maps = (n: number): string => `${n} ${n === 1 ? "map" : "maps"}`;

export function ExportPanel({
  pack,
  packKey,
  getMeta,
  magnets,
  torrentLinks,
  onRetryMeta,
  deps,
  zip,
  torrent,
}: ExportPanelProps) {
  const [choices, setChoices] = useDownloadChoices();
  const downloads = usePackDownloads({ pack, packKey, getMeta, deps, choices });
  const { loading, metaError, missing, setIds, failedIds, settled, started, running } = downloads;
  const [zipBusy, setZipBusy] = useState(false);
  const [torrentBusy, setTorrentBusy] = useState(false);
  const mirrorHeadingId = useId();
  const hasTorrentLinks = Boolean(torrentLinks);
  const sectionLevel = hasTorrentLinks ? 4 : 3;

  const changeChoices = (next: DownloadChoices) => {
    setChoices(next);
    // Different options give different files: drop the downloads, the zip and the torrent.
    downloads.reset();
  };

  let actions: ReactNode = null;
  if (loading) {
    actions = <Button disabled>Loading map info…</Button>;
  } else if (metaError && onRetryMeta) {
    actions = (
      <>
        <Button onClick={onRetryMeta}>Retry loading maps</Button>
        <p className="text-rose-300 text-sm">Some map info didn't load.</p>
      </>
    );
  } else if (metaError) {
    actions = (
      <>
        <Button disabled>Download maps</Button>
        <p className="text-rose-300 text-sm">
          Some map info didn't load. Retry loading maps first.
        </p>
      </>
    );
  } else if (setIds.length === 0) {
    actions = (
      <p className="text-c3 text-sm">
        None of these maps are on the mirror, so there's nothing to download.
      </p>
    );
  } else if (running) {
    actions = (
      <Button variant="secondary" onClick={downloads.cancel}>
        Cancel
      </Button>
    );
  } else if (settled && failedIds.length > 0) {
    actions = <Button onClick={downloads.retryFailed}>Retry failed</Button>;
  } else if (!settled) {
    actions = <Button onClick={downloads.downloadRemaining}>Download maps</Button>;
  }

  const plan = settled && !running && !loading && !metaError ? downloads.plan() : null;

  return (
    <Card title="Download">
      <div className="flex flex-col gap-4">
        {hasTorrentLinks ? torrentLinks : null}
        {/* Always this element, so the card gaining a Torrent section keeps the flow's state. */}
        <section
          aria-labelledby={hasTorrentLinks ? mirrorHeadingId : undefined}
          className={cn("flex flex-col gap-4", hasTorrentLinks && "border-b3 border-t pt-4")}
        >
          {hasTorrentLinks ? (
            <h3 id={mirrorHeadingId} className="font-bold text-c1">
              From the mirror
            </h3>
          ) : null}
          <p className="text-c3 text-sm">
            Maps download 4 at a time and stay cached in this browser, so the next download is
            quick.
          </p>
          {missing > 0 ? (
            <p className="text-amber-300 text-sm">
              {missing === 1 ? "1 map wasn't" : `${missing} maps weren't`} found on the mirror and
              will be left out.
            </p>
          ) : null}
          {started ? (
            <DownloadProgress rows={downloads.rows} statuses={downloads.statuses} />
          ) : null}
          {setIds.length > 0 && !metaError ? (
            <DownloadOptions
              choices={choices}
              onChange={changeChoices}
              disabled={running || zipBusy || torrentBusy}
            />
          ) : null}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          {plan && downloads.backgroundsKeptSlots > 0 ? (
            <p className="text-amber-300 text-sm">
              {`Couldn't remove backgrounds from ${maps(downloads.backgroundsKeptSlots)}. They're included as downloaded.`}
            </p>
          ) : null}
          {plan ? (
            <div className="grid gap-6 border-b3 border-t pt-4 sm:grid-cols-2">
              <ZipExport
                key={plan.packTxt}
                input={{ plan, blobs: downloads.blobs }}
                failedSlots={downloads.failedSlots}
                headingLevel={sectionLevel}
                onBusyChange={setZipBusy}
                {...zip}
              />
              <TorrentExport
                key={plan.packTxt}
                input={{ plan, blobs: downloads.blobs, packKey }}
                failedSlots={downloads.failedSlots}
                headingLevel={sectionLevel}
                magnets={magnets}
                onBusyChange={setTorrentBusy}
                {...torrent}
              />
            </div>
          ) : null}
        </section>
      </div>
    </Card>
  );
}

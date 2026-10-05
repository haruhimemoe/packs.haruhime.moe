/**
 * @file src/components/export/TorrentExport.tsx
 * @desc The Download card's torrent section: fingerprint the downloaded files into a .torrent and a
 *       magnet link (in this browser), with progress and Cancel. The made torrent's controls are
 *       TorrentMadePanel.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import { Button, Notice, Text } from "@haruhimemoe/ui";
import { useEffect, useId, useRef, useState } from "react";
import { type MagnetTarget, TorrentMadePanel } from "@/components/export/TorrentMadePanel";
import {
  type BuildOptions,
  type BuiltTorrent,
  canHashInBrowser,
} from "@/lib/torrent/build-torrent";
import {
  makePackTorrent,
  type PackTorrentInput,
  saveTorrentFile,
} from "@/lib/torrent/pack-torrent";
import type { ArchivePlan } from "@/utils/pack-archive";
import { countOf } from "@/utils/text";

export type TorrentExportProps = {
  input: PackTorrentInput;
  /** Slots left out because their set failed to download. */
  failedSlots: number;
  /** 4 when the card puts the mirror flow under its own h3 ("From the mirror"). Default 3. */
  headingLevel?: 3 | 4;
  /** Only for the owner of a saved pack. */
  magnets?: MagnetTarget;
  /** Told true while the torrent is being made and false after; the card locks its options. */
  onBusyChange?: (busy: boolean) => void;
  /** Test seams. Defaults: the real builder, a normal download, crypto.subtle detection. */
  make?: (input: PackTorrentInput, options: BuildOptions) => Promise<BuiltTorrent>;
  saveFile?: (built: BuiltTorrent, plan: ArchivePlan) => void;
  canHash?: boolean;
};

export type TorrentSeams = Pick<TorrentExportProps, "make" | "saveFile" | "canHash">;

type State =
  | { phase: "idle" }
  | { phase: "making"; percent: number }
  | { phase: "made"; built: BuiltTorrent }
  | { phase: "error" };

/**
 * @function TorrentExport
 * @param props {TorrentExportProps} the pack's files and plan, the slots left out, the heading
 *        level, the owner's magnet links, a busy callback, and test seams
 * @returns {JSX.Element} the Torrent file section
 */
export function TorrentExport({
  input,
  failedSlots,
  headingLevel = 3,
  magnets,
  onBusyChange,
  make = makePackTorrent,
  saveFile = saveTorrentFile,
  canHash = canHashInBrowser(),
}: TorrentExportProps) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const headingId = useId();
  const Heading = headingLevel === 4 ? "h4" : "h3";

  useEffect(() => () => controllerRef.current?.abort(), []);
  const making = state.phase === "making";
  useEffect(() => {
    onBusyChange?.(making);
  }, [making, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const start = () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: "making", percent: 0 });
    const live = () => !controller.signal.aborted;
    make(input, {
      signal: controller.signal,
      onProgress: (hashed, total) => {
        if (live()) {
          setState({
            phase: "making",
            percent: total === 0 ? 100 : Math.floor((hashed / total) * 100),
          });
        }
      },
    }).then(
      (built) => {
        if (live()) setState({ phase: "made", built });
      },
      () => {
        if (live()) setState({ phase: "error" });
      },
    );
  };

  const cancel = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState({ phase: "idle" });
  };

  const made = state.phase === "made" ? state.built : null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <Heading id={headingId} className="font-bold text-c1">
        Torrent file
      </Heading>
      <Text tone="muted">
        The same files as a .torrent and a magnet link, for torrent apps like qBittorrent.
      </Text>
      {canHash ? null : <Text tone="warning">Your browser can't make torrents on this page.</Text>}

      {made ? (
        <TorrentMadePanel
          built={made}
          folder={input.plan.folder}
          onSave={() => saveFile(made, input.plan)}
          magnets={magnets}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {state.phase === "making" ? (
            <>
              <Text
                as="div"
                role="progressbar"
                aria-label="Making torrent"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={state.percent}
                tone="muted"
              >
                {`Making torrent… ${state.percent}%`}
              </Text>
              <Button variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={start} disabled={!canHash}>
              {failedSlots > 0
                ? `Make torrent without ${countOf(failedSlots, "map")}`
                : "Make torrent"}
            </Button>
          )}
        </div>
      )}
      {state.phase === "error" ? (
        <Notice tone="error" live className="font-bold">
          Couldn't make the torrent. Try again.
        </Notice>
      ) : null}
    </section>
  );
}

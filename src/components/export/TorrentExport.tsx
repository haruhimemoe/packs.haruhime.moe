/**
 * @file src/components/export/TorrentExport.tsx
 * @desc The Download card's torrent section: fingerprint the downloaded files into a .torrent and a
 *       magnet link (in this browser), explain seeding, and let a saved pack's owner list the link.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { Button, TextInput } from "@haruhimemoe/ui";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { PacksApiError } from "@/lib/packs-api";
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
import { infohashOf } from "@/utils/magnet";
import type { ArchivePlan } from "@/utils/pack-archive";

/** A saved pack's magnet links, and how its owner adds one. */
export type MagnetTarget = {
  added: readonly string[];
  add: (magnet: string) => Promise<void>;
};

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

type AddState = { phase: "idle" } | { phase: "adding" } | { phase: "error"; message: string };

const maps = (n: number): string => `${n} ${n === 1 ? "map" : "maps"}`;

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
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  const [adding, setAdding] = useState<AddState>({ phase: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const headingId = useId();
  const Heading = headingLevel === 4 ? "h4" : "h3";
  const magnetId = useId();

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
    setCopied(null);
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

  const copy = async (magnet: string) => {
    try {
      await navigator.clipboard.writeText(magnet);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  };

  const add = async (target: MagnetTarget, magnet: string) => {
    setAdding({ phase: "adding" });
    try {
      await target.add(magnet);
      setAdding({ phase: "idle" });
    } catch (cause) {
      setAdding({
        phase: "error",
        message:
          cause instanceof PacksApiError
            ? cause.message
            : "Couldn't add the magnet link. Try again.",
      });
    }
  };

  const made = state.phase === "made" ? state.built : null;
  const alreadyAdded =
    made !== null && (magnets?.added ?? []).some((url) => infohashOf(url) === made.infoHash);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <Heading id={headingId} className="font-bold text-c1">
        Torrent file
      </Heading>
      <p className="text-c3 text-sm">
        The same files as a .torrent and a magnet link, for torrent apps like qBittorrent.
      </p>
      {canHash ? null : (
        <p className="text-amber-300 text-sm">Your browser can't make torrents on this page.</p>
      )}

      {made ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => saveFile(made, input.plan)}>Save .torrent</Button>
          </div>
          <TextInput
            id={magnetId}
            label="Magnet link"
            wrapperClassName="gap-2"
            readOnly
            value={made.magnet}
            onFocus={(event) => event.currentTarget.select()}
            className="font-mono"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => copy(made.magnet)}>
              Copy magnet link
            </Button>
            {magnets ? (
              <Button
                variant="secondary"
                onClick={() => add(magnets, made.magnet)}
                disabled={alreadyAdded || adding.phase === "adding"}
              >
                {alreadyAdded
                  ? "Magnet link added"
                  : adding.phase === "adding"
                    ? "Adding…"
                    : "Add magnet link to this pack"}
              </Button>
            ) : null}
            <output className="text-c3 text-sm">
              {copied === "copied"
                ? "Magnet link copied."
                : copied === "failed"
                  ? "Couldn't copy. Select the link and copy it by hand."
                  : ""}
            </output>
          </div>
          {adding.phase === "error" ? (
            <p role="alert" className="font-bold text-rose-300 text-sm">
              {adding.message}
            </p>
          ) : null}
          <p className="text-c3 text-sm">
            A torrent only works while someone seeds it. Save the .zip too, unzip it, then open the
            .torrent in qBittorrent and set its save location to the folder that holds “
            {input.plan.folder}”. It checks the files and starts seeding.{" "}
            <Link href="/guide/seed-a-torrent" className="text-h1 underline hover:text-c1">
              Seeding guide
            </Link>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {state.phase === "making" ? (
            <>
              <div
                role="progressbar"
                aria-label="Making torrent"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={state.percent}
                className="text-c3 text-sm"
              >
                {`Making torrent… ${state.percent}%`}
              </div>
              <Button variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={start} disabled={!canHash}>
              {failedSlots > 0 ? `Make torrent without ${maps(failedSlots)}` : "Make torrent"}
            </Button>
          )}
        </div>
      )}
      {state.phase === "error" ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          Couldn't make the torrent. Try again.
        </p>
      ) : null}
    </section>
  );
}

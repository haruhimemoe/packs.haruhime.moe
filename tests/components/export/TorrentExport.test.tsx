/**
 * @file tests/components/export/TorrentExport.test.tsx
 * @desc Torrent section with a fake builder: progress, save, magnet copy, cancel, failure, no
 *       crypto.subtle, unmount, and the owner's "add to this pack".
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TorrentExport, type TorrentExportProps } from "@/components/export/TorrentExport";
import { PacksApiError } from "@/lib/packs-api";
import type { BuildOptions, BuiltTorrent } from "@/lib/torrent/build-torrent";
import type { PackTorrentInput } from "@/lib/torrent/pack-torrent";
import type { ArchivePlan } from "@/utils/pack-archive";

const HASH = "d63ba49c4cbf76ee46bfc94476183f1710de7d09";
const BUILT: BuiltTorrent = {
  torrent: new Uint8Array([1, 2]),
  infoHash: HASH,
  magnet: `magnet:?xt=urn:btih:${HASH}&dn=SPC%20Quals`,
  totalBytes: 2,
  pieceLength: 16_384,
};
const PLAN: ArchivePlan = {
  folder: "SPC Quals",
  zipName: "SPC Quals.zip",
  files: [
    {
      position: 1,
      slot: { mod: "NM", index: 1, beatmapId: 101 },
      setId: 10,
      path: "01 NM1 - Artist - Title.osz",
    },
  ],
  skipped: [],
  packTxt: "SPC Quals\n",
};
const INPUT: PackTorrentInput = {
  plan: PLAN,
  blobs: new Map([[10, new Blob(["osz"])]]),
  packKey: "pk1.test",
};

type Make = NonNullable<TorrentExportProps["make"]>;

/** A make() that stays pending until aborted, recording the signal it got. */
const hangingMake = () => {
  const seen: { signal?: AbortSignal } = {};
  const make: Make = (_input: PackTorrentInput, options: BuildOptions) => {
    seen.signal = options.signal;
    return new Promise<BuiltTorrent>((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(options.signal?.reason));
    });
  };
  return { make, seen };
};

const renderTorrent = (props: Partial<TorrentExportProps> = {}) => {
  const user = userEvent.setup();
  const saveFile = vi.fn();
  const make: Make = props.make ?? vi.fn(async () => BUILT);
  const view = render(
    <TorrentExport
      input={INPUT}
      failedSlots={0}
      make={make}
      saveFile={saveFile}
      canHash
      {...props}
    />,
  );
  return { ...view, make, saveFile, user };
};

describe("TorrentExport", () => {
  it("makes a torrent with progress, then offers the file and the magnet link", async () => {
    let finish: (built: BuiltTorrent) => void = () => undefined;
    const make = vi.fn((_input: PackTorrentInput, options: BuildOptions) => {
      options.onProgress?.(42, 100);
      return new Promise<BuiltTorrent>((resolve) => {
        finish = resolve;
      });
    });
    const { user, saveFile } = renderTorrent({ make });
    await user.click(screen.getByRole("button", { name: "Make torrent" }));
    expect(await screen.findByText("Making torrent… 42%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Making torrent" })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    // Progress isn't a live region: screen readers aren't read every percent.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(make).toHaveBeenCalledWith(
      INPUT,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    finish(BUILT);
    await user.click(await screen.findByRole("button", { name: "Save .torrent" }));
    expect(saveFile).toHaveBeenCalledWith(BUILT, PLAN);
    expect(screen.getByLabelText("Magnet link")).toHaveValue(BUILT.magnet);
    expect(screen.getByText(/only works while someone seeds it/)).toHaveTextContent(
      "set its save location to the folder that holds “SPC Quals”",
    );
    expect(screen.getByRole("link", { name: "Seeding guide" })).toHaveAttribute(
      "href",
      "/guide/seed-a-torrent",
    );
  });

  it("copies the magnet link", async () => {
    const { user } = renderTorrent();
    await user.click(screen.getByRole("button", { name: "Make torrent" }));
    await user.click(await screen.findByRole("button", { name: "Copy magnet link" }));
    expect(await navigator.clipboard.readText()).toBe(BUILT.magnet);
    expect(screen.getByText("Magnet link copied.")).toBeInTheDocument();
  });

  it("names the maps it leaves out", () => {
    renderTorrent({ failedSlots: 2 });
    expect(screen.getByRole("button", { name: "Make torrent without 2 maps" })).toBeEnabled();
  });

  it("cancels a torrent in progress without an error", async () => {
    const { make, seen } = hangingMake();
    const { user } = renderTorrent({ make });
    await user.click(screen.getByRole("button", { name: "Make torrent" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(seen.signal?.aborted).toBe(true);
    expect(screen.getByRole("button", { name: "Make torrent" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stops hashing when it unmounts", async () => {
    const { make, seen } = hangingMake();
    const { user, unmount } = renderTorrent({ make });
    await user.click(screen.getByRole("button", { name: "Make torrent" }));
    unmount();
    expect(seen.signal?.aborted).toBe(true);
  });

  it("says so when making the torrent fails", async () => {
    const { user } = renderTorrent({
      make: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    await user.click(screen.getByRole("button", { name: "Make torrent" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't make the torrent. Try again.",
    );
    expect(screen.getByRole("button", { name: "Make torrent" })).toBeEnabled();
  });

  it("explains when this page can't hash", () => {
    renderTorrent({ canHash: false });
    expect(screen.getByRole("button", { name: "Make torrent" })).toBeDisabled();
    expect(screen.getByText("Your browser can't make torrents on this page.")).toBeInTheDocument();
  });

  it("offers no add button to people who don't own the pack", async () => {
    const { user } = renderTorrent();
    await user.click(screen.getByRole("button", { name: "Make torrent" }));
    await screen.findByRole("button", { name: "Save .torrent" });
    expect(screen.queryByRole("button", { name: /Add magnet link/ })).not.toBeInTheDocument();
  });

  it("lets the owner add the magnet link, once", async () => {
    const add = vi.fn(async (_url: string) => undefined);
    const { user, rerender, make, saveFile } = renderTorrent({ magnets: { added: [], add } });
    await user.click(screen.getByRole("button", { name: "Make torrent" }));
    await user.click(await screen.findByRole("button", { name: "Add magnet link to this pack" }));
    expect(add).toHaveBeenCalledWith(BUILT.magnet);
    rerender(
      <TorrentExport
        input={INPUT}
        failedSlots={0}
        make={make}
        saveFile={saveFile}
        canHash
        magnets={{ added: [`magnet:?xt=urn:btih:${HASH.toUpperCase()}`], add }}
      />,
    );
    expect(screen.getByRole("button", { name: "Magnet link added" })).toBeDisabled();
  });

  it("shows the server's message when adding fails", async () => {
    const add = vi.fn(async () => {
      throw new PacksApiError("A pack can list 10 magnet links. Remove one first.", 409);
    });
    const { user } = renderTorrent({ magnets: { added: [], add } });
    await user.click(screen.getByRole("button", { name: "Make torrent" }));
    await user.click(await screen.findByRole("button", { name: "Add magnet link to this pack" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A pack can list 10 magnet links. Remove one first.",
    );
  });

  it("names its section so it doesn't clash with the pack's Torrent section", () => {
    renderTorrent();
    expect(screen.getByRole("region", { name: "Torrent file" })).toBeInTheDocument();
  });
});

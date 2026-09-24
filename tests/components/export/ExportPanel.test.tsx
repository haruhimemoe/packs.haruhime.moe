/**
 * @file tests/components/export/ExportPanel.test.tsx
 * @desc Download card with a fake mirror and fake saves: wait for metadata, download each set
 *       once, then the zip section (save, missing maps, failed sets with retry and partial save,
 *       cancelled dialog, big-zip warning); a saved pack's Torrent section first when it has links;
 *       retrying map info from the card.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportPanel } from "@/components/export/ExportPanel";
import { MagnetLinks } from "@/components/pack/MagnetLinks";
import type { MetaState } from "@/hooks/beatmapMetaState";
import type { FetchSetsDeps } from "@/lib/downloads/fetch-sets";
import { HinaiError } from "@/lib/mirror";
import type { BuildOptions, BuiltTorrent } from "@/lib/torrent/build-torrent";
import type { PackTorrentInput } from "@/lib/torrent/pack-torrent";
import type { PackZipInput } from "@/lib/zip/pack-zip";
import type { SaveOutcome } from "@/lib/zip/save-zip";
import type { Pool } from "@/schemas/pack";
import type { PackExport } from "@/schemas/pack-export";

beforeEach(() => {
  localStorage.clear();
});

const meta = (beatmapId: number, beatmapsetId: number): BeatmapMeta => ({
  beatmapId,
  beatmapsetId,
  mode: "osu",
  title: `Title ${beatmapId}`,
  artist: "Artist",
  version: "Insane",
  creator: "Mapper",
  creatorId: 1,
  cs: 4,
  ar: 9,
  od: 8,
  hp: 6,
  bpm: 180,
  lengthSeconds: 120,
  starRating: 5,
  checksum: null,
});

// NM1 and TB1 share set 10, so there are two sets to download for three slots.
const PACK: Pool = {
  name: "SPC Quals",
  slots: [
    { mod: "NM", index: 1, beatmapId: 101 },
    { mod: "NM", index: 2, beatmapId: 102 },
    { mod: "TB", index: 1, beatmapId: 103 },
  ],
};
const found = (id: number, setId: number): MetaState => ({
  status: "found",
  meta: meta(id, setId),
});
const ALL_FOUND: Record<number, MetaState> = {
  101: found(101, 10),
  102: found(102, 20),
  103: found(103, 10),
};

const HASH = "a".repeat(40);
const BUILT: BuiltTorrent = {
  torrent: new Uint8Array([1]),
  infoHash: HASH,
  magnet: `magnet:?xt=urn:btih:${HASH}&dn=SPC%20Quals`,
  totalBytes: 1,
  pieceLength: 16_384,
};

type DepsOptions = { failFirst?: number[]; hang?: boolean; stripFails?: number[] };

const makeDeps = ({ failFirst = [], hang = false, stripFails = [] }: DepsOptions = {}) => {
  const downloads: number[] = [];
  const videoRequests: boolean[] = [];
  const stripped: number[] = [];
  const failing = new Set(failFirst);
  const deps: FetchSetsDeps = {
    downloader: {
      getAvailability: async () => ({ downloadable: true, reason: null }),
      downloadSet: (setId, { signal, video = false } = {}) => {
        downloads.push(setId);
        videoRequests.push(video);
        if (hang) {
          return new Promise<Blob>((_resolve, reject) => {
            signal?.addEventListener("abort", () => reject(signal.reason));
          });
        }
        if (failing.delete(setId)) {
          return Promise.reject(
            new HinaiError("not_found", "The mirror doesn't have this beatmapset.", {
              status: 404,
            }),
          );
        }
        return Promise.resolve(new Blob([`set ${setId}`]));
      },
    },
    cache: {
      get: async () => null,
      put: async (_setId, blob) => blob,
      clear: async () => undefined,
    },
    stripBackgrounds: async (blob) => {
      const setId = Number((await blob.text()).replace("set ", ""));
      stripped.push(setId);
      if (stripFails.includes(setId)) throw new Error("bad zip");
      return new Blob([`set ${setId} without backgrounds`]);
    },
    sleep: async () => undefined,
  };
  return { deps, downloads, videoRequests, stripped };
};

const setup = (
  options: DepsOptions & {
    metas?: Record<number, MetaState>;
    outcome?: SaveOutcome;
    canStream?: boolean;
    blobWarnBytes?: number;
    onRetryMeta?: () => void;
    /** The zip save / torrent build never finishes, to catch the card mid-task. */
    saveHangs?: boolean;
    makeHangs?: boolean;
  } = {},
) => {
  const { deps, downloads, videoRequests, stripped } = makeDeps(options);
  const save = vi.fn(
    (_input: PackZipInput): Promise<SaveOutcome> =>
      options.saveHangs
        ? new Promise(() => undefined)
        : Promise.resolve(options.outcome ?? "streamed"),
  );
  const make = vi.fn(
    (_input: PackTorrentInput, _options: BuildOptions): Promise<BuiltTorrent> =>
      options.makeHangs ? new Promise(() => undefined) : Promise.resolve(BUILT),
  );
  const metas = options.metas ?? ALL_FOUND;
  const panel = (packKey: string) => (
    <ExportPanel
      pack={PACK}
      packKey={packKey}
      getMeta={(id) => metas[id] ?? { status: "loading" }}
      onRetryMeta={options.onRetryMeta}
      deps={deps}
      zip={{ save, canStream: options.canStream ?? true, blobWarnBytes: options.blobWarnBytes }}
      torrent={{ make, saveFile: vi.fn(), canHash: true }}
    />
  );
  const user = userEvent.setup();
  const view = render(panel("pk1.test"));
  return {
    save,
    make,
    downloads,
    videoRequests,
    stripped,
    user,
    rekey: (packKey: string) => view.rerender(panel(packKey)),
  };
};

const openOptions = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /^Download options/ }));
};

describe("ExportPanel", () => {
  it("is the Download card", () => {
    setup();
    expect(screen.getByRole("heading", { level: 2, name: "Download" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Download" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Export" })).not.toBeInTheDocument();
  });

  it("has no Torrent section or mirror heading without magnet links", async () => {
    const { user } = setup();
    expect(screen.queryByRole("region", { name: "Torrent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "From the mirror" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    expect(await screen.findByRole("heading", { level: 3, name: "Zip" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Torrent file" })).toBeInTheDocument();
  });

  it("waits for map info before offering downloads", () => {
    setup({ metas: {} });
    expect(screen.getByRole("button", { name: "Loading map info…" })).toBeDisabled();
  });

  it("says the maps stay cached so the next download is quick", () => {
    setup();
    expect(
      screen.getByText(
        "Maps download 4 at a time and stay cached in this browser, so the next download is quick.",
      ),
    ).toBeInTheDocument();
  });

  describe("when map info fails to load", () => {
    const failed: Record<number, MetaState> = {
      ...ALL_FOUND,
      102: { status: "error", message: "Couldn't reach the beatmap mirror." },
    };

    it("offers Retry loading maps in the card", async () => {
      const onRetryMeta = vi.fn();
      const { user } = setup({ metas: failed, onRetryMeta });
      const card = screen.getByRole("region", { name: "Download" });
      expect(within(card).getByText("Some map info didn't load.")).toBeInTheDocument();
      expect(within(card).queryByRole("button", { name: "Download maps" })).toBeNull();
      await user.click(within(card).getByRole("button", { name: "Retry loading maps" }));
      expect(onRetryMeta).toHaveBeenCalledOnce();
    });

    it("points at the page's retry without a handler", () => {
      setup({ metas: failed });
      expect(screen.getByRole("button", { name: "Download maps" })).toBeDisabled();
      expect(
        screen.getByText("Some map info didn't load. Retry loading maps first."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry loading maps" })).toBeNull();
    });
  });

  it("downloads each set once, then saves a zip with every slot", async () => {
    const { save, downloads, user } = setup();
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await user.click(await screen.findByRole("button", { name: "Save .zip" }));
    expect(downloads).toEqual([10, 20]);
    expect(save).toHaveBeenCalledOnce();
    const input = save.mock.calls[0]?.[0] as PackZipInput;
    expect(input.plan.files.map((f) => f.path)).toEqual([
      "01 NM1 - Artist - Title 101.osz",
      "02 NM2 - Artist - Title 102.osz",
      "03 TB1 - Artist - Title 103.osz",
    ]);
    expect([...input.blobs.keys()].sort()).toEqual([10, 20]);
    expect(await screen.findByText("Zip saved.")).toBeInTheDocument();
  });

  it("leaves out maps the mirror doesn't know and says so", async () => {
    const { save, user } = setup({ metas: { ...ALL_FOUND, 102: { status: "missing" } } });
    expect(
      screen.getByText("1 map wasn't found on the mirror and will be left out."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await user.click(await screen.findByRole("button", { name: "Save .zip" }));
    expect(save.mock.calls[0]?.[0].plan.skipped).toHaveLength(1);
  });

  it("offers a retry and a partial save when a set fails", async () => {
    const { save, user } = setup({ failFirst: [20] });
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    expect(await screen.findByText("The mirror doesn't have this beatmapset.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save .zip without 1 map" }));
    expect(save.mock.calls[0]?.[0].plan.skipped[0]?.reason).toBe("failed");
    await user.click(screen.getByRole("button", { name: "Retry failed" }));
    expect(await screen.findByRole("button", { name: "Save .zip" })).toBeEnabled();
  });

  it("shows nothing when the save dialog is cancelled", async () => {
    const { user } = setup({ outcome: "cancelled" });
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await user.click(await screen.findByRole("button", { name: "Save .zip" }));
    expect(screen.queryByText("Zip saved.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save .zip" })).toBeEnabled();
  });

  it("warns before building a huge zip in memory", async () => {
    const { user } = setup({ canStream: false, blobWarnBytes: 10 });
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    expect(await screen.findByText(/has to build it in memory/)).toBeInTheDocument();
  });

  it("doesn't warn when the browser can save straight to disk", async () => {
    const { user } = setup({ canStream: true, blobWarnBytes: 10 });
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await screen.findByRole("button", { name: "Save .zip" });
    expect(screen.queryByText(/has to build it in memory/)).not.toBeInTheDocument();
  });

  it("shows the zip section only once every set has downloaded", async () => {
    const { user } = setup();
    expect(screen.queryByRole("region", { name: "Zip" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    expect(await screen.findByRole("region", { name: "Zip" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download maps" })).not.toBeInTheDocument();
  });

  it("makes the torrent from the same plan as the zip, failures included", async () => {
    const { save, make, user } = setup({ failFirst: [20] });
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await user.click(await screen.findByRole("button", { name: "Save .zip without 1 map" }));
    await user.click(screen.getByRole("button", { name: "Make torrent without 1 map" }));
    expect(await screen.findByLabelText("Magnet link")).toHaveValue(BUILT.magnet);
    const zipped = save.mock.calls[0]?.[0] as PackZipInput;
    const torrent = make.mock.calls[0]?.[0] as PackTorrentInput;
    expect(torrent.plan).toEqual(zipped.plan);
    expect(torrent.plan.skipped.map((s) => s.reason)).toEqual(["failed"]);
    expect(torrent.blobs).toEqual(zipped.blobs);
    expect(torrent.packKey).toBe("pk1.test");
  });

  it("forgets a made torrent when the pack changes", async () => {
    const { user, rekey } = setup();
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await user.click(await screen.findByRole("button", { name: "Make torrent" }));
    expect(await screen.findByLabelText("Magnet link")).toBeInTheDocument();
    rekey("pk1.other");
    expect(screen.queryByLabelText("Magnet link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make torrent" })).toBeEnabled();
  });

  it("forgets a made torrent when failed maps are retried", async () => {
    const { user } = setup({ failFirst: [20] });
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await user.click(await screen.findByRole("button", { name: "Make torrent without 1 map" }));
    expect(await screen.findByLabelText("Magnet link")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry failed" }));
    expect(await screen.findByRole("button", { name: "Make torrent" })).toBeEnabled();
    expect(screen.queryByLabelText("Magnet link")).not.toBeInTheDocument();
  });
});

describe("ExportPanel download options", () => {
  it("starts closed, showing the default choice", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Download options: no videos, backgrounds" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the choice saved in this browser", async () => {
    localStorage.setItem(
      "packs-download-options",
      JSON.stringify({ videos: true, backgrounds: false }),
    );
    setup();
    expect(
      await screen.findByRole("button", { name: "Download options: videos, no backgrounds" }),
    ).toBeInTheDocument();
  });

  it("asks the mirror for videos once they're included, and remembers that", async () => {
    const { user, videoRequests } = setup();
    await openOptions(user);
    await user.click(screen.getByRole("checkbox", { name: /Include videos/ }));
    expect(JSON.parse(localStorage.getItem("packs-download-options") ?? "null")).toEqual({
      videos: true,
      backgrounds: true,
    });
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await screen.findByRole("button", { name: "Save .zip" });
    expect(videoRequests).toEqual([true, true]);
  });

  it("removes backgrounds and says so in pack.txt", async () => {
    const { user, save, stripped } = setup();
    await openOptions(user);
    await user.click(screen.getByRole("checkbox", { name: /Include backgrounds/ }));
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await user.click(await screen.findByRole("button", { name: "Save .zip" }));
    expect([...stripped].sort()).toEqual([10, 20]);
    const input = save.mock.calls[0]?.[0] as PackZipInput;
    expect(await input.blobs.get(10)?.text()).toBe("set 10 without backgrounds");
    expect(input.plan.packTxt).toContain("Videos: not included. Backgrounds: removed.");
  });

  it("says which maps kept their backgrounds when removal fails", async () => {
    // Set 10 holds two of the three maps.
    const { user } = setup({ stripFails: [10] });
    await openOptions(user);
    await user.click(screen.getByRole("checkbox", { name: /Include backgrounds/ }));
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    expect(
      await screen.findByText(
        "Couldn't remove backgrounds from 2 maps. They're included as downloaded.",
      ),
    ).toBeInTheDocument();
  });

  it("clears the downloads, the zip and the made torrent when an option changes", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await user.click(await screen.findByRole("button", { name: "Make torrent" }));
    expect(await screen.findByLabelText("Magnet link")).toBeInTheDocument();
    await openOptions(user);
    await user.click(screen.getByRole("checkbox", { name: /Include videos/ }));
    expect(screen.queryByLabelText("Magnet link")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Zip" })).not.toBeInTheDocument();
    expect(screen.queryByText(/sets ready/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download maps" })).toBeEnabled();
  });

  it("locks the options while maps are downloading", async () => {
    const { user } = setup({ hang: true });
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await openOptions(user);
    expect(screen.getByRole("checkbox", { name: /Include videos/ })).toBeDisabled();
    expect(
      screen.getByText("You can change these once the download, zip or torrent is done."),
    ).toBeInTheDocument();
  });

  it("locks the options while the zip is saving", async () => {
    const { user } = setup({ saveHangs: true });
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await user.click(await screen.findByRole("button", { name: "Save .zip" }));
    await openOptions(user);
    expect(screen.getByRole("checkbox", { name: /Include backgrounds/ })).toBeDisabled();
    expect(
      screen.getByText("You can change these once the download, zip or torrent is done."),
    ).toBeInTheDocument();
  });

  it("locks the options while the torrent is being made, and unlocks when it stops", async () => {
    const { user } = setup({ makeHangs: true });
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await user.click(await screen.findByRole("button", { name: "Make torrent" }));
    await openOptions(user);
    expect(screen.getByRole("checkbox", { name: /Include videos/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("checkbox", { name: /Include videos/ })).toBeEnabled();
  });
});

const HASH_B = "b".repeat(40);
const LISTED: PackExport = {
  kind: "magnet",
  url: `magnet:?xt=urn:btih:${HASH_B}&dn=SPC%20Quals`,
  createdAt: "2026-09-22T23:30:00.000Z",
};

/** What /p/[slug] does: the owner's recorded links go first, and adding one lists it there. */
function SavedPackPanel({ initial, deps }: { initial: PackExport[]; deps: FetchSetsDeps }) {
  const [exports, setExports] = useState<readonly PackExport[]>(initial);
  return (
    <ExportPanel
      pack={PACK}
      packKey="pk1.test"
      getMeta={(id) => ALL_FOUND[id] ?? { status: "loading" }}
      deps={deps}
      zip={{ save: vi.fn(async () => "streamed" as const), canStream: true }}
      torrent={{ make: async () => BUILT, saveFile: vi.fn(), canHash: true }}
      magnets={{
        added: exports.map((entry) => entry.url),
        add: async (url) =>
          setExports((list) => [
            ...list,
            { kind: "magnet", url, createdAt: "2026-09-23T10:00:00.000Z" },
          ]),
      }}
      torrentLinks={
        exports.length > 0 ? (
          <MagnetLinks exports={exports} onRemove={async () => undefined} />
        ) : undefined
      }
    />
  );
}

describe("ExportPanel with a saved pack's magnet links", () => {
  it("shows the Torrent section first, then the mirror flow under its own heading", async () => {
    const user = userEvent.setup();
    render(<SavedPackPanel initial={[LISTED]} deps={makeDeps().deps} />);
    const card = screen.getByRole("region", { name: "Download" });
    const torrent = within(card).getByRole("region", { name: "Torrent" });
    expect(within(torrent).getByRole("heading", { level: 3, name: "Torrent" })).toBeInTheDocument();
    expect(
      within(torrent).getByText(
        /Download with a torrent app\. It only works while someone seeds it\./,
      ),
    ).toBeInTheDocument();
    expect(
      within(torrent).getByRole("link", { name: "How to download with a torrent" }),
    ).toHaveAttribute("href", "/guide/download-a-torrent");
    const mirror = within(card).getByRole("region", { name: "From the mirror" });
    expect(within(mirror).getByRole("heading", { level: 3 })).toHaveTextContent("From the mirror");
    // Torrent section, then the mirror heading, then the mirror flow.
    expect(torrent.compareDocumentPosition(mirror) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const download = within(mirror).getByRole("button", { name: "Download maps" });
    expect(within(torrent).queryByRole("button", { name: "Download maps" })).toBeNull();
    await user.click(download);
    expect(
      await within(mirror).findByRole("heading", { level: 4, name: "Zip" }),
    ).toBeInTheDocument();
    expect(
      within(mirror).getByRole("heading", { level: 4, name: "Torrent file" }),
    ).toBeInTheDocument();
  });

  it("lists a magnet the owner adds in the Torrent section, keeping the made torrent", async () => {
    const user = userEvent.setup();
    render(<SavedPackPanel initial={[]} deps={makeDeps().deps} />);
    expect(screen.queryByRole("region", { name: "Torrent" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download maps" }));
    await user.click(await screen.findByRole("button", { name: "Make torrent" }));
    await user.click(await screen.findByRole("button", { name: "Add magnet link to this pack" }));
    const torrent = await screen.findByRole("region", { name: "Torrent" });
    expect(
      within(torrent).getByRole("link", { name: "Open magnet link aaaaaaaa" }),
    ).toHaveAttribute("href", BUILT.magnet);
    expect(screen.getByRole("heading", { level: 3, name: "From the mirror" })).toBeInTheDocument();
    // The made torrent survives the card growing a Torrent section.
    expect(screen.getByLabelText("Magnet link")).toHaveValue(BUILT.magnet);
    expect(screen.getByRole("button", { name: "Magnet link added" })).toBeDisabled();
  });
});

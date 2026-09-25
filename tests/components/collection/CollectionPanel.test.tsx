/**
 * @file tests/components/collection/CollectionPanel.test.tsx
 * @desc The "Add to osu! collection" card: waiting for map info, pointing at the Download card's
 *       retry, the maps it leaves out and why, nothing to add, a whole osu!stable flow down to the
 *       downloaded bytes with no request and no storage on the way, and the pool changing under
 *       a loaded file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import { readCollectionDb } from "@haruhimemoe/osu/collections";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionPanel } from "@/components/collection/CollectionPanel";
import type { MetaState } from "@/hooks/beatmapMetaState";
import type { Pool } from "@/schemas/pack";
import {
  collectionFile,
  downloaded,
  foundWith,
  MD5_A,
  MD5_ABC,
  MD5_DIGEST,
  MD5_EMPTY,
  metaFrom,
  TV1_EMPTY,
  TV2_FARM,
} from "../../helpers/collections";

afterEach(() => {
  vi.restoreAllMocks();
});

const PACK: Pool = {
  name: "SPC Quals",
  slots: [
    { mod: "NM", index: 1, beatmapId: 101 },
    { mod: "NM", index: 2, beatmapId: 102 },
    { mod: "HD", index: 1, beatmapId: 103 },
    { mod: "TB", index: 1, beatmapId: 104 },
  ],
};
const READY: Record<number, MetaState> = {
  101: foundWith(101, MD5_A),
  102: foundWith(102, MD5_ABC),
  103: foundWith(103, null),
  104: { status: "missing" },
};

const card = () => screen.getByRole("region", { name: "Add to osu! collection" });

describe("CollectionPanel", () => {
  it("waits for map info", () => {
    render(<CollectionPanel pack={PACK} getMeta={metaFrom({})} download={vi.fn()} />);
    expect(within(card()).getByText("Loading map info…")).toBeInTheDocument();
  });

  it("points at the Download card when map info failed", () => {
    const getMeta = metaFrom({ ...READY, 102: { status: "error", message: "x" } });
    render(<CollectionPanel pack={PACK} getMeta={getMeta} download={vi.fn()} />);
    expect(
      within(card()).getByText(
        "Map info didn't load for 1 map. Retry loading maps in the Download card first.",
      ),
    ).toBeInTheDocument();
  });

  it("lists the maps it leaves out, and why", () => {
    render(<CollectionPanel pack={PACK} getMeta={metaFrom(READY)} download={vi.fn()} />);
    expect(
      within(card()).getByText("2 maps can't go in a collection and are left out:"),
    ).toBeInTheDocument();
    expect(
      within(card()).getByText("HD1 (beatmap 103): no checksum in its map info"),
    ).toBeInTheDocument();
    expect(
      within(card()).getByText("TB1 (beatmap 104): not found on the mirror or osu!"),
    ).toBeInTheDocument();
  });

  it("says when there's nothing to add", async () => {
    const user = userEvent.setup();
    const pack: Pool = { name: "Gone", slots: [{ mod: "NM", index: 1, beatmapId: 104 }] };
    render(<CollectionPanel pack={pack} getMeta={metaFrom(READY)} download={vi.fn()} />);
    expect(
      within(card()).getByText(
        "None of these maps can go in a collection, so there's nothing to add.",
      ),
    ).toBeInTheDocument();
    await user.upload(
      within(card()).getByLabelText("Your collection.db"),
      collectionFile(TV1_EMPTY),
    );
    expect(await within(card()).findByLabelText("Collection")).toBeInTheDocument();
    expect(within(card()).getByRole("button", { name: "Download collection.db" })).toBeDisabled();
  });

  it("adds the pack to a collection and downloads the whole file, with no request or storage", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const send = vi.spyOn(XMLHttpRequest.prototype, "send");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const user = userEvent.setup();
    const download = vi.fn();
    render(<CollectionPanel pack={PACK} getMeta={metaFrom(READY)} download={download} />);
    await user.upload(
      within(card()).getByLabelText("Your collection.db"),
      collectionFile(TV2_FARM),
    );
    await user.selectOptions(await within(card()).findByLabelText("Collection"), "Farm (2 maps)");
    expect(
      within(card()).getByText('Adds 1 map to "Farm". 1 is already in it.'),
    ).toBeInTheDocument();
    await user.click(within(card()).getByRole("button", { name: "Download collection.db" }));

    const { filename, bytes } = await downloaded(download);
    expect(filename).toBe("collection.db");
    expect(readCollectionDb(bytes)).toMatchObject({
      version: 20210520,
      collections: [{ name: "Farm", hashes: [MD5_EMPTY, MD5_A, MD5_ABC] }],
    });
    expect(
      within(card()).getByText('Downloaded collection.db with 1 map added to "Farm".'),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("follows the pool when it changes under a loaded file", async () => {
    const user = userEvent.setup();
    const download = vi.fn();
    const { rerender } = render(
      <CollectionPanel pack={PACK} getMeta={metaFrom(READY)} download={download} />,
    );
    await user.upload(
      within(card()).getByLabelText("Your collection.db"),
      collectionFile(TV1_EMPTY),
    );
    expect(
      await within(card()).findByText('Makes a new collection "SPC Quals" with 2 maps.'),
    ).toBeInTheDocument();

    const grown: Pool = {
      ...PACK,
      slots: [...PACK.slots, { mod: "DT", index: 1, beatmapId: 105 }],
    };
    rerender(<CollectionPanel pack={grown} getMeta={metaFrom(READY)} download={download} />);
    expect(within(card()).getByText("Waiting for map info…")).toBeInTheDocument();
    expect(within(card()).getByRole("button", { name: "Download collection.db" })).toBeDisabled();

    const withNewMap = metaFrom({ ...READY, 105: foundWith(105, MD5_DIGEST) });
    rerender(<CollectionPanel pack={grown} getMeta={withNewMap} download={download} />);
    expect(
      within(card()).getByText('Makes a new collection "SPC Quals" with 3 maps.'),
    ).toBeInTheDocument();
    await user.click(within(card()).getByRole("button", { name: "Download collection.db" }));
    expect(readCollectionDb((await downloaded(download)).bytes).collections).toEqual([
      { name: "SPC Quals", hashes: [MD5_A, MD5_ABC, MD5_DIGEST] },
    ]);
  });
});

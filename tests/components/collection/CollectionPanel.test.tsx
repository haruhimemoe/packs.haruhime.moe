/**
 * @file tests/components/collection/CollectionPanel.test.tsx
 * @desc The "Add to osu! collection" card: its link to the guide, waiting for map info, pointing
 *       at the Download card's retry, the maps it leaves out and why, nothing to add, a whole
 *       osu!stable flow down to the downloaded bytes with no request, beacon or storage
 *       (IndexedDB included) on the way, the pool changing under a loaded file, and the osu!lazer
 *       side: hidden until it's picked, the zip's name and files with none of those either, the
 *       name used exactly as typed (outer spaces warned about, with the warning read out as the
 *       field's description, empty refused, a name UTF-8 can't encode marked on the field as it's
 *       typed, with its code), a very long name clipped in the preview, a failed save, waiting for
 *       map info, and each side keeping its state when you switch.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sat Sep 26, 2026
 */

import { readCollectionDb } from "@haruhimemoe/osu/collections";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionPanel } from "@/components/collection/CollectionPanel";
import type { MetaState } from "@/hooks/beatmapMetaState";
import type { Pool } from "@/schemas/pack";
import { MAX_LABEL_LENGTH } from "@/utils/osu-collection";
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
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "sendBeacon");
});

/**
 * Spies on each way the card could send or keep the file, and returns a check that none was used.
 * jsdom has no IndexedDB or sendBeacon, so those two are stand-ins the card would reach if it
 * tried.
 */
const watchLeaks = () => {
  const openDb = vi.fn();
  const sendBeacon = vi.fn(() => true);
  vi.stubGlobal("indexedDB", { open: openDb });
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: sendBeacon });
  const spies = [
    vi.spyOn(globalThis, "fetch"),
    vi.spyOn(XMLHttpRequest.prototype, "send"),
    vi.spyOn(Storage.prototype, "setItem"),
    openDb,
    sendBeacon,
  ];
  return () => {
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  };
};

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
  it("links the guide", () => {
    render(<CollectionPanel pack={PACK} getMeta={metaFrom(READY)} download={vi.fn()} />);
    expect(within(card()).getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/guide/osu-collections",
    );
  });

  it("waits for map info", () => {
    render(<CollectionPanel pack={PACK} getMeta={metaFrom({})} download={vi.fn()} />);
    expect(within(card()).getByText("Loading map info…")).toBeInTheDocument();
  });

  it("points at the Download card when map info failed", async () => {
    const user = userEvent.setup();
    const getMeta = metaFrom({ ...READY, 102: { status: "error", message: "x" } });
    render(<CollectionPanel pack={PACK} getMeta={getMeta} download={vi.fn()} />);
    expect(
      within(card()).getByText(
        "Map info didn't load for 1 map. Retry loading maps in the Download card first.",
      ),
    ).toBeInTheDocument();
    await user.upload(
      within(card()).getByLabelText("Your collection.db"),
      collectionFile(TV1_EMPTY),
    );
    expect(
      await within(card()).findByText(
        `Some map info didn't load. Press "Retry loading maps" in the Download card, and the preview shows once it has.`,
      ),
    ).toBeInTheDocument();
    expect(within(card()).queryByText(/The preview shows once/)).not.toBeInTheDocument();
    expect(within(card()).queryByText(/Loading map info/)).not.toBeInTheDocument();
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
    const expectNoLeaks = watchLeaks();
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
    expectNoLeaks();
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
    expect(within(card()).getByText("Loading map info…")).toBeInTheDocument();
    expect(
      within(card()).getByText("The preview shows once every map's info has loaded."),
    ).toBeInTheDocument();
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

describe("CollectionPanel for osu!lazer", () => {
  const toLazer = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(within(card()).getByRole("radio", { name: /osu!lazer/ }));

  it("downloads a zip for lazer's setup wizard, with the pack's name and maps", async () => {
    const expectNoLeaks = watchLeaks();
    const user = userEvent.setup();
    const download = vi.fn();
    render(<CollectionPanel pack={PACK} getMeta={metaFrom(READY)} download={download} />);
    expect(within(card()).getByRole("radio", { name: /osu!stable/ })).toBeChecked();
    expect(
      within(card()).queryByRole("textbox", { name: "Collection name in osu!lazer" }),
    ).not.toBeInTheDocument();
    expect(
      within(card()).queryByRole("button", { name: "Download zip for osu!lazer" }),
    ).not.toBeInTheDocument();
    await toLazer(user);
    expect(
      within(card()).getByRole("textbox", { name: "Collection name in osu!lazer" }),
    ).toHaveValue("SPC Quals");
    expect(
      within(card()).getByText('Adds 2 maps to "SPC Quals". Maps already in it are skipped.'),
    ).toBeInTheDocument();
    expect(
      within(card()).getByText(
        'Untick Beatmaps, Scores and Skins, leave Collections ticked, and press "Import content from previous version".',
      ),
    ).toBeInTheDocument();
    expect(
      within(card()).getByText(
        "This works on desktop only. osu!lazer on Android and iOS can't import collections.",
      ),
    ).toBeInTheDocument();
    await user.click(within(card()).getByRole("button", { name: "Download zip for osu!lazer" }));

    const { filename, bytes } = await downloaded(download);
    expect(filename).toBe("SPC Quals collection.zip");
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(["collection.db", "osu!.import.cfg"]);
    expect(readCollectionDb(files["collection.db"] ?? new Uint8Array()).collections).toEqual([
      { name: "SPC Quals", hashes: [MD5_A, MD5_ABC] },
    ]);
    expect(
      within(card()).getByText(
        "Downloaded SPC Quals collection.zip. Follow the steps above to import it.",
      ),
    ).toBeInTheDocument();
    expectNoLeaks();
  });

  it("uses the name as typed, warns about outer spaces and refuses an empty one", async () => {
    const user = userEvent.setup();
    const download = vi.fn();
    render(<CollectionPanel pack={PACK} getMeta={metaFrom(READY)} download={download} />);
    await toLazer(user);
    const name = within(card()).getByLabelText("Collection name in osu!lazer");
    const button = within(card()).getByRole("button", { name: "Download zip for osu!lazer" });
    expect(name).not.toHaveAccessibleDescription(/starts or ends with a space/);
    await user.clear(name);
    expect(within(card()).getByText("Type a collection name.")).toBeInTheDocument();
    expect(button).toBeDisabled();
    await user.type(name, "   ");
    expect(button).toBeDisabled();
    await user.clear(name);
    await user.type(name, " Farm");
    expect(
      within(card()).getByText(
        "This name starts or ends with a space. lazer treats it as a different collection from the same name without the space.",
      ),
    ).toBeInTheDocument();
    expect(name).toHaveAccessibleDescription(
      /any other name makes a new collection\. This name starts or ends with a space\. lazer treats it as a different collection/,
    );
    await user.click(button);
    const files = unzipSync((await downloaded(download)).bytes);
    expect(readCollectionDb(files["collection.db"] ?? new Uint8Array()).collections[0]?.name).toBe(
      " Farm",
    );
  });

  it("marks a name UTF-8 can't encode as it's typed, with its code, and downloads nothing", async () => {
    const user = userEvent.setup();
    const download = vi.fn();
    render(<CollectionPanel pack={PACK} getMeta={metaFrom(READY)} download={download} />);
    await toLazer(user);
    const name = within(card()).getByLabelText("Collection name in osu!lazer");
    const button = within(card()).getByRole("button", { name: "Download zip for osu!lazer" });
    fireEvent.change(name, { target: { value: "Farm \uD800" } });
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription(
      /That name has a broken character, like half of an emoji \(invalid_name\)\.$/,
    );
    expect(button).toBeDisabled();
    expect(within(card()).queryByText(/^Adds /)).not.toBeInTheDocument();
    await user.click(button);
    expect(download).not.toHaveBeenCalled();

    // A whole emoji is fine.
    fireEvent.change(name, { target: { value: "Farm 🎵" } });
    expect(name).not.toHaveAttribute("aria-invalid");
    expect(within(card()).queryByRole("alert")).not.toBeInTheDocument();
    await user.click(button);
    const files = unzipSync((await downloaded(download)).bytes);
    expect(readCollectionDb(files["collection.db"] ?? new Uint8Array()).collections[0]?.name).toBe(
      "Farm 🎵",
    );
  });

  it("clips a very long name in the preview", async () => {
    const user = userEvent.setup();
    render(<CollectionPanel pack={PACK} getMeta={metaFrom(READY)} download={vi.fn()} />);
    await toLazer(user);
    const long = "L".repeat(MAX_LABEL_LENGTH + 20);
    fireEvent.change(within(card()).getByLabelText("Collection name in osu!lazer"), {
      target: { value: long },
    });
    const preview = within(card()).getByText(
      `Adds 2 maps to "${"L".repeat(MAX_LABEL_LENGTH)}…". Maps already in it are skipped.`,
    );
    expect(preview).toHaveClass("wrap-anywhere");
  });

  it("says when the zip can't be saved, and a second try clears it", async () => {
    const user = userEvent.setup();
    const download = vi.fn().mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    render(<CollectionPanel pack={PACK} getMeta={metaFrom(READY)} download={download} />);
    await toLazer(user);
    const button = within(card()).getByRole("button", { name: "Download zip for osu!lazer" });
    await user.click(button);
    expect(within(card()).getByRole("alert")).toHaveTextContent(
      "Couldn't save the zip. Try again.",
    );
    expect(button).toBeEnabled();

    await user.click(button);
    expect(within(card()).queryByRole("alert")).not.toBeInTheDocument();
    expect(download).toHaveBeenCalledTimes(2);
    expect((await downloaded(download, 1)).filename).toBe("SPC Quals collection.zip");
  });

  it("waits for map info before it offers the zip", async () => {
    const user = userEvent.setup();
    render(<CollectionPanel pack={PACK} getMeta={metaFrom({})} download={vi.fn()} />);
    await toLazer(user);
    expect(within(card()).getByLabelText("Collection name in osu!lazer")).toHaveValue("SPC Quals");
    expect(within(card()).queryByText(/^Adds /)).not.toBeInTheDocument();
    expect(
      within(card()).getByRole("button", { name: "Download zip for osu!lazer" }),
    ).toBeDisabled();
  });

  it("keeps each side's state when you switch", async () => {
    const user = userEvent.setup();
    render(<CollectionPanel pack={PACK} getMeta={metaFrom(READY)} download={vi.fn()} />);
    await user.upload(
      within(card()).getByLabelText("Your collection.db"),
      collectionFile(TV2_FARM),
    );
    expect(
      await within(card()).findByRole("option", { name: "Farm (2 maps)" }),
    ).toBeInTheDocument();
    await toLazer(user);
    expect(within(card()).queryByRole("option", { name: "Farm (2 maps)" })).not.toBeInTheDocument();
    const name = within(card()).getByLabelText("Collection name in osu!lazer");
    await user.clear(name);
    await user.type(name, "Practice");
    await user.click(within(card()).getByRole("radio", { name: /osu!stable/ }));
    expect(within(card()).getByRole("option", { name: "Farm (2 maps)" })).toBeInTheDocument();
    await toLazer(user);
    expect(within(card()).getByLabelText("Collection name in osu!lazer")).toHaveValue("Practice");
  });
});

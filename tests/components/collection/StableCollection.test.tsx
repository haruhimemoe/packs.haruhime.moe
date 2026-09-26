/**
 * @file tests/components/collection/StableCollection.test.tsx
 * @desc The osu!stable side of the card: read errors with the package's codes (and a good file
 *       clearing them), a good read announced, the collection list (a repeated name once, an
 *       empty name), unusual entries kept and empty map entries left out (singular, plural, past
 *       the reader's list), the steps, the preview waiting for map info (or pointing at the retry
 *       when it failed), the same file picked again after a read error, the default name
 *       (following the pack, clipped), name errors with their codes (empty, name_too_long,
 *       invalid_name), outer spaces ignored in a typed name unless it's exactly a collection's, a
 *       typed name equal to a collection's adding to it, maps already there (plural), a similar
 *       name, the Download button described by the preview and warning (and aria-disabled, still
 *       focusable, once there's nothing to add), long names wrapping, a failed download keeping the
 *       file and the pick, a second add building on the first download, the input locked while a
 *       file reads, focus kept on a control after each step, closing osu! before the file is
 *       picked, a list capped at MAX_LISTED_COLLECTIONS with a very long name clipped (and a
 *       typed name reaching the rest), and a new file too big to write.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sat Sep 26, 2026
 */

import {
  CollectionDbError,
  type CollectionDbRead,
  readCollectionDb,
  writeCollectionDb,
} from "@haruhimemoe/osu/collections";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  StableCollection,
  type StableCollectionProps,
} from "@/components/collection/StableCollection";
import { MAX_LABEL_LENGTH, MAX_LISTED_COLLECTIONS } from "@/utils/osu-collection";
import {
  collectionFile,
  downloaded,
  FARM_NULL_HASH,
  FARM_NULL_HASHES_AND_REPEAT,
  hex,
  MD5_A,
  MD5_ABC,
  MD5_DIGEST,
  MD5_EMPTY,
  TV1_EMPTY,
  TV1_TRAILING,
  TV2_FARM,
  TV3_UNICODE_AND_EMPTY,
  TV7_SHORT,
} from "../../helpers/collections";

const HASHES = [MD5_A, MD5_ABC];
const FILE_HELP = "Pick the collection.db in your osu! folder, not osu!.db or scores.db.";

const setup = (props: Partial<StableCollectionProps> = {}) => {
  const user = userEvent.setup();
  const download = vi.fn();
  const view = render(
    <StableCollection packName="SPC Quals" hashes={HASHES} download={download} {...props} />,
  );
  const upload = (file: File) => user.upload(screen.getByLabelText("Your collection.db"), file);
  return { user, download, upload, ...view };
};

const optionNames = () => screen.getAllByRole("option").map((option) => option.textContent);

describe("StableCollection", () => {
  it("shows the reader's code for a file it can't read, and a good file clears it", async () => {
    const { upload } = setup();
    await upload(collectionFile(TV7_SHORT));
    expect(
      await screen.findByText(`packs can't read that file (bad_count at byte 4). ${FILE_HELP}`),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Your collection.db")).toHaveAttribute("aria-invalid", "true");
    await upload(collectionFile(TV1_TRAILING, "osu!.db"));
    expect(
      await screen.findByText(
        `packs can't read that file (trailing_bytes at byte 8). ${FILE_HELP}`,
      ),
    ).toBeInTheDocument();
    await upload(collectionFile(TV2_FARM));
    expect(await screen.findByRole("option", { name: "Farm (2 maps)" })).toBeInTheDocument();
    expect(screen.queryByText(/packs can't read that file/)).not.toBeInTheDocument();
  });

  it("lists a repeated name once and shows an empty name", async () => {
    const { upload, user, download } = setup();
    const repeated = writeCollectionDb({
      version: 20150203,
      collections: [
        { name: "Farm", hashes: [MD5_A] },
        { name: "Farm", hashes: [] },
      ],
    });
    await upload(new File([repeated], "collection.db"));
    await screen.findByRole("option", { name: "Farm (1 map)" });
    expect(optionNames()).toEqual(["New collection", "Farm (1 map)"]);

    await upload(collectionFile(TV3_UNICODE_AND_EMPTY));
    await screen.findByRole("option", { name: "練習 (1 map)" });
    expect(optionNames()).toEqual(["New collection", "練習 (1 map)", "(no name) (0 maps)"]);
    await user.selectOptions(screen.getByLabelText("Collection"), "(no name) (0 maps)");
    expect(screen.getByText('Adds 2 maps to "(no name)".')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download collection.db" }));
    expect(readCollectionDb((await downloaded(download)).bytes).collections).toEqual([
      { name: "練習", hashes: [MD5_A] },
      { name: "", hashes: [MD5_A, MD5_ABC] },
    ]);
  });

  it("counts entries that look unusual and keeps them", async () => {
    const { upload, user, download } = setup();
    const twice = writeCollectionDb({
      version: 20150203,
      collections: [{ name: "Farm", hashes: [MD5_EMPTY, MD5_EMPTY] }],
    });
    await upload(new File([twice], "collection.db"));
    expect(
      await screen.findByText(
        "1 entry in this file looks unusual, like a map listed twice. packs keeps it.",
      ),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Collection"), "Farm (2 maps)");
    await user.click(screen.getByRole("button", { name: "Download collection.db" }));
    expect(readCollectionDb((await downloaded(download)).bytes).collections).toEqual([
      { name: "Farm", hashes: [MD5_EMPTY, MD5_EMPTY, MD5_A, MD5_ABC] },
    ]);

    const thrice = writeCollectionDb({
      version: 20150203,
      collections: [{ name: "Farm", hashes: [MD5_EMPTY, MD5_EMPTY, MD5_EMPTY] }],
    });
    await upload(new File([thrice], "collection.db"));
    expect(
      await screen.findByText(
        "2 entries in this file look unusual, like a map listed twice. packs keeps them.",
      ),
    ).toBeInTheDocument();
  });

  it("says which unusual entries are past the reader's list", async () => {
    const { upload } = setup();
    // 1,002 copies of one hash: 1,001 duplicate_hash warnings, one more than the reader lists.
    const many = writeCollectionDb({
      version: 20150203,
      collections: [{ name: "Farm", hashes: Array.from({ length: 1002 }, () => MD5_A) }],
    });
    await upload(new File([many], "collection.db"));
    expect(
      await screen.findByText(
        "1001 entries in this file look unusual, like a map listed twice. packs keeps them, apart from any empty map entries.",
      ),
    ).toBeInTheDocument();
  });

  it("says empty map entries are left out, and leaves them out", async () => {
    const { upload, user, download } = setup();
    await upload(collectionFile(FARM_NULL_HASH));
    expect(
      await screen.findByText(
        "1 map entry in this file is empty. packs leaves it out of the new file.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/looks? unusual/)).not.toBeInTheDocument();

    await upload(collectionFile(FARM_NULL_HASHES_AND_REPEAT));
    expect(
      await screen.findByText(
        "1 entry in this file looks unusual, like a map listed twice. packs keeps it. 2 map entries in this file are empty. packs leaves them out of the new file.",
      ),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Collection"), "Farm (2 maps)");
    await user.click(screen.getByRole("button", { name: "Download collection.db" }));
    expect(readCollectionDb((await downloaded(download)).bytes).collections).toEqual([
      { name: "Farm", hashes: [MD5_A, MD5_A, MD5_ABC] },
    ]);
  });

  it("announces a file it read", async () => {
    const { upload } = setup();
    await upload(collectionFile(TV2_FARM));
    expect(await screen.findByText("Read collection.db: 1 collection.")).toHaveAttribute(
      "role",
      "status",
    );
    await upload(collectionFile(TV3_UNICODE_AND_EMPTY));
    expect(await screen.findByText("Read collection.db: 2 collections.")).toHaveAttribute(
      "role",
      "status",
    );
  });

  it("says the preview waits for map info", async () => {
    const { upload } = setup({ hashes: null });
    await upload(collectionFile(TV2_FARM));
    expect(
      await screen.findByText("The preview shows once every map's info has loaded."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download collection.db" })).toBeDisabled();
  });

  it("points at the retry when map info failed", async () => {
    const { upload } = setup({ hashes: null, mapInfoFailed: true });
    await upload(collectionFile(TV2_FARM));
    expect(
      await screen.findByText(
        `Some map info didn't load. Press "Retry loading maps" in the Download card, and the preview shows once it has.`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/The preview shows once every/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download collection.db" })).toBeDisabled();
  });

  it("reads the same file again after a read error", async () => {
    const readFile = vi
      .fn<(file: Blob) => Promise<CollectionDbRead>>()
      .mockRejectedValueOnce(new CollectionDbError("bad_count", "x", { offset: 4 }))
      .mockResolvedValueOnce(readCollectionDb(hex(TV2_FARM)));
    const { upload } = setup({ readFile });
    const file = collectionFile(TV2_FARM);
    await upload(file);
    expect(await screen.findByText(/packs can't read that file/)).toBeInTheDocument();
    expect(screen.getByLabelText("Your collection.db")).toHaveValue("");
    await upload(file);
    expect(await screen.findByRole("option", { name: "Farm (2 maps)" })).toBeInTheDocument();
    expect(readFile).toHaveBeenCalledTimes(2);
  });

  it("says to close osu! before picking the file", () => {
    setup();
    expect(
      screen.getByText(/^Close osu! first, so the file has your latest changes\./),
    ).toHaveAttribute(
      "id",
      screen.getByLabelText("Your collection.db").getAttribute("aria-describedby"),
    );
  });

  it("says how to reach the hidden folder, and what to do with no file yet", () => {
    setup();
    const input = screen.getByLabelText("Your collection.db");
    expect(input).toHaveAccessibleDescription(
      /in the hidden AppData folder: paste %LOCALAPPDATA%\\osu! into the file picker's address bar to get there\./,
    );
    expect(input).toHaveAccessibleDescription(
      /No collection\.db yet\? Make any collection in osu!, close osu!, then load the file it writes\.$/,
    );
  });

  it("shows the steps to swap the file in", async () => {
    const { upload } = setup();
    await upload(collectionFile(TV1_EMPTY));
    expect(
      await screen.findByText(/^Keep osu! closed until the new file is in place\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Keep a copy of your old collection.db.")).toBeInTheDocument();
    expect(
      screen.getByText(
        /named exactly collection\.db\. If your browser saved it as collection \(1\)\.db, rename it\./,
      ),
    ).toBeInTheDocument();
  });

  it("names a new collection after the pack until you type a name", async () => {
    const { upload, user, rerender, download } = setup();
    await upload(collectionFile(TV1_EMPTY));
    expect(
      await screen.findByText('Makes a new collection "SPC Quals" with 2 maps.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("SPC Quals");
    rerender(<StableCollection packName="SPC Semis" hashes={HASHES} download={download} />);
    expect(screen.getByLabelText("Name")).toHaveValue("SPC Semis");
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "  Practice  ");
    expect(screen.getByText('Makes a new collection "Practice" with 2 maps.')).toBeInTheDocument();
    rerender(<StableCollection packName="SPC Finals" hashes={HASHES} download={download} />);
    expect(screen.getByLabelText("Name")).toHaveValue("  Practice  ");
  });

  it("clips a long pack name so the default name works", async () => {
    const { upload, user, download } = setup({ packName: "練".repeat(64) });
    await upload(collectionFile(TV1_EMPTY));
    expect(
      await screen.findByText(`Makes a new collection "${"練".repeat(42)}" with 2 maps.`),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download collection.db" }));
    expect(readCollectionDb((await downloaded(download)).bytes).collections[0]?.name).toBe(
      "練".repeat(42),
    );
  });

  it("refuses a name osu! can't take, with its code", async () => {
    const { upload, user } = setup();
    await upload(collectionFile(TV1_EMPTY));
    const name = await screen.findByLabelText("Name");
    const button = screen.getByRole("button", { name: "Download collection.db" });
    await user.clear(name);
    expect(screen.getByText("Type a name for the new collection.")).toBeInTheDocument();
    expect(button).toBeDisabled();
    await user.type(name, "練".repeat(43));
    expect(
      screen.getByText(
        "That name is too long for a new collection: at most 127 bytes, and a Japanese character takes 3 (name_too_long).",
      ),
    ).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("refuses a control character in the name, with invalid_name", async () => {
    const { upload } = setup();
    await upload(collectionFile(TV1_EMPTY));
    const name = await screen.findByLabelText("Name");
    // user.type can't put a tab in an input, so set the value directly.
    fireEvent.change(name, { target: { value: "SPC\tQuals" } });
    expect(
      screen.getByText(
        "That name has a character osu! can't store, like a tab or a line break (invalid_name).",
      ),
    ).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Download collection.db" })).toBeDisabled();
  });

  it("adds to the collection whose name you type exactly", async () => {
    const { upload, user, download } = setup();
    await upload(collectionFile(TV2_FARM));
    const name = await screen.findByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Farm");
    expect(screen.getByText('Adds 1 map to "Farm". 1 is already in it.')).toBeInTheDocument();
    expect(screen.queryByText(/You already have/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download collection.db" }));
    expect(readCollectionDb((await downloaded(download)).bytes).collections).toEqual([
      { name: "Farm", hashes: [MD5_EMPTY, MD5_A, MD5_ABC] },
    ]);
    expect(screen.getByLabelText("Collection")).toHaveValue("0");
  });

  it("counts case and inner spaces in a typed name, not outer ones", async () => {
    const { upload, user } = setup();
    await upload(collectionFile(TV2_FARM));
    const name = await screen.findByLabelText("Name");
    expect(name).toHaveAccessibleDescription(
      "Case counts, and so do spaces inside the name. A name you already have adds to that collection.",
    );
    await user.clear(name);
    await user.type(name, " Farm ");
    expect(screen.getByText('Adds 1 map to "Farm". 1 is already in it.')).toBeInTheDocument();
    await user.clear(name);
    await user.type(name, "Fa rm");
    expect(screen.getByText('Makes a new collection "Fa rm" with 2 maps.')).toBeInTheDocument();
  });

  it("keeps outer spaces when the typed name is exactly one in the file", async () => {
    const { upload, user, download } = setup();
    const padded = writeCollectionDb({
      version: 20150203,
      collections: [{ name: " Farm ", hashes: [MD5_EMPTY] }],
    });
    await upload(new File([padded], "collection.db"));
    const name = await screen.findByLabelText("Name");
    await user.clear(name);
    await user.type(name, "  Farm  ");
    expect(screen.getByText('Makes a new collection "Farm" with 2 maps.')).toBeInTheDocument();
    await user.clear(name);
    await user.type(name, " Farm ");
    expect(screen.getByText('Adds 2 maps to " Farm ".')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download collection.db" }));
    expect(readCollectionDb((await downloaded(download)).bytes).collections).toEqual([
      { name: " Farm ", hashes: [MD5_EMPTY, MD5_A, MD5_ABC] },
    ]);
  });

  it("says how many maps are already in the collection", async () => {
    const { upload, user } = setup({ hashes: [MD5_A, MD5_ABC, MD5_DIGEST] });
    const both = writeCollectionDb({
      version: 20150203,
      collections: [{ name: "Farm", hashes: [MD5_A, MD5_ABC] }],
    });
    await upload(new File([both], "collection.db"));
    await user.selectOptions(await screen.findByLabelText("Collection"), "Farm (2 maps)");
    expect(screen.getByText('Adds 1 map to "Farm". 2 are already in it.')).toBeInTheDocument();
  });

  it("offers the collection whose name only differs in case, and moves focus to it", async () => {
    const { upload, user } = setup();
    await upload(collectionFile(TV2_FARM));
    const name = await screen.findByLabelText("Name");
    await user.clear(name);
    await user.type(name, "farm");
    expect(
      screen.getByText(
        'You already have "Farm". Case and spaces count, so this makes a second collection.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: 'Add to "Farm" instead' }));
    expect(screen.getByLabelText("Collection")).toHaveValue("0");
    expect(screen.getByLabelText("Collection")).toHaveFocus();
    expect(screen.getByText('Adds 1 map to "Farm". 1 is already in it.')).toBeInTheDocument();
  });

  it("reads the preview and a similar-name warning out on the Download button", async () => {
    const { upload, user } = setup();
    await upload(collectionFile(TV2_FARM));
    const button = await screen.findByRole("button", { name: "Download collection.db" });
    expect(button).toHaveAccessibleDescription('Makes a new collection "SPC Quals" with 2 maps.');
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "farm");
    expect(button).toHaveAccessibleDescription(
      'Makes a new collection "farm" with 2 maps. You already have "Farm". Case and spaces count, so this makes a second collection.',
    );
    // Long names wrap on a phone instead of running off the card.
    expect(screen.getByText(/^You already have "Farm"/)).toHaveClass("wrap-anywhere");
    expect(screen.getByRole("button", { name: 'Add to "Farm" instead' })).toHaveClass(
      "wrap-anywhere",
      "h-auto",
      "min-h-9",
      "py-1.5",
    );
    await user.clear(name);
    expect(button).toBeDisabled();
    expect(button).not.toHaveAccessibleDescription();
  });

  it("keeps the loaded file and the pick when a download fails", async () => {
    const download = vi.fn().mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    const { upload, user } = setup({ download });
    await upload(collectionFile(TV2_FARM));
    await user.selectOptions(await screen.findByLabelText("Collection"), "Farm (2 maps)");
    const button = screen.getByRole("button", { name: "Download collection.db" });
    await user.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save collection.db. Try again.");
    expect(screen.getByLabelText("Collection")).toHaveValue("0");
    expect(screen.getByText('Adds 1 map to "Farm". 1 is already in it.')).toBeInTheDocument();
    expect(button).toBeEnabled();

    await user.click(button);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(download).toHaveBeenCalledTimes(2);
    expect(readCollectionDb((await downloaded(download, 1)).bytes).collections).toEqual([
      { name: "Farm", hashes: [MD5_EMPTY, MD5_A, MD5_ABC] },
    ]);
  });

  it("says when the new file would be too big to write", async () => {
    const download = vi.fn(() => {
      throw new CollectionDbError("too_large", "over the limit");
    });
    const { upload, user } = setup({ download });
    await upload(collectionFile(TV2_FARM));
    await user.click(await screen.findByRole("button", { name: "Download collection.db" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "With these maps, collection.db would be over 64 MiB, more than packs writes (too_large).",
    );
  });

  it(`lists at most ${MAX_LISTED_COLLECTIONS} collections, and a typed name reaches the rest`, async () => {
    const long = "L".repeat(MAX_LABEL_LENGTH + 20);
    const collections = [
      { name: long, hashes: [] },
      ...Array.from({ length: MAX_LISTED_COLLECTIONS + 1 }, (_, i) => ({
        name: `c${i}`,
        hashes: [],
      })),
    ];
    const { upload, user, download } = setup({
      readFile: async () => ({ version: 20150203, collections, warnings: [], omittedWarnings: 0 }),
    });
    await upload(collectionFile(TV1_EMPTY));
    const select = await screen.findByLabelText("Collection");
    // New collection, then the first MAX_LISTED_COLLECTIONS names.
    expect(screen.getAllByRole("option")).toHaveLength(MAX_LISTED_COLLECTIONS + 1);
    expect(optionNames()[1]).toBe(`${"L".repeat(MAX_LABEL_LENGTH)}… (0 maps)`);
    expect(select).toHaveAccessibleDescription(
      "Your file has 2 more collections than this list shows. To add to one of them, pick New collection and type its exact name.",
    );

    const last = `c${MAX_LISTED_COLLECTIONS}`;
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), last);
    expect(screen.getByText(`Adds 2 maps to "${last}".`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download collection.db" }));
    const written = readCollectionDb((await downloaded(download)).bytes).collections;
    expect(written).toHaveLength(collections.length);
    expect(written.at(-1)).toEqual({ name: last, hashes: HASHES });
    // That collection isn't in the list, so the pick stays on the typed name.
    expect(select).toHaveValue("new");
    expect(screen.getByText(`All of these maps are already in "${last}".`)).toBeInTheDocument();
  });

  it("builds a second add on the first download", async () => {
    const { upload, user, download } = setup();
    await upload(collectionFile(TV2_FARM));
    await user.selectOptions(await screen.findByLabelText("Collection"), "Farm (2 maps)");
    const button = screen.getByRole("button", { name: "Download collection.db" });
    await user.click(button);
    expect(
      screen.getByText(
        'Downloaded collection.db with 1 map added to "Farm". Now swap it in: the steps are above.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('All of these maps are already in "Farm".')).toBeInTheDocument();
    // Nothing left to add: the button says why and keeps focus instead of going disabled.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toBeEnabled();
    expect(button).toHaveFocus();
    expect(button).toHaveAccessibleDescription('All of these maps are already in "Farm".');
    await user.click(button);
    expect(download).toHaveBeenCalledTimes(1);

    await user.selectOptions(screen.getByLabelText("Collection"), "New collection");
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Practice");
    await user.click(screen.getByRole("button", { name: "Download collection.db" }));
    expect(download).toHaveBeenCalledTimes(2);
    const second = await downloaded(download, 1);
    expect(second.filename).toBe("collection.db");
    expect(readCollectionDb(second.bytes)).toMatchObject({
      version: 20210520,
      collections: [
        { name: "Farm", hashes: [MD5_EMPTY, MD5_A, MD5_ABC] },
        { name: "Practice", hashes: [MD5_A, MD5_ABC] },
      ],
    });
  });

  it("locks the file input while a file reads", async () => {
    const pending = Promise.withResolvers<CollectionDbRead>();
    const { upload } = setup({ readFile: () => pending.promise });
    await upload(collectionFile(TV2_FARM));
    expect(screen.getByLabelText("Your collection.db")).toBeDisabled();
    expect(screen.getByText("Reading collection.db…")).toBeInTheDocument();
    await act(async () => {
      pending.resolve(readCollectionDb(hex(TV2_FARM)));
    });
    expect(screen.getByLabelText("Your collection.db")).toBeEnabled();
    expect(screen.getByRole("option", { name: "Farm (2 maps)" })).toBeInTheDocument();
  });

  it("puts focus back on the file input when locking it dropped focus", async () => {
    const pending = Promise.withResolvers<CollectionDbRead>();
    const { upload } = setup({ readFile: () => pending.promise });
    const input = screen.getByLabelText("Your collection.db");
    input.focus();
    await upload(collectionFile(TV7_SHORT));
    expect(input).toBeDisabled();
    // Browsers that apply the focus fix-up rule send focus to <body> here; jsdom doesn't.
    act(() => {
      input.blur();
    });
    expect(document.body).toHaveFocus();
    await act(async () => {
      pending.reject(new Error("unreadable"));
    });
    expect(input).toBeEnabled();
    expect(input).toHaveFocus();
  });

  it("leaves focus alone when it moved on during the read", async () => {
    const pending = Promise.withResolvers<CollectionDbRead>();
    const { upload } = setup({ readFile: () => pending.promise });
    const input = screen.getByLabelText("Your collection.db");
    input.focus();
    await upload(collectionFile(TV2_FARM));
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    act(() => {
      elsewhere.focus();
    });
    await act(async () => {
      pending.resolve(readCollectionDb(hex(TV2_FARM)));
    });
    expect(elsewhere).toHaveFocus();
    elsewhere.remove();
  });
});

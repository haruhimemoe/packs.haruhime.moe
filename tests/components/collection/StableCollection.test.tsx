/**
 * @file tests/components/collection/StableCollection.test.tsx
 * @desc The osu!stable side of the card: read errors with the package's codes (and a good file
 *       clearing them), the collection list (a repeated name once, an empty name), unusual
 *       entries kept, the steps, the default name (following the pack, clipped), name errors with
 *       their codes (empty, name_too_long, invalid_name), a typed name equal to a collection's
 *       adding to it, a similar name, a second add building on the first download, and the input
 *       locked while a file reads.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import {
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
import {
  collectionFile,
  downloaded,
  hex,
  MD5_A,
  MD5_ABC,
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

  it("counts entries that look unusual and keeps them as they are", async () => {
    const { upload, user, download } = setup();
    const twice = writeCollectionDb({
      version: 20150203,
      collections: [{ name: "Farm", hashes: [MD5_EMPTY, MD5_EMPTY] }],
    });
    await upload(new File([twice], "collection.db"));
    expect(
      await screen.findByText(
        "1 entry in this file looks unusual, like a map listed twice. They stay exactly as they are.",
      ),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Collection"), "Farm (2 maps)");
    await user.click(screen.getByRole("button", { name: "Download collection.db" }));
    expect(readCollectionDb((await downloaded(download)).bytes).collections).toEqual([
      { name: "Farm", hashes: [MD5_EMPTY, MD5_EMPTY, MD5_A, MD5_ABC] },
    ]);
  });

  it("shows the steps to swap the file in", async () => {
    const { upload } = setup();
    await upload(collectionFile(TV1_EMPTY));
    expect(await screen.findByText(/^Close osu! first\./)).toBeInTheDocument();
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

  it("offers the collection whose name only differs in case", async () => {
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
    expect(screen.getByText('Adds 1 map to "Farm". 1 is already in it.')).toBeInTheDocument();
  });

  it("builds a second add on the first download", async () => {
    const { upload, user, download } = setup();
    await upload(collectionFile(TV2_FARM));
    await user.selectOptions(await screen.findByLabelText("Collection"), "Farm (2 maps)");
    await user.click(screen.getByRole("button", { name: "Download collection.db" }));
    expect(
      screen.getByText('Downloaded collection.db with 1 map added to "Farm".'),
    ).toBeInTheDocument();
    expect(screen.getByText('All of these maps are already in "Farm".')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download collection.db" })).toBeDisabled();

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
});

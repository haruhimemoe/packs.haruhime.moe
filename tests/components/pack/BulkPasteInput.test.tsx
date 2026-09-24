/**
 * @file tests/components/pack/BulkPasteInput.test.tsx
 * @desc Bulk paste: adds good lines, keeps and explains bad ones.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BulkPasteInput } from "@/components/pack/BulkPasteInput";
import { MAX_SLOTS } from "@/constants/pack";

describe("BulkPasteInput", () => {
  it("adds valid lines, reports and keeps invalid ones", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<BulkPasteInput onAdd={onAdd} />);
    const box = screen.getByLabelText("Paste a mappool");
    await user.click(box);
    await user.paste("NM1 129891\nnonsense\nTB 1872396");
    await user.click(screen.getByRole("button", { name: "Add to pool" }));
    expect(onAdd).toHaveBeenCalledWith(
      [
        { mod: "NM", index: 1, beatmapId: 129891 },
        { mod: "TB", index: 1, beatmapId: 1872396 },
      ],
      [],
    );
    expect(screen.getByRole("status")).toHaveTextContent("Added 2 maps.");
    expect(screen.getByRole("alert")).toHaveTextContent(/Line 2/);
    expect(box).toHaveValue("nonsense");
  });

  it("doesn't call onAdd when nothing is valid", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<BulkPasteInput onAdd={onAdd} />);
    await user.click(screen.getByLabelText("Paste a mappool"));
    await user.paste("nonsense");
    await user.click(screen.getByRole("button", { name: "Add to pool" }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("tells the host what was replaced and keeps lines that didn't fit", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const existing = Array.from({ length: MAX_SLOTS - 1 }, (_, i) => ({
      mod: "NM" as const,
      index: i + 1,
      beatmapId: 1000 + i,
    }));
    render(<BulkPasteInput onAdd={onAdd} existing={existing} />);
    const box = screen.getByLabelText("Paste a mappool");
    await user.click(box);
    await user.paste("HD1 5\nNM1 777\nHD2 6");
    await user.click(screen.getByRole("button", { name: "Add to pool" }));
    expect(onAdd).toHaveBeenCalledWith(
      [
        { mod: "HD", index: 1, beatmapId: 5 },
        { mod: "NM", index: 1, beatmapId: 777 },
      ],
      [],
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      `Added 1 map. Replaced NM1. 1 didn't fit: the pack is full (${MAX_SLOTS} maps).`,
    );
    expect(box).toHaveValue("HD2 6");
  });

  it("adds bare IDs as no-slot maps and creates buckets for new codes", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<BulkPasteInput onAdd={onAdd} existing={[{ mod: null, index: 1, beatmapId: 1 }]} />);
    await user.click(screen.getByLabelText("Paste a mappool"));
    await user.paste("129891, 1872396\nEZ1 5\nHT1 6");
    await user.click(screen.getByRole("button", { name: "Add to pool" }));
    expect(onAdd).toHaveBeenCalledWith(
      [
        { mod: null, index: 2, beatmapId: 129891 },
        { mod: null, index: 3, beatmapId: 1872396 },
        { mod: "EZ", index: 1, beatmapId: 5 },
        { mod: "HT", index: 1, beatmapId: 6 },
      ],
      [
        { code: "EZ", color: 0 },
        { code: "HT", color: 1 },
      ],
    );
    expect(screen.getByRole("status")).toHaveTextContent("Added 4 maps. Added slots EZ, HT.");
  });

  it("only creates buckets whose maps made it in, and puts unfitting no-slot IDs back", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const existing = Array.from({ length: MAX_SLOTS - 1 }, (_, i) => ({
      mod: "NM" as const,
      index: i + 1,
      beatmapId: 1000 + i,
    }));
    render(<BulkPasteInput onAdd={onAdd} existing={existing} />);
    const box = screen.getByLabelText("Paste a mappool");
    await user.click(box);
    await user.paste("777\nEZ1 5");
    await user.click(screen.getByRole("button", { name: "Add to pool" }));
    expect(onAdd).toHaveBeenCalledWith([{ mod: null, index: 1, beatmapId: 777 }], []);
    expect(box).toHaveValue("EZ1 5");
  });
});

/**
 * @file tests/components/packs/PublicPackSearch.test.tsx
 * @desc Search loads the index on first use, filters in the browser, and falls back to the list.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PublicPackSearch } from "@/components/packs/PublicPackSearch";
import type { SearchIndex } from "@/schemas/public-pack";

const INDEX: SearchIndex = {
  v: 1,
  packs: [
    {
      s: "aaaaaaaaaa",
      n: "Pokémon Cup",
      o: "Chiyo",
      c: 12,
      d: "Round of 16",
      u: "2026-09-22T00:00:00.000Z",
    },
    { s: "bbbbbbbbbb", n: "SPC Finals", o: "peppy", c: 9, d: "", u: "2026-09-21T00:00:00.000Z" },
  ],
};

const setup = (loadIndex: () => Promise<SearchIndex>) =>
  render(
    <PublicPackSearch loadIndex={loadIndex}>
      <p>Server list</p>
    </PublicPackSearch>,
  );

describe("PublicPackSearch", () => {
  it("loads the index only when someone reaches for search, then filters", async () => {
    const user = userEvent.setup();
    const loadIndex = vi.fn(async () => INDEX);
    setup(loadIndex);
    expect(loadIndex).not.toHaveBeenCalled();
    const box = screen.getByLabelText("Search public packs");
    await user.click(box);
    expect(loadIndex).toHaveBeenCalledOnce();
    await user.type(box, "pokemon");
    expect(await screen.findByRole("link", { name: "Pokémon Cup" })).toHaveAttribute(
      "href",
      "/p/aaaaaaaaaa",
    );
    expect(screen.queryByText("Server list")).not.toBeInTheDocument();
    expect(loadIndex).toHaveBeenCalledOnce();
    await user.clear(box);
    expect(screen.getByText("Server list")).toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    const user = userEvent.setup();
    setup(async () => INDEX);
    await user.type(screen.getByLabelText("Search public packs"), "zzz");
    expect(await screen.findByText("No packs match “zzz”.")).toBeInTheDocument();
  });

  it("keeps the list and explains when search can't load", async () => {
    const user = userEvent.setup();
    setup(async () => {
      throw new Error("offline");
    });
    await user.type(screen.getByLabelText("Search public packs"), "spc");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Search isn't available right now. Try again later.",
    );
    expect(screen.getByText("Server list")).toBeInTheDocument();
  });

  it("announces how many packs match", async () => {
    const user = userEvent.setup();
    setup(async () => INDEX);
    const box = screen.getByLabelText("Search public packs");
    await user.type(box, "spc");
    expect(await screen.findByRole("status")).toHaveTextContent("1 pack matches.");
    await user.clear(box);
    await user.type(box, "zzz");
    expect(await screen.findByRole("status")).toHaveTextContent("No packs match “zzz”.");
  });

  it("keeps its status region mounted, so the first count is announced", () => {
    setup(async () => INDEX);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

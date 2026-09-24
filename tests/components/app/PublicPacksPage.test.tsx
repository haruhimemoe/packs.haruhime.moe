/**
 * @file tests/components/app/PublicPacksPage.test.tsx
 * @desc The /packs page end to end in the browser: the cached list with no params, and a shared
 *       filtered URL that loads /packs/index.json (a fixture served by msw) and shows the
 *       matching packs, sorted, with the count and the packs hidden for missing stats.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import PublicPacksPage from "@/app/(public)/packs/page";
import type { PublicPackCard } from "@/schemas/public-pack";
import fixture from "../../fixtures/public-packs/index.json";

const CARD: PublicPackCard = {
  slug: "bbbbbbbbbb",
  name: "Mania Open Finals",
  ownerName: "peppy",
  ownerAvatarUrl: null,
  slotCount: 20,
  excerpt: "",
  updatedAt: "2026-09-22T10:00:00.000Z",
  stats: { r: [6.2, 7.9], a: 7.01, l: [120, 300], b: [170, 300], m: "NM,FM", g: "mania", k: true },
};

vi.mock("@/services/public-packs", () => ({
  listPublicPacks: vi.fn(async (page: number) => ({
    packs: [CARD],
    page,
    pageCount: 1,
    total: 4,
  })),
}));

const indexRequests = vi.fn();
const server = setupServer(
  http.get("*/packs/index.json", () => {
    indexRequests();
    return HttpResponse.json(fixture);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  indexRequests.mockClear();
});

const renderPage = async (url: string) => {
  window.history.replaceState(null, "", url);
  render(await PublicPacksPage());
};

const cardNames = () =>
  within(screen.getByRole("list"))
    .getAllByRole("link")
    .map((link) => link.textContent);

describe("/packs", () => {
  it("shows the cached list, with card stats, and fetches no index", async () => {
    await renderPage("/packs");
    expect(screen.getByRole("heading", { level: 1, name: "Public packs" })).toBeInTheDocument();
    expect(cardNames()).toEqual(["Mania Open Finals"]);
    expect(screen.getByRole("listitem")).toHaveTextContent("★ 6.20–7.90 stars");
    expect(screen.getByRole("region", { name: "Filters" })).toBeInTheDocument();
    expect(indexRequests).not.toHaveBeenCalled();
  });

  it("opens a shared filtered link on the matching packs", async () => {
    await renderPage("/packs?sr=5-6.5&sort=sr-desc");
    await waitFor(() =>
      expect(cardNames()).toEqual(["Mania Open Finals", "Spring Cup Quarterfinals"]),
    );
    expect(indexRequests).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "2 packs match. 1 pack is hidden until its stats are ready.",
      ),
    );
    expect(screen.getByRole("textbox", { name: "Minimum star rating" })).toHaveValue("5");
    expect(screen.getByRole("textbox", { name: "Maximum star rating" })).toHaveValue("6.5");
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("sr-desc");
  });

  it("ignores params it can't read and shows the cached list", async () => {
    await renderPage("/packs?sr=hard&sort=best&mods=XX");
    expect(cardNames()).toEqual(["Mania Open Finals"]);
    expect(indexRequests).not.toHaveBeenCalled();
  });

  it("narrows the list as filters are picked, and keeps the URL in step", async () => {
    const user = userEvent.setup();
    await renderPage("/packs");
    await user.click(screen.getByRole("button", { name: "EZ" }));
    await waitFor(() => expect(cardNames()).toEqual(["Beginner Cup"]));
    expect(window.location.search).toBe("?mods=EZ");
    const bpm = screen.getByRole("textbox", { name: "Minimum BPM" });
    await user.clear(bpm);
    await user.type(bpm, "200{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("No packs match these filters."),
    );
    await waitFor(() => expect(window.location.search).toBe("?mods=EZ&bpm=200-"));
  });
});

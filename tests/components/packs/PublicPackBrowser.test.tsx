/**
 * @file tests/components/packs/PublicPackBrowser.test.tsx
 * @desc /packs in the browser: the server list shows until someone searches, filters or sorts;
 *       then the index loads once and the bar filters it. The filters live in the URL (written
 *       with replaceState, even without String.prototype.toWellFormed, read back on load and on
 *       back/forward), the count is announced once
 *       changes settle, packs hidden for missing stats are counted, results come 50 at a time,
 *       and a failed index load keeps the server list.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicPackBrowser } from "@/components/packs/PublicPackBrowser";
import { COUNT_SETTLE_MS } from "@/constants/pack-filters";
import { type SearchIndex, type SearchIndexEntry, searchIndexSchema } from "@/schemas/public-pack";
import fixture from "../../fixtures/public-packs/index.json";

const INDEX = searchIndexSchema.parse(fixture);

const setup = (loadIndex: () => Promise<SearchIndex> = async () => INDEX) => {
  const load = vi.fn(loadIndex);
  const user = userEvent.setup();
  render(
    <PublicPackBrowser loadIndex={load}>
      <p>Server list</p>
    </PublicPackBrowser>,
  );
  return { user, load };
};

const cardNames = () =>
  within(screen.getByRole("list"))
    .getAllByRole("link")
    .map((link) => link.textContent);

const openUrl = (url: string) => window.history.replaceState(null, "", url);

beforeEach(() => {
  openUrl("/packs");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PublicPackBrowser", () => {
  it("shows the server list and loads nothing until someone uses the bar", () => {
    const { load } = setup();
    expect(screen.getByText("Server list")).toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("loads the index once, on first use, and searches it", async () => {
    const { user, load } = setup();
    const box = screen.getByRole("searchbox", { name: "Search public packs" });
    await user.click(box);
    expect(load).toHaveBeenCalledOnce();
    await user.type(box, "spring");
    expect(await screen.findByRole("link", { name: "Spring Cup Quarterfinals" })).toHaveAttribute(
      "href",
      "/p/aaaaaaaaaa",
    );
    expect(screen.queryByText("Server list")).not.toBeInTheDocument();
    await user.clear(box);
    expect(screen.getByText("Server list")).toBeInTheDocument();
    expect(load).toHaveBeenCalledOnce();
  });

  it("filters and sorts the whole index in the browser", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "NM" }));
    await waitFor(() =>
      expect(cardNames()).toEqual([
        "Mania Open Finals",
        "Beginner Cup",
        "Spring Cup Quarterfinals",
      ]),
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "Recently updated");
    expect(cardNames()).toEqual(["Beginner Cup", "Spring Cup Quarterfinals", "Mania Open Finals"]);
    await user.click(screen.getByRole("button", { name: "osu!" }));
    expect(cardNames()).toEqual(["Beginner Cup", "Spring Cup Quarterfinals"]);
  });

  it("sorts without a filter, by loading the index", async () => {
    const { user, load } = setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "Most maps");
    expect(load).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(cardNames()).toEqual([
        "Mania Open Finals",
        "Spring Cup Quarterfinals",
        "Old Quals",
        "Beginner Cup",
      ]),
    );
  });

  it("writes the filters to the URL with replaceState", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const push = vi.spyOn(window.history, "pushState");
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "DT" }));
    await waitFor(() => expect(window.location.search).toBe("?mods=DT"));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/packs?mods=DT");
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "Name, A to Z");
    await waitFor(() => expect(window.location.search).toBe("?mods=DT&sort=name"));
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(window.location.search).toBe("?sort=name"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "Newest");
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe("/packs"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText("Server list")).toBeInTheDocument();
  });

  it("writes the URL in browsers without String.prototype.toWellFormed", async () => {
    // jsdom's own history needs toWellFormed, so the write is only recorded here.
    const replace = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    const original = Object.getOwnPropertyDescriptor(String.prototype, "toWellFormed");
    Reflect.deleteProperty(String.prototype, "toWellFormed");
    try {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "DT" }));
      await waitFor(() => expect(replace).toHaveBeenLastCalledWith(null, "", "/packs?mods=DT"));
      await user.type(screen.getByRole("searchbox", { name: "Search public packs" }), "cup");
      await waitFor(() =>
        expect(replace).toHaveBeenLastCalledWith(null, "", "/packs?mods=DT&q=cup"),
      );
      await waitFor(() => expect(cardNames()).toEqual(["Spring Cup Quarterfinals"]));
    } finally {
      if (original) Object.defineProperty(String.prototype, "toWellFormed", original);
    }
  });

  it("writes the URL at most every so often while a slider moves", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const { user } = setup();
    screen.getByRole("slider", { name: "Minimum star rating" }).focus();
    await user.keyboard("{PageUp>20/}");
    await waitFor(() => expect(window.location.search).toBe("?sr=2-"));
    expect(replace.mock.calls.length).toBeLessThan(10);
  });

  it("keeps the page's path and hash in the URL", async () => {
    openUrl("/packs/page/2#top");
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "HR" }));
    await waitFor(() =>
      expect(window.location.pathname + window.location.search).toBe("/packs/page/2?mods=HR"),
    );
    expect(window.location.hash).toBe("#top");
  });

  it("restores the filters from the URL", async () => {
    openUrl("/packs?mods=FM&sort=sr-asc");
    const { load } = setup();
    expect(load).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "FM" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("sr-asc");
    await waitFor(() =>
      expect(cardNames()).toEqual(["Spring Cup Quarterfinals", "Mania Open Finals"]),
    );
  });

  it("follows back and forward", async () => {
    setup();
    act(() => {
      openUrl("/packs?mode=taiko");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => expect(cardNames()).toEqual(["Beginner Cup"]));
    expect(screen.getByRole("button", { name: "taiko" })).toHaveAttribute("aria-pressed", "true");
    act(() => {
      openUrl("/packs");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByText("Server list")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "taiko" })).toHaveAttribute("aria-pressed", "false");
  });

  it("counts packs hidden because their stats aren't ready", async () => {
    openUrl("/packs?sr=5-6.5");
    setup();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "2 packs match. 1 pack is hidden until its stats are ready.",
      ),
    );
    expect(cardNames()).toEqual(["Mania Open Finals", "Spring Cup Quarterfinals"]);
  });

  it("counts a pack whose stats are incomplete as hidden when a range rules it out", async () => {
    const partial: SearchIndexEntry = {
      s: "partialxxx",
      n: "Partial Cup",
      o: "Chiyo",
      c: 12,
      d: "",
      u: "2026-09-20T00:00:00.000Z",
      r: [4.8, 6.1],
      m: "NM,HD,HR,DT",
      g: "osu",
      k: false,
    };
    openUrl("/packs?sr=6.5-");
    setup(async () => ({ v: 1, packs: [partial] }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "No packs match these filters. 1 pack is hidden until its stats are ready.",
      ),
    );
  });

  it("says when nothing matches", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("searchbox", { name: "Search public packs" }), "zzz");
    expect(await screen.findByText("No packs match “zzz”.")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search public packs" }));
    await user.click(screen.getByRole("button", { name: "FL" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "No packs match these filters. 1 pack is hidden until its stats are ready.",
      ),
    );
  });

  it("announces the count only once changes settle", async () => {
    vi.useFakeTimers();
    render(
      <PublicPackBrowser loadIndex={async () => INDEX}>
        <p>Server list</p>
      </PublicPackBrowser>,
    );
    const box = screen.getByRole("searchbox", { name: "Search public packs" });
    const status = screen.getByRole("status");
    const typeText = (value: string) => fireEvent.change(box, { target: { value } });
    fireEvent.focus(box);
    await act(async () => {});
    typeText("c");
    typeText("cu");
    typeText("cup");
    await act(() => vi.advanceTimersByTimeAsync(COUNT_SETTLE_MS - 1));
    expect(status).toBeEmptyDOMElement();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(status).toHaveTextContent("2 packs match.");
    // A count that only flashes by ("zzz" matches nothing) is never announced.
    typeText("zzz");
    await act(() => vi.advanceTimersByTimeAsync(COUNT_SETTLE_MS / 2));
    typeText("cup spr");
    await act(() => vi.advanceTimersByTimeAsync(COUNT_SETTLE_MS - 1));
    expect(status).toHaveTextContent("2 packs match.");
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(status).toHaveTextContent("1 pack matches.");
  });

  it("keeps the server list and explains when the index can't load", async () => {
    const { user, load } = setup(async () => {
      throw new Error("offline");
    });
    const box = screen.getByRole("searchbox", { name: "Search public packs" });
    await user.type(box, "spring");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Search and filters aren't available right now. Try again later.",
    );
    expect(screen.getByText("Server list")).toBeInTheDocument();
    const calls = load.mock.calls.length;
    await user.type(box, "s");
    expect(load.mock.calls.length).toBeGreaterThan(calls);
  });

  it("shows 50 results at a time", async () => {
    const many: SearchIndexEntry[] = Array.from({ length: 60 }, (_, i) => ({
      s: `pack${String(i).padStart(6, "0")}`,
      n: `Cup ${i}`,
      o: "Chiyo",
      c: 10,
      d: "",
      u: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
    }));
    const { user } = setup(async () => ({ v: 1, packs: many }));
    await user.type(screen.getByRole("searchbox", { name: "Search public packs" }), "cup");
    await waitFor(() => expect(cardNames()).toHaveLength(50));
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(cardNames()).toHaveLength(60);
    expect(screen.getByRole("link", { name: "Cup 9" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("shows star and length ranges on filtered cards", async () => {
    openUrl("/packs?mode=mania");
    setup();
    const card = (await screen.findByRole("link", { name: "Mania Open Finals" })).closest("li");
    expect(card).not.toBeNull();
    expect(card).toHaveTextContent("★ 6.20–7.90 stars");
    expect(card).toHaveTextContent("Length 2:00–5:00");
  });
});

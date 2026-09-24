/**
 * @file tests/components/packs/PublicPackBrowser.test.tsx
 * @desc /packs in the browser: the server list shows until someone searches, filters or sorts;
 *       then the index loads once and the bar filters it. The filters live in the URL (written
 *       with replaceState, even without String.prototype.toWellFormed, read back on load, on
 *       back/forward and when a link changes the page's URL), the count shows at once and is announced once changes settle, packs
 *       hidden for missing stats are counted, an empty result says what might help, cards are
 *       dated by the sort, the Source filter keeps community or archive packs (archive cards
 *       link their pool), results come 50 at a time, coming back with Back finds the results
 *       and the place as they were, and a failed index load keeps the server list, says so once,
 *       and retries only on request.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicPackBrowser } from "@/components/packs/PublicPackBrowser";
import { COUNT_SETTLE_MS } from "@/constants/pack-filters";
import { forgetTraversal } from "@/lib/storage/pack-list-view";
import { type SearchIndex, type SearchIndexEntry, searchIndexSchema } from "@/schemas/public-pack";
import fixture from "../../fixtures/public-packs/index.json";

const INDEX = searchIndexSchema.parse(fixture);

/** The Next router's query string, as useSearchParams reports it (a tiny external store). */
const router = vi.hoisted(() => {
  let search = "";
  const listeners = new Set<() => void>();
  return {
    get: () => search,
    set: (next: string) => {
      search = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
});

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useSearchParams: () =>
      new URLSearchParams(useSyncExternalStore(router.subscribe, router.get, router.get)),
  };
});

/** 60 packs named "Cup 0" to "Cup 59", oldest first. */
const MANY: SearchIndexEntry[] = Array.from({ length: 60 }, (_, i) => ({
  s: `pack${String(i).padStart(6, "0")}`,
  n: `Cup ${i}`,
  o: "Chiyo",
  c: 10,
  d: "",
  u: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
}));

/** What a Next Link does: push the URL, then the router's query follows (the page stays). */
const followLink = (url: string) =>
  act(() => {
    window.history.pushState(null, "", url);
    router.set(new URL(url, window.location.href).search.slice(1));
  });

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

/** The count people see: it follows every change. */
const shownCount = () =>
  screen.getByRole("status").querySelector('[aria-hidden="true"]')?.textContent ?? "";

/** The count screen readers get: the live region's text without its aria-hidden part. */
const announcedCount = () => {
  const copy = screen.getByRole("status").cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return copy.textContent ?? "";
};

beforeEach(() => {
  openUrl("/packs");
  router.set("");
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
    expect(screen.getByRole("status").textContent).toBe("");
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

  it("resets when a link goes to the bare page, like the header's Packs link", async () => {
    openUrl("/packs?mods=DT");
    router.set("mods=DT");
    setup();
    const dt = () => screen.getByRole("button", { name: "DT" });
    await waitFor(() => expect(cardNames()).toEqual(["Spring Cup Quarterfinals"]));
    expect(dt()).toHaveAttribute("aria-pressed", "true");

    followLink("/packs");

    await waitFor(() => expect(dt()).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByText("Server list")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("shows the filter rows on phones for a filtered link, and when a link sets filters", async () => {
    openUrl("/packs?mods=DT");
    router.set("mods=DT");
    setup();
    const toggle = screen.getByRole("button", { name: "Filters" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    followLink("/packs");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute(
        "aria-expanded",
        "false",
      ),
    );
    followLink("/packs?mode=taiko");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );
  });

  it("follows a link to other filters on the same page", async () => {
    setup();
    followLink("/packs?mode=taiko&sort=name");
    await waitFor(() => expect(cardNames()).toEqual(["Beginner Cup"]));
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("name");
  });

  it("keeps the filters someone is setting when the router catches up with an older write", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "NM" }));
    await waitFor(() => expect(window.location.search).toBe("?mods=NM"));
    await user.click(screen.getByRole("button", { name: "HD" }));
    await waitFor(() => expect(window.location.search).toBe("?mods=NM,HD"));
    // The router reports the first write late: the page must not go back to it.
    act(() => router.set("mods=NM"));
    act(() => router.set("mods=NM%2CHD"));
    expect(screen.getByRole("button", { name: "HD" })).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toBe("?mods=NM,HD");
  });

  it("drops a URL write still waiting when a link changes the page's URL", async () => {
    const { user } = setup();
    screen.getByRole("slider", { name: "Minimum star rating" }).focus();
    // Two steps in a row: the second write waits for the throttle.
    await user.keyboard("{PageUp}{PageUp}");
    followLink("/packs?mode=mania");
    await waitFor(() => expect(cardNames()).toEqual(["Mania Open Finals"]));
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(window.location.search).toBe("?mode=mania");
    expect(screen.getByRole("slider", { name: "Minimum star rating" })).toHaveAttribute(
      "aria-valuetext",
      "0",
    );
  });

  it("counts packs hidden because their stats aren't ready", async () => {
    openUrl("/packs?sr=5-6.5");
    setup();
    await waitFor(() =>
      expect(announcedCount()).toBe("2 packs match. 1 pack is hidden until its stats are ready."),
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
      expect(announcedCount()).toBe(
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
      expect(announcedCount()).toBe(
        "No packs match these filters. 1 pack is hidden until its stats are ready.",
      ),
    );
  });

  it("suggests other words for a search on its own", async () => {
    openUrl("/packs?q=zzzz");
    setup();
    expect(await screen.findByText("Try other words.")).toBeInTheDocument();
    expect(screen.queryByText(/wider range/)).not.toBeInTheDocument();
  });

  it("names the search and the filters when both are set", async () => {
    openUrl("/packs?q=zzzz&maps=5-");
    setup();
    await waitFor(() => expect(announcedCount()).toBe("No packs match “zzzz” with these filters."));
    expect(
      screen.getByText("Try a wider range, fewer mods or modes, or other words."),
    ).toBeInTheDocument();
  });

  it("suggests a wider range when only filters are set", async () => {
    openUrl("/packs?maps=30-");
    setup();
    expect(
      await screen.findByText("Try a wider range or fewer mods or modes."),
    ).toBeInTheDocument();
  });

  it("says the stats are still being worked out when every match is hidden for them", async () => {
    openUrl("/packs?mods=FL");
    setup();
    expect(
      await screen.findByText(
        "That pack's stats are still being worked out. Clear the star rating, mod, length, BPM and mode filters to see it.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/wider range/)).not.toBeInTheDocument();
  });

  it("shows the count at once but announces it only once changes settle", async () => {
    vi.useFakeTimers();
    render(
      <PublicPackBrowser loadIndex={async () => INDEX}>
        <p>Server list</p>
      </PublicPackBrowser>,
    );
    const box = screen.getByRole("searchbox", { name: "Search public packs" });
    const typeText = (value: string) => fireEvent.change(box, { target: { value } });
    fireEvent.focus(box);
    await act(async () => {});
    typeText("c");
    typeText("cu");
    typeText("cup");
    await act(async () => {});
    expect(shownCount()).toBe("2 packs match.");
    await act(() => vi.advanceTimersByTimeAsync(COUNT_SETTLE_MS - 1));
    expect(announcedCount()).toBe("");
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(announcedCount()).toBe("2 packs match.");
    // A count that only flashes by ("zzz" matches nothing) shows, but is never announced.
    typeText("zzz");
    await act(async () => {});
    expect(shownCount()).toBe("No packs match “zzz”.");
    await act(() => vi.advanceTimersByTimeAsync(COUNT_SETTLE_MS / 2));
    typeText("cup spr");
    await act(async () => {});
    expect(shownCount()).toBe("1 pack matches.");
    await act(() => vi.advanceTimersByTimeAsync(COUNT_SETTLE_MS - 1));
    expect(announcedCount()).toBe("2 packs match.");
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(announcedCount()).toBe("1 pack matches.");
  });

  it("keeps the server list and explains, once, when the index can't load", async () => {
    const { user, load } = setup(async () => {
      throw new Error("offline");
    });
    const alert = screen.getByRole("alert");
    expect(alert).toBeEmptyDOMElement();
    const box = screen.getByRole("searchbox", { name: "Search public packs" });
    await user.type(box, "spring");
    await waitFor(() =>
      expect(alert).toHaveTextContent("Search and filters aren't available right now."),
    );
    expect(screen.getByText("Server list")).toBeInTheDocument();
    expect(load).toHaveBeenCalledOnce();
    // More typing and a slider don't refetch or re-announce: the same alert keeps its text.
    await user.type(box, " cup");
    screen.getByRole("slider", { name: "Minimum star rating" }).focus();
    await user.keyboard("{PageUp}{PageUp}");
    expect(load).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent("Search and filters aren't available right now.");
    expect(screen.getByText("Server list")).toBeInTheDocument();
    expect(screen.queryByText("Loading packs…")).not.toBeInTheDocument();
  });

  it("tries the index again only when asked, keeping the server list meanwhile", async () => {
    let fail = true;
    let finish: () => void = () => {};
    const { user, load } = setup(
      () =>
        new Promise<SearchIndex>((resolve, reject) => {
          if (fail) reject(new Error("offline"));
          else finish = () => resolve(INDEX);
        }),
    );
    await user.type(screen.getByRole("searchbox", { name: "Search public packs" }), "spring");
    const alert = screen.getByRole("alert");
    await waitFor(() =>
      expect(alert).toHaveTextContent("Search and filters aren't available right now."),
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(load).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(alert).toHaveTextContent(
        "Search and filters still aren't available. Try again in a minute.",
      ),
    );
    expect(screen.getByText("Server list")).toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    // While it loads, the list and the alert stay as they were.
    expect(screen.getByText("Server list")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trying again…" })).toBeDisabled();
    act(() => finish());
    expect(
      await screen.findByRole("link", { name: "Spring Cup Quarterfinals" }),
    ).toBeInTheDocument();
    expect(alert).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows 50 results at a time", async () => {
    const { user } = setup(async () => ({ v: 1, packs: MANY }));
    await user.type(screen.getByRole("searchbox", { name: "Search public packs" }), "cup");
    await waitFor(() => expect(cardNames()).toHaveLength(50));
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(cardNames()).toHaveLength(60);
    expect(screen.getByRole("link", { name: "Cup 9" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("keeps only the ticked source, from the URL too, and links archive pools", async () => {
    const archived: SearchIndexEntry = {
      s: "archive000",
      n: "osu! World Cup 2023 Grand Finals",
      o: "haruhime archive",
      c: 20,
      d: "",
      u: "2026-09-24T00:00:00.000Z",
      x: 1,
      xk: "otdb",
      xu: "https://otdb.sheppsu.me/db/mappools/657/",
    };
    openUrl("/packs?source=archive");
    const { user } = setup(async () => ({ v: 1, packs: [...INDEX.packs, archived] }));
    expect(screen.getByRole("button", { name: "Community" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    const list = await screen.findByRole("list");
    await waitFor(() =>
      expect(within(list).getByRole("link", { name: "Archived pool from otdb" })).toHaveAttribute(
        "href",
        "https://otdb.sheppsu.me/db/mappools/657/",
      ),
    );
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Community" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(
        INDEX.packs.length,
      ),
    );
    expect(screen.queryByRole("link", { name: "Archived pool from otdb" })).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe("?source=community"));
  });

  it("moves focus to the next card's name after Show more, archive cards included", async () => {
    const archived = MANY.map((entry) => ({
      ...entry,
      x: 1 as const,
      xk: "otdb" as const,
      xu: "https://otdb.sheppsu.me/db/mappools/1/",
    }));
    const { user } = setup(async () => ({ v: 1, packs: archived }));
    await user.type(screen.getByRole("searchbox", { name: "Search public packs" }), "cup");
    await waitFor(() =>
      expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(50),
    );
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByRole("link", { name: "Cup 9" })).toHaveFocus();
  });

  describe("coming back", () => {
    const load = vi.fn(async (): Promise<SearchIndex> => ({ v: 1, packs: MANY }));
    const page = () => (
      <PublicPackBrowser loadIndex={load}>
        <p>Server list</p>
      </PublicPackBrowser>
    );

    /** Opens ?q=cup, shows all 60, scrolls down, then leaves the page. */
    const browseAndLeave = async () => {
      openUrl("/packs?q=cup");
      const user = userEvent.setup();
      const view = render(page());
      await waitFor(() => expect(cardNames()).toHaveLength(50));
      await user.click(screen.getByRole("button", { name: "Show more" }));
      act(() => {
        window.scrollY = 6063;
        window.dispatchEvent(new Event("scroll"));
      });
      // Leaving by a card link saves the place at once (jsdom can't follow the link itself).
      const stay = (event: Event) => event.preventDefault();
      document.addEventListener("click", stay);
      fireEvent.click(screen.getByRole("link", { name: "Cup 42" }));
      document.removeEventListener("click", stay);
      view.unmount();
      window.scrollY = 0;
    };

    beforeEach(() => {
      load.mockClear();
      sessionStorage.clear();
      forgetTraversal();
    });

    it("with Back, shows as many results as before at the same place, without refetching", async () => {
      const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
      await browseAndLeave();
      expect(load).toHaveBeenCalledOnce();

      // Back: the browser goes to the entry, then Next mounts the page again.
      openUrl("/packs?q=cup");
      window.dispatchEvent(new PopStateEvent("popstate"));
      render(page());

      expect(cardNames()).toHaveLength(60);
      expect(screen.queryByText("Loading packs…")).not.toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Search public packs" })).toHaveValue("cup");
      expect(scrollTo).toHaveBeenLastCalledWith(0, 6063);
      expect(load).toHaveBeenCalledOnce();
    });

    it("starts at the top on a fresh visit to the same URL", async () => {
      const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
      await browseAndLeave();
      scrollTo.mockClear();

      openUrl("/packs?q=cup");
      render(page());

      await waitFor(() => expect(cardNames()).toHaveLength(50));
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });

  it("dates cards by what the list is sorted by", async () => {
    openUrl("/packs?mode=mania");
    const { user } = setup();
    const card = (await screen.findByRole("link", { name: "Mania Open Finals" })).closest("li");
    expect(card).toHaveTextContent("Added Sep 22, 2026");
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "Recently updated");
    expect(screen.getByRole("link", { name: "Mania Open Finals" }).closest("li")).toHaveTextContent(
      "Updated Sep 22, 2026",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "Most maps");
    expect(screen.getByRole("link", { name: "Mania Open Finals" }).closest("li")).toHaveTextContent(
      "Added Sep 22, 2026",
    );
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

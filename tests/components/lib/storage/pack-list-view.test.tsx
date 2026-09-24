/**
 * @file tests/components/lib/storage/pack-list-view.test.tsx
 * @desc Where someone was in the filtered /packs results: saved per URL in sessionStorage (junk
 *       and a refusing storage read as nothing, "clear local data" forgets them all), and whether
 *       a mount is a back or forward to its
 *       URL (a popstate there, moments ago) or a fresh visit.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  cameBackTo,
  clearListViews,
  forgetTraversal,
  LIST_VIEW_KEY_PREFIX,
  loadListView,
  saveListView,
  TRAVERSAL_WINDOW_MS,
  watchTraversals,
} from "@/lib/storage/pack-list-view";

beforeEach(() => {
  sessionStorage.clear();
  forgetTraversal();
  window.history.replaceState(null, "", "/packs");
});

describe("list view", () => {
  it("saves and loads a view per URL", () => {
    saveListView("/packs?mods=DT", { shown: 100, y: 6063 });
    expect(loadListView("/packs?mods=DT")).toEqual({ shown: 100, y: 6063 });
    expect(loadListView("/packs?mods=HR")).toBeNull();
  });

  it("reads junk as nothing", () => {
    sessionStorage.setItem(`${LIST_VIEW_KEY_PREFIX}/packs?q=a`, "{");
    sessionStorage.setItem(`${LIST_VIEW_KEY_PREFIX}/packs?q=b`, '{"shown":-1,"y":0}');
    expect(loadListView("/packs?q=a")).toBeNull();
    expect(loadListView("/packs?q=b")).toBeNull();
  });

  it("does without a storage that refuses", () => {
    const refusing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(() => saveListView("/packs?q=a", { shown: 50, y: 1 }, refusing)).not.toThrow();
    expect(loadListView("/packs?q=a", refusing)).toBeNull();
    expect(loadListView("/packs?q=a", null)).toBeNull();
  });
});

describe("clearListViews", () => {
  it("forgets every saved view and nothing else", () => {
    saveListView("/packs?mods=DT", { shown: 100, y: 6063 });
    saveListView("/packs?q=cup", { shown: 50, y: 10 });
    sessionStorage.setItem("something-else", "kept");
    clearListViews();
    expect(loadListView("/packs?mods=DT")).toBeNull();
    expect(loadListView("/packs?q=cup")).toBeNull();
    expect(sessionStorage.getItem("something-else")).toBe("kept");
  });

  it("does nothing without a storage", () => {
    expect(() => clearListViews(null)).not.toThrow();
  });
});

describe("coming back", () => {
  it("counts a back or forward to the same URL, moments ago", () => {
    watchTraversals();
    window.history.replaceState(null, "", "/packs?mods=DT");
    window.dispatchEvent(new PopStateEvent("popstate"));
    const now = Date.now();
    expect(cameBackTo("/packs?mods=DT", now)).toBe(true);
    expect(cameBackTo("/packs?mods=HR", now)).toBe(false);
    expect(cameBackTo("/packs?mods=DT", now + TRAVERSAL_WINDOW_MS + 1)).toBe(false);
  });

  it("doesn't count a fresh visit, or a back that was already used", () => {
    watchTraversals();
    expect(cameBackTo("/packs")).toBe(false);
    window.dispatchEvent(new PopStateEvent("popstate"));
    forgetTraversal();
    expect(cameBackTo("/packs")).toBe(false);
  });
});

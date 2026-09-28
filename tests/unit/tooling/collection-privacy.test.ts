/**
 * @file tests/unit/tooling/collection-privacy.test.ts
 * @desc A player's collection.db never leaves the browser: nothing in the collection card's code
 *       (both the osu!stable and osu!lazer sides) makes a request (event streams and beacons
 *       included), submits a form, declares a server action, hands data to another window, a
 *       worker or the clipboard, navigates, stores anything (cookies, the Cache API, IndexedDB and
 *       packs' own src/lib/storage/ included) or logs, and it imports only modules on a short
 *       list, so it can't reach packs' storage or request helpers through an import.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Mon Sep 28, 2026
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
  });

const COLLECTION_CODE = [
  ...files("src/components/collection"),
  ...files("src/lib/collections"),
  "src/utils/osu-collection.ts",
  "src/utils/stable-collection-text.ts",
  "src/hooks/useStableCollection.ts",
];
const SENDS_OR_KEEPS =
  /\bfetch\s*\(|FormData|sendBeacon|XMLHttpRequest|WebSocket|EventSource|postMessage|\bnew\s+(?:Shared)?Worker\b|window\.open\b|\blocation\s*=(?!=)|\blocation\.(?:href|assign|replace)\b|navigator\.clipboard|localStorage|sessionStorage|indexedDB|idb-keyval|document\.cookie|\bcaches\.|navigator\.storage|@\/lib\/storage\/|console\.|"use server"|<form\b/;

/** One line per way out the scan must catch. */
const LEAKS = [
  'fetch("/api", { body })',
  "new FormData()",
  "navigator.sendBeacon(url, bytes)",
  "new XMLHttpRequest()",
  "new WebSocket(url)",
  "new EventSource(url)",
  "navigator.clipboard.writeText(names)",
  "window.parent.postMessage(bytes, '*')",
  'new Worker("/worker.js")',
  'new SharedWorker("/worker.js")',
  "window.open(url)",
  "location = url",
  "window.location = url",
  "location.href = url",
  "localStorage.setItem(k, v)",
  "indexedDB.open(name)",
  "document.cookie = names",
  'console.log("x")',
];

/** What the collection code may import. An entry ending in "/" allows that whole folder. */
const ALLOWED_IMPORTS = [
  "@haruhimemoe/osu/collections",
  "@haruhimemoe/pool",
  "@haruhimemoe/ui",
  "react",
  "fflate",
  "next/link",
  "@/components/collection/",
  "@/lib/collections/",
  "@/lib/zip/save-zip",
  "@/utils/osu-collection",
  "@/utils/pack-archive",
  // Pure string formatting ("3 maps"): nothing that can send or keep a file.
  "@/utils/text",
  "@/utils/stable-collection-text",
  "@/hooks/useStableCollection",
  "@/constants/pack",
];
/** Allowed only through `import type`, which leaves nothing in the built code. */
const TYPE_ONLY_IMPORTS = ["@/schemas/beatmap-meta", "@/schemas/pack"];

const TYPE_IMPORT = /\bimport\s+type\s[^;]*?\bfrom\s*["']([^"']+)["']/g;
// `from "x"` (imports and re-exports), `import "x"`, `import("x")` and `require("x")`.
const ANY_IMPORT = /\b(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g;

const importsOf = (source: string): { types: string[]; values: string[] } => ({
  types: [...source.matchAll(TYPE_IMPORT)].map((match) => match[1] ?? ""),
  values: [...source.replace(TYPE_IMPORT, "").matchAll(ANY_IMPORT)].map((match) => match[1] ?? ""),
});

const allowed = (specifier: string): boolean =>
  ALLOWED_IMPORTS.some((entry) =>
    entry.endsWith("/") ? specifier.startsWith(entry) : specifier === entry,
  );

describe("collection code", () => {
  it("covers the card, its files and its helpers", () => {
    expect(COLLECTION_CODE).toEqual(
      expect.arrayContaining([
        "src/components/collection/CollectionPanel.tsx",
        "src/components/collection/LazerCollection.tsx",
        "src/components/collection/StableCollection.tsx",
        "src/lib/collections/collection-files.ts",
        "src/utils/osu-collection.ts",
        "src/utils/stable-collection-text.ts",
        "src/hooks/useStableCollection.ts",
      ]),
    );
  });

  it.each(LEAKS)("the scan catches %s", (line) => {
    expect(SENDS_OR_KEEPS.test(line)).toBe(true);
  });

  it("the scan leaves plain comparisons alone", () => {
    expect(SENDS_OR_KEEPS.test("if (location === here) return;")).toBe(false);
  });

  it("never sends, stores or logs anything", () => {
    const hits = COLLECTION_CODE.filter((file) => SENDS_OR_KEEPS.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);
  });

  it("finds every kind of import", () => {
    const source = [
      'import type { Pool } from "@/schemas/pack";',
      'import { saveDraft } from "@/lib/storage/drafts";',
      'import "side-effect";',
      'const api = await import("@/lib/packs-api");',
      'export { thing } from "@/lib/api";',
    ].join("\n");
    expect(importsOf(source)).toEqual({
      types: ["@/schemas/pack"],
      values: ["@/lib/storage/drafts", "side-effect", "@/lib/packs-api", "@/lib/api"],
    });
  });

  it("imports only modules that can't send or keep the file", () => {
    const offenders = COLLECTION_CODE.flatMap((file) => {
      const { types, values } = importsOf(readFileSync(file, "utf8"));
      return [
        ...values.filter((specifier) => !allowed(specifier)),
        ...types.filter(
          (specifier) => !allowed(specifier) && !TYPE_ONLY_IMPORTS.includes(specifier),
        ),
      ].map((specifier) => `${file}: ${specifier}`);
    });
    expect(offenders).toEqual([]);
  });
});

/**
 * @file tests/unit/tooling/collection-privacy.test.ts
 * @desc A player's collection.db never leaves the browser: nothing in the collection card's code
 *       makes a request, submits a form, declares a server action, stores anything (cookies, the
 *       Cache API and packs' own src/lib/storage/ included) or logs, and it imports only modules
 *       on a short list, so it can't reach packs' storage or request helpers through an import.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
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
];
const SENDS_OR_KEEPS =
  /\bfetch\s*\(|FormData|sendBeacon|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|idb-keyval|document\.cookie|\bcaches\.|navigator\.storage|@\/lib\/storage\/|console\.|"use server"|<form\b/;

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
  "@/constants/pack",
];
/** Allowed only through `import type`, which leaves nothing in the built code. */
const TYPE_ONLY_IMPORTS = ["@/hooks/beatmapMetaState", "@/schemas/pack"];

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
        "src/components/collection/StableCollection.tsx",
        "src/lib/collections/collection-files.ts",
        "src/utils/osu-collection.ts",
      ]),
    );
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

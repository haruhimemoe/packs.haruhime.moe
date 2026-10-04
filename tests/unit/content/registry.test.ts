/**
 * @file tests/unit/content/registry.test.ts
 * @desc The content registry, the MDX loaders and the files under content/ name the same pages,
 *       so no page builds without its file and no file sits unregistered.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { contentFileDrift } from "@haruhimemoe/next-kit/docs/files";
import { expect, it } from "vitest";
import { CONTENT } from "@/constants/content";
import { LOADERS } from "@/content/load";

it("registry, loaders and files agree", () => {
  expect(contentFileDrift(CONTENT)).toEqual({ missingFiles: [], unregistered: [] });
  for (const s of CONTENT.sections)
    expect(Object.keys(LOADERS[s] ?? {}).sort()).toEqual(
      CONTENT.entries[s].map((e) => e.slug).sort(),
    );
});

it("has docs, guides and legal", () => {
  expect(CONTENT.sections).toEqual(["docs", "guides", "legal"]);
});

it("keeps nav titles within 32 characters", () => {
  for (const s of CONTENT.sections)
    for (const e of CONTENT.entries[s])
      expect((e.navTitle ?? e.title).length).toBeLessThanOrEqual(32);
});

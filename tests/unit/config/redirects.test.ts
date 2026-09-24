/**
 * @file tests/unit/config/redirects.test.ts
 * @desc The removed tournament-check and archived pools guides redirect to the guide index, permanently.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("redirects", () => {
  it("sends the old tournament guide to /guide", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects).toContainEqual({
      source: "/guide/official-tournament-pools",
      destination: "/guide",
      permanent: true,
    });
  });

  it("sends the old archived pools guide to /guide", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects).toContainEqual({
      source: "/guide/archived-pools",
      destination: "/guide",
      permanent: true,
    });
  });
});

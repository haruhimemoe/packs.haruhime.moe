/**
 * @file tests/integration/app/api/pack-history.test.ts
 * @desc PUT /api/packs/{slug}/history: 401 signed out, 404 for someone else's pack, 200 for the
 *       owner, the row gets historyPublic.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { PUT } from "@/app/api/packs/[slug]/history/route";
import { POST as CREATE } from "@/app/api/packs/route";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest, slugContext } from "../../../helpers/requests";

setupTestDb();

const PACK = { name: "Pack", slots: [{ mod: "NM", index: 1, beatmapId: 1 }] };

const save = async (cookie: string): Promise<string> => {
  const response = await CREATE(apiRequest("/api/packs", { method: "POST", body: PACK, cookie }));
  return ((await response.json()) as { pack: { slug: string } }).pack.slug;
};

const putHistory = (slug: string, cookie: string | undefined, historyPublic: boolean) =>
  PUT(
    apiRequest(`/api/packs/${slug}/history`, {
      method: "PUT",
      body: { historyPublic },
      cookie,
    }),
    slugContext(slug),
  );

describe("PUT /api/packs/{slug}/history", () => {
  it("401s when signed out", async () => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie);
    expect((await putHistory(slug, undefined, true)).status).toBe(401);
  });

  it("404s for a pack that isn't the caller's", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const slug = await save(owner.cookie);
    expect((await putHistory(slug, other.cookie, true)).status).toBe(404);
  });

  it("turns history on for the owner", async () => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie);
    const response = await putHistory(slug, owner.cookie, true);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ historyPublic: true });
  });
});

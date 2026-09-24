/**
 * @file tests/unit/content/api-docs-content.test.ts
 * @desc content/docs/api.mdx documents every endpoint in the OpenAPI route table, the real
 *       limits, the headers, every error code the API sends, what PUT does to fields left out,
 *       pins and hidden packs, the owner name, pack stats and every index key, and the Claude
 *       Code plugin;
 *       every doc stays plain Markdown so /docs/<slug>.md can serve it as is.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { API_PAGE_SIZE, OPENAPI_PATH, RATE_LIMITS, UNKNOWN_OWNER_NAME } from "@/constants/api";
import { DOC_DOCS, DOC_SLUGS } from "@/constants/docs";
import {
  DESCRIPTION_EXCERPT_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_SLOTS,
} from "@/constants/pack";
import { POOLS_ACCOUNT } from "@/constants/pools";
import { SEARCH_INDEX_LIMIT } from "@/constants/public-packs";
import { errorCodeFor } from "@/lib/api";
import { API_OPERATIONS } from "@/lib/openapi";
import { packStatsSchema } from "@/schemas/pack-stats";

const text = () => readFileSync(path.join(process.cwd(), "content", "docs", "api.mdx"), "utf8");

describe("content/docs/api.mdx", () => {
  it("has no h1 of its own", () => {
    expect(text()).not.toMatch(/^# /m);
  });

  it.each(API_OPERATIONS.map((op) => `${op.method.toUpperCase()} /api/v1${op.path}`))(
    "documents %s",
    (endpoint) => {
      expect(text()).toContain(endpoint);
    },
  );

  it.each([
    `${RATE_LIMITS.api.limit} requests a minute`,
    `${RATE_LIMITS.apiWrite.limit} writes a minute`,
    `${RATE_LIMITS.authFail.limit} failed key attempts a minute`,
    `${RATE_LIMITS.keyCreate.limit} new keys an hour`,
    `${API_PAGE_SIZE} per page`,
  ])("states %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it.each([
    "Authorization: Bearer hpk_",
    "RateLimit-Limit",
    "RateLimit-Remaining",
    "RateLimit-Reset",
    "Retry-After",
    "CORS",
    OPENAPI_PATH,
    "/guide/pack-key",
    "/packs/index.json",
    "invalid_api_key",
    "WWW-Authenticate: Bearer",
    "On a 401, these describe the failed-attempt limit for your IP address.",
  ])("mentions %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it.each([400, 401, 404, 409, 413, 415, 429, 500])("lists status %i and its code", (status) => {
    expect(text()).toContain(`\`${status}\` \`${errorCodeFor(status)}\``);
  });

  it("uses no em dashes", () => {
    expect(text()).not.toContain("—");
  });

  it("says what /packs/index.json holds, and points to the API for a pack's maps", () => {
    expect(text()).toContain(`up to ${SEARCH_INDEX_LIMIT.toLocaleString("en-US")} packs`);
    expect(text()).toContain("Entries are newest created first.");
    expect(text()).toContain("GET /api/v1/packs/{slug}");
    expect(text()).not.toContain("read every public pack");
  });
});

describe("writes and the pack object", () => {
  it.each([
    "`PUT` and `DELETE` also answer `404` for any pack that isn't yours.",
    "Leaving out `description` clears it, and leaving out `visibility` makes the pack unlisted.",
    "A pack a moderator hid stays hidden, and a pinned pack that stops being public loses its pin.",
    "It can't hide, pin or moderate packs, not even an admin's key.",
    "Pinned packs aren't marked or moved up here",
    `a name of 1 to ${MAX_NAME_LENGTH} characters, 1 to ${MAX_SLOTS} maps, a description of up to ${MAX_DESCRIPTION_LENGTH} characters, up to 8 custom slots`,
    "no slurs in the name, the description or custom slot names",
  ])("says %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it("names the owner of the pools pools.haruhime.moe publishes, and of unknown owners", () => {
    expect(text()).toContain(
      `\`${POOLS_ACCOUNT.name}\` on the tournament pools pools.haruhime.moe publishes`,
    );
    expect(text()).toContain(`\`${UNKNOWN_OWNER_NAME}\` when we don't have one`);
  });
});

describe("pack stats", () => {
  it.each(Object.keys(packStatsSchema.shape))("documents stats.%s", (field) => {
    expect(text()).toContain(`\`${field}\``);
  });

  it.each([
    "`s`",
    "`n`",
    "`o`",
    "`c`",
    "`d`",
    "`u`",
    "`t`",
    "`r`",
    "`a`",
    "`l`",
    "`b`",
    "`m`",
    "`g`",
    "`k`",
  ])("documents the index key %s", (key) => {
    expect(text()).toContain(key);
  });

  it("lists no archive keys for the index", () => {
    const pagination = text().slice(
      text().indexOf("## Pagination"),
      text().indexOf("## Pack keys"),
    );
    for (const key of ["`x`", "`xk`", "`xu`"]) expect(pagination).not.toContain(key);
  });

  it("says stats arrive after a save", () => {
    expect(text()).toContain("a few seconds after each save");
    expect(text()).toContain("- 2026-09-24: pack objects carry `stats`");
  });

  it("says a cut description excerpt ends in an ellipsis", () => {
    expect(text()).toContain(
      `up to ${DESCRIPTION_EXCERPT_LENGTH} characters, plus \`…\` when it's cut`,
    );
  });

  it("says a map osu! doesn't have is left out without making the stats incomplete", () => {
    expect(text()).toContain(
      "A map osu! says doesn't exist (deleted, say) is left out of the numbers and doesn't make `complete` false.",
    );
  });
});

describe("no map usage", () => {
  it("has no map usage section or endpoint", () => {
    expect(text()).not.toContain("## Map usage");
    expect(text()).not.toContain("/api/v1/beatmaps");
    expect(text()).toContain("and every request needs your personal API key.");
  });
});

describe("the Claude Code plugin section", () => {
  it.each([
    "## Use it with Claude Code",
    "/plugin marketplace add haruhimemoe/claude-plugin",
    "/plugin install haruhime@haruhimemoe",
    "(https://github.com/haruhimemoe/claude-plugin)",
  ])("has %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it("dates the doc to the change", () => {
    expect(DOC_DOCS.api.lastUpdated).toBe("2026-09-24");
  });
});

describe.each(DOC_SLUGS)("content/docs/%s.mdx stays plain Markdown", (slug) => {
  const source = () =>
    readFileSync(path.join(process.cwd(), "content", "docs", `${slug}.mdx`), "utf8");
  const outsideCode = () =>
    source()
      .replace(/^```[\s\S]*?^```/gm, "")
      .replace(/`[^`\n]*`/g, "");

  it("has no import or export lines", () => {
    expect(outsideCode()).not.toMatch(/^(import|export)\s/m);
  });

  it("has no JSX components or expressions", () => {
    expect(outsideCode()).not.toMatch(/<[A-Za-z]/);
    expect(outsideCode()).not.toMatch(/\{[^}]*\}/);
  });
});

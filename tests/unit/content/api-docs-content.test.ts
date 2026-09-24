/**
 * @file tests/unit/content/api-docs-content.test.ts
 * @desc content/docs/api.mdx documents every endpoint in the OpenAPI route table, the real
 *       limits, the headers, every error code the API sends, pack stats and their index keys,
 *       archive packs, map usage (no key, its fields, its cache), and the Claude Code plugin;
 *       every doc stays plain Markdown so /docs/<slug>.md can serve it as is.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { API_PAGE_SIZE, OPENAPI_PATH, RATE_LIMITS } from "@/constants/api";
import { DOC_DOCS, DOC_SLUGS } from "@/constants/docs";
import { MAX_USAGE_IDS } from "@/constants/map-usage";
import { SEARCH_INDEX_LIMIT } from "@/constants/public-packs";
import { errorCodeFor } from "@/lib/api";
import { API_OPERATIONS } from "@/lib/openapi";
import { archiveSourceSchema, packArchiveSchema } from "@/schemas/archive";
import { beatmapUsageSchema, mapUsageEntrySchema } from "@/schemas/map-usage";
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
    `${RATE_LIMITS.mapUsage.limit} map usage requests a minute per IP address`,
    `${API_PAGE_SIZE} per page`,
    `up to ${MAX_USAGE_IDS} maps at once`,
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
    expect(text()).toContain(
      "community packs newest created first, then archive packs newest created first",
    );
    expect(text()).toContain("GET /api/v1/packs/{slug}");
    expect(text()).not.toContain("read every public pack");
  });
});

describe("pack stats", () => {
  it.each(Object.keys(packStatsSchema.shape))("documents stats.%s", (field) => {
    expect(text()).toContain(`\`${field}\``);
  });

  it.each(["`t`", "`r`", "`a`", "`l`", "`b`", "`m`", "`g`", "`k`", "`x`", "`xk`", "`xu`"])(
    "documents the index key %s",
    (key) => {
      expect(text()).toContain(key);
    },
  );

  it("says stats arrive after a save", () => {
    expect(text()).toContain("a few seconds after each save");
    expect(text()).toContain("- 2026-09-24: pack objects carry `stats`");
  });

  it("says a map osu! doesn't have is left out without making the stats incomplete", () => {
    expect(text()).toContain(
      "A map osu! says doesn't exist (deleted, say) is left out of the numbers and doesn't make `complete` false.",
    );
  });
});

describe("archive packs", () => {
  it.each([...Object.keys(packArchiveSchema.shape), ...Object.keys(archiveSourceSchema.shape)])(
    "documents archive field %s",
    (field) => {
      expect(text()).toContain(`\`${field}\``);
    },
  );

  it("says nobody can set it, and dates the change", () => {
    expect(text()).toContain("Nobody can set or change it: `POST` and `PUT` ignore it.");
    expect(text()).toContain("- 2026-09-24: archive packs (past tournament pools) carry `archive`");
  });
});

describe("map usage", () => {
  it.each([...Object.keys(beatmapUsageSchema.shape), ...Object.keys(mapUsageEntrySchema.shape)])(
    "documents usage field %s",
    (field) => {
      expect(text()).toContain(`\`${field}\``);
    },
  );

  it.each([
    "## Map usage",
    "Every request needs your personal API key, except map usage, which needs none.",
    "A pool with the map in two slots has two entries and counts once.",
    "most recent `year` first",
    "comes back with a `count` of 0 and no entries, never a 404",
    "they carry `Cache-Control` and no rate-limit headers",
    "answers can be up to an hour old",
    "- 2026-09-24: `GET /beatmaps/{id}/usage` and `GET /beatmaps/usage` list the archive pools a map was used in. They need no key.",
  ])("says %j", (phrase) => {
    expect(text()).toContain(phrase);
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

/**
 * @file tests/unit/tooling/repo-docs.test.ts
 * @desc The repo's own docs: the README opens with the packs banner, says pools.haruhime.moe is
 *       in beta, and describes the osu! collection card; README, CONTRIBUTING.md and SECURITY.md
 *       point to our Discord server for help; the repo's llms.txt links pools.haruhime.moe.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Mon Sep 28, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SITE } from "@/constants/site";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

const BANNER =
  '<p align="center"><a href="https://packs.haruhime.moe"><picture><source media="(prefers-color-scheme: light)" srcset="https://www.haruhime.moe/brand/repos/packs.haruhime.moe-banner-on-light.svg"><img alt="packs.haruhime.moe" src="https://www.haruhime.moe/brand/repos/packs.haruhime.moe-banner.svg" width="640"></picture></a></p>';

describe("README", () => {
  it("opens with the banner, above the heading", () => {
    expect(read("README.md").startsWith(`${BANNER}\n\n# packs.haruhime.moe\n`)).toBe(true);
  });

  it("says where the haruhime pools packs come from, and that pools is in beta", () => {
    expect(read("README.md")).toContain(
      "Tournament pools from [pools.haruhime.moe](https://pools.haruhime.moe) (in beta), haruhime's mappool builder, are listed too, owned by haruhime pools.",
    );
  });

  it("describes the osu! collection card", () => {
    expect(read("README.md")).toContain("- **osu! collections:**");
  });
});

describe.each(["README.md", "CONTRIBUTING.md", "SECURITY.md"])("%s", (file) => {
  it("points to our Discord server for help", () => {
    expect(read(file)).toContain(`(${SITE.discordUrl})`);
  });
});

describe("the repo's llms.txt", () => {
  it("links pools.haruhime.moe under Elsewhere, as the mappool builder in beta", () => {
    const elsewhere = read("llms.txt").split("\n## Elsewhere\n")[1] ?? "";
    expect(elsewhere).toContain(
      "- [pools.haruhime.moe](https://pools.haruhime.moe): the osu! tournament mappool builder, in beta.",
    );
    expect(elsewhere).toContain("in beta");
  });

  it("names the collection.db reader and writer in @haruhimemoe/osu", () => {
    expect(read("llms.txt")).toContain(
      "- [@haruhimemoe/osu](https://github.com/haruhimemoe/osu): osu! API v2 shapes, the server client, and the collection.db reader and writer",
    );
  });
});

describe("SECURITY.md and security.txt", () => {
  it("names GitHub private vulnerability reporting first, then email", () => {
    const security = read("SECURITY.md");
    const github = security.indexOf("/security/advisories/new");
    expect(github).toBeGreaterThan(-1);
    expect(github).toBeLessThan(security.indexOf("contact@haruhime.moe"));
  });
});

describe("package.json", () => {
  it("says what the repo is and that it's MIT", () => {
    const pkg = JSON.parse(read("package.json")) as Record<string, unknown>;
    expect(pkg.license).toBe("MIT");
    expect(pkg.homepage).toBe("https://packs.haruhime.moe");
    expect(pkg.description).toEqual(expect.any(String));
  });
});

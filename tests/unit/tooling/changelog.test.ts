/**
 * @file tests/unit/tooling/changelog.test.ts
 * @desc CHANGELOG.md follows Keep a Changelog 1.1.0 + semver: `## [Unreleased]` is the first `##`
 *       heading, the newest release heading equals the package version, Unreleased and every
 *       release link to the right compare/tag URL, every `###` heading is one of the six allowed
 *       names, and a 0.x release that adds or changes anything bumps the minor version.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(process.cwd());
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const repo = "https://github.com/haruhimemoe/packs.haruhime.moe";

const SECTIONS = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"];

const releases = [...changelog.matchAll(/^## \[(\d+)\.(\d+)\.(\d+)\] - \d{4}-\d{2}-\d{2}$/gm)].map(
  (match) => ({
    version: `${match[1]}.${match[2]}.${match[3]}`,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    notes: changelog.slice((match.index ?? 0) + match[0].length).split(/^## |^\[/m)[0] ?? "",
  }),
);

describe("changelog", () => {
  it("heads with an empty [Unreleased] section as the first ## heading", () => {
    const headings = [...changelog.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings[0]).toBe("[Unreleased]");
  });

  it("heads its newest release with the package version", () => {
    expect(releases.length).toBeGreaterThan(0);
    expect(releases[0]?.version).toBe(pkg.version);
  });

  it("links Unreleased and every release to its diff", () => {
    const links = [...changelog.matchAll(/^\[([^\]]+)\]: (\S+)$/gm)].map((match) => match.slice(1));
    const expected = [
      ["unreleased", `${repo}/compare/v${releases[0]?.version}...HEAD`],
      ...releases.map(({ version }, i) => {
        const previous = releases[i + 1];
        return [
          version,
          previous
            ? `${repo}/compare/v${previous.version}...v${version}`
            : `${repo}/releases/tag/v${version}`,
        ];
      }),
    ];
    expect(links).toEqual(expected);
  });

  it("uses only the six Keep a Changelog section names", () => {
    const headings = [...changelog.matchAll(/^### (.+)$/gm)].map((match) => match[1]);
    for (const heading of headings) {
      expect(SECTIONS, heading).toContain(heading);
    }
  });

  // While on 0.x, a new API or a change to how the site or API behaves is a minor version, so a
  // patch release holds fixes (and security fixes) only.
  it("bumps the minor version, while on 0.x, for a release that adds or changes anything", () => {
    for (const [i, release] of releases.entries()) {
      const previous = releases[i + 1];
      if (!previous || release.major > 0) continue;
      const sections = [...release.notes.matchAll(/^### (\w+)$/gm)].map((match) => match[1]);
      if (sections.every((section) => section === "Fixed" || section === "Security")) continue;
      expect(release.patch, `${release.version} has ${sections.join(", ")}`).toBe(0);
      expect(release.minor, release.version).toBe(previous.minor + 1);
    }
  });
});

/**
 * @file tests/unit/tooling/readme-packages.test.ts
 * @desc The README's Packages section links every @haruhimemoe package in package.json, so the
 *       list of shared packages the site is built on stays complete.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import pkg from "../../../package.json";

const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
const section = /^## Packages\n([\s\S]*?)(?=^## )/m.exec(readme)?.[1] ?? "";
const shared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((name) =>
  name.startsWith("@haruhimemoe/"),
);

describe("README Packages section", () => {
  it("exists", () => {
    expect(section).not.toBe("");
  });

  it.each(shared)("links %s", (name) => {
    expect(section).toContain(`[\`${name}\`](https://www.npmjs.com/package/${name})`);
  });
});

/**
 * @file tests/unit/tooling/pinned-deps.test.ts
 * @desc Every dependency is pinned to an exact version (no ^, ~, ranges or tags), so a new
 *       release (ours on npm included) never lands without a deliberate bump.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import pkg from "../../../package.json";

const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

describe("package.json", () => {
  it.each([
    ["dependencies", pkg.dependencies],
    ["devDependencies", pkg.devDependencies],
  ])("pins every entry in %s", (_, deps) => {
    const loose = Object.entries(deps).filter(([, version]) => !EXACT.test(version));
    expect(loose).toEqual([]);
  });
});

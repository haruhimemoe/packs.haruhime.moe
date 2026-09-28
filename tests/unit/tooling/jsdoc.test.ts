/**
 * @file tests/unit/tooling/jsdoc.test.ts
 * @desc AGENTS.md section 4: every exported function in src (components, pages and route
 *       handlers included) has a JSDoc block with @function and @returns.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
  });

/** A function declaration, an arrow function const, or a route method bound to a handler. */
const EXPORTED_FUNCTION =
  /^export (?:default )?(?:async )?function (\w+)|^export const (\w+)\s*(?::[^=\n]+)?=\s*(?:async\s*)?(?:\(|<[\w\s,]*>\s*\()|^export const (GET|POST|PUT|PATCH|DELETE)\s*=/gm;

const undocumented = (file: string): string[] => {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(EXPORTED_FUNCTION)].flatMap((match) => {
    const name = match[1] ?? match[2] ?? match[3] ?? "";
    const before = source.slice(0, match.index).trimEnd();
    const block = before.endsWith("*/") ? before.slice(before.lastIndexOf("/**")) : "";
    return block.includes(`@function ${name}`) && block.includes("@returns")
      ? []
      : [`${file}: ${name}`];
  });
};

describe("JSDoc on exported functions", () => {
  it("documents every one with @function and @returns", () => {
    expect(files("src").flatMap(undocumented)).toEqual([]);
  });

  it("sees the components, pages and route handlers it checks", () => {
    const seen = files("src").reduce(
      (count, file) => count + [...readFileSync(file, "utf8").matchAll(EXPORTED_FUNCTION)].length,
      0,
    );
    expect(seen).toBeGreaterThan(300);
  });
});

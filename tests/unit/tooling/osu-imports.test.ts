/**
 * @file tests/unit/tooling/osu-imports.test.ts
 * @desc Client code imports @haruhimemoe/osu/shapes only; the package root holds the osu! secret.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
  });

describe("osu! client stays on the server", () => {
  it("never imports the @haruhimemoe/osu root from client code", () => {
    const offenders = files("src").filter((file) => {
      const source = readFileSync(file, "utf8");
      const client =
        file.startsWith("src/components/") ||
        file.startsWith("src/hooks/") ||
        source.includes('"use client"');
      return client && /from "@haruhimemoe\/osu"/.test(source);
    });
    expect(offenders).toEqual([]);
  });
});

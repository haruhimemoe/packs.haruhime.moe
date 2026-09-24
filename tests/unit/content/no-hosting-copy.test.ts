/**
 * @file tests/unit/content/no-hosting-copy.test.ts
 * @desc "We don't store or host files" is said once in the UI (the footer); legal pages keep
 *       their full statements.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");
const PATTERN = /never\s+(stores|hosts)|straight\s+from\s+mirror|Nothing\s+gets\s+uploaded/i;

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
  });

describe("no-hosting copy", () => {
  it("appears in the footer and nowhere else in src", () => {
    const hits = files(SRC)
      .filter((file) => PATTERN.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file));
    expect(hits).toEqual(["src/components/layout/Footer.tsx"]);
  });
});

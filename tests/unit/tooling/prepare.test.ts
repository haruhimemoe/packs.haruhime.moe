/**
 * @file tests/unit/tooling/prepare.test.ts
 * @desc The `prepare` lifecycle script must not fail installs outside a git checkout (Vercel,
 *       Docker, a downloaded zip), where `lefthook install` exits 1.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("prepare script", () => {
  it("exits 0 in a directory that is not a git checkout", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "packs-prepare-"));
    try {
      const result = spawnSync("sh", ["-c", pkg.scripts.prepare ?? ""], {
        cwd: dir,
        env: {
          ...process.env,
          PATH: `${path.join(process.cwd(), "node_modules", ".bin")}:${process.env.PATH ?? ""}`,
        },
      });
      expect(result.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

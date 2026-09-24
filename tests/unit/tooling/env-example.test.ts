/**
 * @file tests/unit/tooling/env-example.test.ts
 * @desc .env.example documents every server variable and ships no secret values.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SERVER_ENV_KEYS } from "@/env";

const text = readFileSync(path.join(process.cwd(), ".env.example"), "utf8");

describe(".env.example", () => {
  it.each(SERVER_ENV_KEYS)("documents %s", (key) => {
    expect(text).toMatch(new RegExp(`^${key}=`, "m"));
  });

  it.each(["MONGODB_URI", "BETTER_AUTH_SECRET", "OSU_CLIENT_SECRET"])("leaves %s empty", (key) => {
    expect(text).toMatch(new RegExp(`^${key}=$`, "m"));
  });
});

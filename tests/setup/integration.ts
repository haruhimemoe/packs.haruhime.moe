/**
 * @file tests/setup/integration.ts
 * @desc Per-file setup for the integration project: a full fake server env pointing at the
 *       in-memory MongoDB, revalidation calls recorded, and after() work queued until a test
 *       flushes it (tests/helpers/after.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sat Oct 3, 2026
 */

import { stubOsuAppEnv } from "@haruhimemoe/next-kit/testing";
import { beforeEach, inject, vi } from "vitest";
import { clearAfter } from "../helpers/after";

// next-kit is linked via file:../next-kit for this branch, which carries its own node_modules
// (and its own vitest). TS then resolves "vitest" from next-kit's mongo.d.ts to that copy, so its
// `declare module "vitest" { interface ProvidedContext }` augments a different module instance
// than the one this file sees. Repeating the augmentation here keeps inject("mongoUri") typed
// against the vitest this project actually resolves. Safe to drop once next-kit is a registry
// dependency again.
declare module "vitest" {
  interface ProvidedContext {
    mongoUri: string;
  }
}

stubOsuAppEnv({ MONGODB_URI: inject("mongoUri") });
// CI sets SKIP_ENV_VALIDATION for the whole job (for `next build`); integration tests use a real
// in-memory database, so the public-list services must not take their "no database" path.
vi.stubEnv("SKIP_ENV_VALIDATION", "");

// revalidatePath needs Next's request store; tests assert the calls instead.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// after() needs Next's request store too. Queued work runs only when a test calls flushAfter().
vi.mock("next/server", async (importOriginal) => {
  const { queueAfter } = await import("../helpers/after");
  return { ...(await importOriginal<typeof import("next/server")>()), after: queueAfter };
});
beforeEach(clearAfter);

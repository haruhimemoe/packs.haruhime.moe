/**
 * @file tests/integration/lib/db.test.ts
 * @desc The shared Mongo connection: packs database, one client for better-auth and mongoose,
 *       idempotent connect, fresh client after close.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { afterAll, describe, expect, it } from "vitest";
import { closeDb, connectDb, DB_NAME, getDb, getModelConnection, getMongoClient } from "@/lib/db";

afterAll(closeDb);

describe("db", () => {
  it("uses the packs database", async () => {
    await connectDb();
    expect(DB_NAME).toBe("packs");
    expect(getDb().databaseName).toBe("packs");
    expect(getModelConnection().name).toBe("packs");
  });

  it("connects once however many callers race", async () => {
    await Promise.all([connectDb(), connectDb(), connectDb()]);
    expect(getModelConnection().readyState).toBe(1);
  });

  it("shares one client between better-auth and mongoose", async () => {
    await connectDb();
    expect(getModelConnection().getClient()).toBe(getMongoClient());
  });

  it("builds a fresh client after closeDb", async () => {
    await connectDb();
    const before = getMongoClient();
    await closeDb();
    await connectDb();
    expect(getMongoClient()).not.toBe(before);
    expect(getModelConnection().readyState).toBe(1);
  });

  it("gives up on an unreachable database after 5 seconds, not 30", () => {
    expect(getMongoClient().options.serverSelectionTimeoutMS).toBe(5000);
  });
});

/**
 * @file tests/setup/integration-global.ts
 * @desc Integration globalSetup: one in-memory MongoDB for the run (next-kit's startMemoryMongo),
 *       its URI handed to every test file as inject("mongoUri").
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

export { startMemoryMongo as default } from "@haruhimemoe/next-kit/testing";

/**
 * @file tests/setup/integration-global.ts
 * @desc Starts one in-memory MongoDB for the integration project and hands its URI to the test
 *       workers through Vitest's provide/inject.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

export default async function setup(project: TestProject) {
  const server = await MongoMemoryServer.create();
  project.provide("mongoUri", server.getUri());
  return async () => {
    await server.stop();
  };
}

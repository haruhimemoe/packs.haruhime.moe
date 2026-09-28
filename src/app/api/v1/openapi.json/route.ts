/**
 * @file src/app/api/v1/openapi.json/route.ts
 * @desc The /api/v1 OpenAPI 3.1 document, built at deploy time. No key needed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
 */

import { buildOpenApiDocument } from "@/lib/openapi";

export const dynamic = "force-static";

/**
 * @function GET
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 200
 */
export async function GET() {
  return Response.json(buildOpenApiDocument());
}

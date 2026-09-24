/**
 * @file tests/unit/lib/openapi.test.ts
 * @desc The OpenAPI document: 3.1, every v1 route present and backed by a handler, every $ref
 *       resolves, component schemas are the handlers' own zod schemas, pack objects document their
 *       optional stats (never part of a body), both pack lists are paged, and PUT and DELETE describe
 *       their 404 as "not yours".
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { API_OPERATIONS, buildOpenApiDocument } from "@/lib/openapi";
import { apiPackSchema } from "@/schemas/api";
import { packInputSchema } from "@/schemas/saved-pack";

const ROUTE_MODULES: Record<string, () => Promise<Record<string, unknown>>> = {
  "/me": () => import("@/app/api/v1/me/route"),
  "/me/packs": () => import("@/app/api/v1/me/packs/route"),
  "/packs": () => import("@/app/api/v1/packs/route"),
  "/packs/{slug}": () => import("@/app/api/v1/packs/[slug]/route"),
};

const refsIn = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(refsIn);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      key === "$ref" && typeof child === "string" ? [child] : refsIn(child),
    );
  }
  return [];
};

const resolve = (doc: unknown, pointer: string): unknown =>
  pointer
    .replace(/^#\//, "")
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce<unknown>(
      (node, key) =>
        node !== null && typeof node === "object"
          ? (node as Record<string, unknown>)[key]
          : undefined,
      doc,
    );

type PackSchema = {
  required: string[];
  properties: Record<
    string,
    { description?: string; properties?: Record<string, { description?: string }> }
  >;
};

const withoutDialect = (schema: z.ZodType, io: "input" | "output") => {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, { target: "draft-2020-12", io });
  return rest;
};

describe("buildOpenApiDocument", () => {
  const doc = buildOpenApiDocument();

  it("is OpenAPI 3.1 on the v1 server with bearer auth", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers).toEqual([{ url: "https://packs.haruhime.moe/api/v1" }]);
    expect(doc.security).toEqual([{ apiKey: [] }]);
    expect(doc.components.securitySchemes.apiKey).toMatchObject({ type: "http", scheme: "bearer" });
  });

  it("lists exactly the seven v1 operations", () => {
    const listed = Object.entries(doc.paths)
      .flatMap(([path, ops]) => Object.keys(ops).map((method) => `${method.toUpperCase()} ${path}`))
      .sort();
    expect(listed).toEqual([
      "DELETE /packs/{slug}",
      "GET /me",
      "GET /me/packs",
      "GET /packs",
      "GET /packs/{slug}",
      "POST /packs",
      "PUT /packs/{slug}",
    ]);
  });

  it.each(API_OPERATIONS.map((op) => [op.method.toUpperCase(), op.path] as const))(
    "%s %s has a route handler",
    async (method, path) => {
      const load = ROUTE_MODULES[path];
      if (!load) throw new Error(`no route module mapped for ${path}`);
      expect(typeof (await load())[method]).toBe("function");
    },
  );

  it("resolves every $ref", () => {
    const refs = refsIn(doc);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref.startsWith("#/components/")).toBe(true);
      expect(resolve(doc, ref), ref).toBeDefined();
    }
  });

  it("builds component schemas from the handlers' zod schemas", () => {
    expect(doc.components.schemas.PackInput).toEqual(withoutDialect(packInputSchema, "input"));
    expect(
      (doc.components.schemas.PackResponse as { properties: { pack: unknown } }).properties.pack,
    ).toEqual(withoutDialect(apiPackSchema, "output"));
  });

  it("documents the optional stats on every pack, and never takes them in a body", () => {
    const pack = (doc.components.schemas.PackResponse as { properties: { pack: PackSchema } })
      .properties.pack;
    expect(pack.required).not.toContain("stats");
    expect(pack.properties.stats?.description).toContain("computed on the server after a save");
    expect(Object.keys(pack.properties.stats?.properties ?? {})).toEqual([
      "srMin",
      "srMax",
      "srAvg",
      "lenMin",
      "lenMax",
      "bpmMin",
      "bpmMax",
      "mods",
      "modes",
      "count",
      "complete",
      "computedAt",
    ]);
    expect(pack.properties.stats?.properties?.complete?.description).toContain(
      "A map osu! says doesn't exist is left out and doesn't count.",
    );
    const input = doc.components.schemas.PackInput as { properties: Record<string, unknown> };
    expect(input.properties).not.toHaveProperty("stats");
  });

  it("carries no $schema or $defs inside components", () => {
    const text = JSON.stringify(doc.components);
    expect(text).not.toContain("$schema");
    expect(text).not.toContain("$defs");
  });

  it("gives every operation a unique id and documents 401, 429 and 500", () => {
    const ops = Object.values(doc.paths).flatMap((ops) => Object.values(ops)) as {
      operationId: string;
      responses: Record<string, unknown>;
    }[];
    expect(new Set(ops.map((op) => op.operationId)).size).toBe(ops.length);
    for (const op of ops) {
      expect(Object.keys(op.responses)).toEqual(expect.arrayContaining(["401", "429", "500"]));
      expect(op.responses["500"]).toMatchObject({
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      });
    }
  });

  it.each(["/packs", "/me/packs"])("pages GET %s with ?page= and the page envelope", (path) => {
    const op = (doc.paths[path] as Record<string, Record<string, unknown>>).get as {
      parameters: { name: string; in: string }[];
      responses: Record<string, unknown>;
    };
    expect(op.parameters).toContainEqual(expect.objectContaining({ name: "page", in: "query" }));
    expect(op.responses["200"]).toMatchObject({
      content: {
        "application/json": { schema: { $ref: "#/components/schemas/PackPageResponse" } },
      },
    });
    expect(Object.keys(op.responses)).toContain("400");
  });

  it("says PUT and DELETE answer 404 for any pack that isn't yours, and GET only for hidden ones", () => {
    const slugOps = doc.paths["/packs/{slug}"] as Record<
      string,
      { responses: Record<string, { description: string }> }
    >;
    expect(slugOps.put?.responses["404"]?.description).toBe(
      "The pack doesn't exist or isn't yours.",
    );
    expect(slugOps.delete?.responses["404"]?.description).toBe(
      "The pack doesn't exist or isn't yours.",
    );
    expect(slugOps.get?.responses["404"]?.description).toBe(
      "The pack doesn't exist, or it's private or hidden and not yours.",
    );
  });

  it("round-trips through JSON", () => {
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });
});

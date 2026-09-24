/**
 * @file tests/unit/lib/openapi.test.ts
 * @desc The OpenAPI document: 3.1, every v1 route present and backed by a handler, every $ref
 *       resolves, component schemas are the handlers' own zod schemas, pack objects document their
 *       optional stats (never part of a body), both pack lists are paged, and the map usage reads
 *       need no key, take their id or ids, and document their cache header.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { API_OPERATIONS, buildOpenApiDocument } from "@/lib/openapi";
import { apiPackSchema } from "@/schemas/api";
import { beatmapUsageListSchema, beatmapUsageSchema } from "@/schemas/map-usage";
import { packInputSchema } from "@/schemas/saved-pack";

const ROUTE_MODULES: Record<string, () => Promise<Record<string, unknown>>> = {
  "/me": () => import("@/app/api/v1/me/route"),
  "/me/packs": () => import("@/app/api/v1/me/packs/route"),
  "/packs": () => import("@/app/api/v1/packs/route"),
  "/packs/{slug}": () => import("@/app/api/v1/packs/[slug]/route"),
  "/beatmaps/{id}/usage": () => import("@/app/api/v1/beatmaps/[id]/usage/route"),
  "/beatmaps/usage": () => import("@/app/api/v1/beatmaps/usage/route"),
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

  it("lists exactly the nine v1 operations", () => {
    const listed = Object.entries(doc.paths)
      .flatMap(([path, ops]) => Object.keys(ops).map((method) => `${method.toUpperCase()} ${path}`))
      .sort();
    expect(listed).toEqual([
      "DELETE /packs/{slug}",
      "GET /beatmaps/usage",
      "GET /beatmaps/{id}/usage",
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

  it("gives every operation a unique id and documents 429 and 500, and 401 when it needs a key", () => {
    const ops = Object.values(doc.paths).flatMap((ops) => Object.values(ops)) as {
      operationId: string;
      security?: unknown[];
      responses: Record<string, unknown>;
    }[];
    expect(new Set(ops.map((op) => op.operationId)).size).toBe(ops.length);
    for (const op of ops) {
      expect(Object.keys(op.responses)).toEqual(expect.arrayContaining(["429", "500"]));
      if (op.security?.length === 0) expect(op.responses).not.toHaveProperty("401");
      else expect(op.responses).toHaveProperty("401");
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

  describe("map usage", () => {
    type Operation = {
      security?: unknown[];
      parameters: { name: string; in: string; required: boolean }[];
      responses: Record<string, { headers?: Record<string, unknown>; content?: unknown }>;
    };
    const op = (path: string) =>
      (doc.paths[path] as Record<string, Operation> | undefined)?.get as Operation;

    it.each(["/beatmaps/{id}/usage", "/beatmaps/usage"])("GET %s needs no key", (path) => {
      expect(op(path).security).toEqual([]);
      expect(Object.keys(op(path).responses).sort()).toEqual(["200", "400", "429", "500"]);
    });

    it("takes the id in the path, or the ids in the query", () => {
      expect(op("/beatmaps/{id}/usage").parameters).toEqual([
        expect.objectContaining({ name: "id", in: "path", required: true }),
      ]);
      expect(op("/beatmaps/usage").parameters).toEqual([
        expect.objectContaining({ name: "ids", in: "query", required: true }),
      ]);
    });

    it("documents Cache-Control instead of rate-limit headers on a success", () => {
      const ok = op("/beatmaps/usage").responses["200"];
      expect(ok?.headers).toEqual({
        "Cache-Control": { $ref: "#/components/headers/Cache-Control" },
      });
      expect(op("/beatmaps/usage").responses["400"]?.headers).toEqual({});
      expect(op("/beatmaps/usage").responses["429"]?.headers).toHaveProperty("Retry-After");
    });

    it("answers with the routes' own zod schemas", () => {
      expect(doc.components.schemas.BeatmapUsageResponse).toEqual(
        withoutDialect(beatmapUsageSchema, "output"),
      );
      expect(doc.components.schemas.BeatmapUsageListResponse).toEqual(
        withoutDialect(beatmapUsageListSchema, "output"),
      );
      expect(op("/beatmaps/{id}/usage").responses["200"]?.content).toEqual({
        "application/json": { schema: { $ref: "#/components/schemas/BeatmapUsageResponse" } },
      });
    });

    it("says in the description that map usage needs no key", () => {
      expect(doc.info.description).toContain("Map usage needs no key: 60 requests a minute per IP");
    });
  });

  it("round-trips through JSON", () => {
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });
});

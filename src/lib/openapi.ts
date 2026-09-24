/**
 * @file src/lib/openapi.ts
 * @desc The /api/v1 OpenAPI 3.1 document. Schemas come from the same zod schemas the handlers
 *       validate with and answer in (z.toJSONSchema, JSON Schema 2020-12, which OpenAPI 3.1 uses
 *       as-is); paths come from API_OPERATIONS. The published spec can't drift from the code.
 *       PUT and DELETE describe their 404 as "not yours", since they refuse every pack the key's
 *       owner doesn't own.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import { z } from "zod";
import { API_DOCS_PATH, API_PAGE_SIZE, RATE_LIMITS } from "@/constants/api";
import { SITE } from "@/constants/site";
import {
  apiErrorSchema,
  apiMeResponseSchema,
  apiPackPageResponseSchema,
  apiPackResponseSchema,
} from "@/schemas/api";
import { packInputSchema, slugSchema } from "@/schemas/saved-pack";

type JsonObject = Record<string, unknown>;
type Io = "input" | "output";

/** Request bodies are "input" (defaults optional); responses are "output". */
export const API_SCHEMAS = {
  MeResponse: { schema: apiMeResponseSchema, io: "output" },
  PackResponse: { schema: apiPackResponseSchema, io: "output" },
  PackPageResponse: { schema: apiPackPageResponseSchema, io: "output" },
  PackInput: { schema: packInputSchema, io: "input" },
  Error: { schema: apiErrorSchema, io: "output" },
} as const satisfies Record<string, { schema: z.ZodType; io: Io }>;

export type ApiSchemaName = keyof typeof API_SCHEMAS;

type ErrorStatus = 400 | 401 | 404 | 409 | 413 | 415 | 429 | 500;

export type ApiOperation = {
  operationId: string;
  method: "get" | "post" | "put" | "delete";
  /** Under /api/v1, in OpenAPI template syntax. */
  path: string;
  summary: string;
  paged?: boolean;
  body?: ApiSchemaName;
  success: { status: 200 | 201 | 204; description: string; schema?: ApiSchemaName };
  /** Every operation can also answer 500; operation() adds it. */
  errors: readonly Exclude<ErrorStatus, 500>[];
  /** The 404's description when it differs from ERROR_DESCRIPTIONS (writes: any pack not yours). */
  notFound?: string;
};

const NOT_YOURS = "The pack doesn't exist or isn't yours.";

export const API_OPERATIONS: readonly ApiOperation[] = [
  {
    operationId: "getMe",
    method: "get",
    path: "/me",
    summary: "Who the API key belongs to",
    success: { status: 200, description: "The key's owner.", schema: "MeResponse" },
    errors: [401, 429],
  },
  {
    operationId: "listMyPacks",
    method: "get",
    path: "/me/packs",
    summary: `Your packs, any visibility, ${API_PAGE_SIZE} a page`,
    paged: true,
    success: { status: 200, description: "One page of your packs.", schema: "PackPageResponse" },
    errors: [400, 401, 429],
  },
  {
    operationId: "listPublicPacks",
    method: "get",
    path: "/packs",
    summary: `Public packs, most recently updated first, ${API_PAGE_SIZE} a page`,
    paged: true,
    success: { status: 200, description: "One page of public packs.", schema: "PackPageResponse" },
    errors: [400, 401, 429],
  },
  {
    operationId: "createPack",
    method: "post",
    path: "/packs",
    summary: "Save a new pack",
    body: "PackInput",
    success: { status: 201, description: "The saved pack.", schema: "PackResponse" },
    errors: [400, 401, 409, 413, 415, 429],
  },
  {
    operationId: "getPack",
    method: "get",
    path: "/packs/{slug}",
    summary: "One pack (private and hidden packs only for their owner)",
    success: { status: 200, description: "The pack.", schema: "PackResponse" },
    errors: [401, 404, 429],
  },
  {
    operationId: "updatePack",
    method: "put",
    path: "/packs/{slug}",
    summary: "Replace one of your packs",
    body: "PackInput",
    success: { status: 200, description: "The updated pack.", schema: "PackResponse" },
    errors: [400, 401, 404, 413, 415, 429],
    notFound: NOT_YOURS,
  },
  {
    operationId: "deletePack",
    method: "delete",
    path: "/packs/{slug}",
    summary: "Delete one of your packs",
    success: { status: 204, description: "Deleted." },
    errors: [401, 404, 429],
    notFound: NOT_YOURS,
  },
];

const ERROR_DESCRIPTIONS: Record<ErrorStatus, string> = {
  400: "The body or a query parameter isn't valid.",
  401: "No API key, or the key isn't valid (code unauthorized or invalid_api_key).",
  404: "The pack doesn't exist, or it's private or hidden and not yours.",
  409: "You already have the most packs one account can keep.",
  413: "The body is too large.",
  415: "The body isn't application/json.",
  429: "Over a rate limit. Wait Retry-After seconds.",
  500: "Something failed on our side. Try again later.",
};

/** OpenAPI 3.1 schema objects are JSON Schema 2020-12; only the top-level $schema must go. */
const jsonSchema = (schema: z.ZodType, io: Io): JsonObject => {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
  }) as JsonObject;
  return rest;
};

const ref = (name: ApiSchemaName) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: ApiSchemaName) => ({ "application/json": { schema: ref(name) } });

const RATE_HEADERS = {
  "RateLimit-Limit": { $ref: "#/components/headers/RateLimit-Limit" },
  "RateLimit-Remaining": { $ref: "#/components/headers/RateLimit-Remaining" },
  "RateLimit-Reset": { $ref: "#/components/headers/RateLimit-Reset" },
};

const operation = (op: ApiOperation): JsonObject => ({
  operationId: op.operationId,
  summary: op.summary,
  parameters: [
    ...(op.path.includes("{slug}")
      ? [{ name: "slug", in: "path", required: true, schema: jsonSchema(slugSchema, "output") }]
      : []),
    ...(op.paged
      ? [
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 999999, default: 1 },
          },
        ]
      : []),
  ],
  ...(op.body ? { requestBody: { required: true, content: json(op.body) } } : {}),
  responses: {
    [op.success.status]: {
      description: op.success.description,
      headers: RATE_HEADERS,
      ...(op.success.schema ? { content: json(op.success.schema) } : {}),
    },
    ...Object.fromEntries(
      [...op.errors, 500 as const].map((status) => [
        status,
        {
          description: (status === 404 && op.notFound) || ERROR_DESCRIPTIONS[status],
          headers:
            status === 429
              ? { ...RATE_HEADERS, "Retry-After": { $ref: "#/components/headers/Retry-After" } }
              : RATE_HEADERS,
          content: json("Error"),
        },
      ]),
    ),
  },
});

const integerHeader = (description: string) => ({ description, schema: { type: "integer" } });

/**
 * @function buildOpenApiDocument
 * @returns {object} the OpenAPI 3.1 document for /api/v1
 */
export const buildOpenApiDocument = () => {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of API_OPERATIONS) {
    paths[op.path] ??= {};
    (paths[op.path] as Record<string, unknown>)[op.method] = operation(op);
  }
  return {
    openapi: "3.1.0" as const,
    info: {
      title: `${SITE.title} API`,
      version: "1",
      description: `Read public packs and manage your own with a personal API key. ${RATE_LIMITS.api.limit} requests and ${RATE_LIMITS.apiWrite.limit} writes a minute per account. Docs: ${SITE.url}${API_DOCS_PATH}`,
      contact: { email: SITE.contactEmail },
    },
    servers: [{ url: `${SITE.url}/api/v1` }],
    security: [{ apiKey: [] }],
    paths,
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          description: "Your personal API key (hpk_...), from your account page.",
        },
      },
      schemas: Object.fromEntries(
        Object.entries(API_SCHEMAS).map(([name, { schema, io }]) => [name, jsonSchema(schema, io)]),
      ) as Record<ApiSchemaName, JsonObject>,
      headers: {
        "RateLimit-Limit": integerHeader("Requests allowed in the current window."),
        "RateLimit-Remaining": integerHeader("Requests left in the current window."),
        "RateLimit-Reset": integerHeader("Seconds until the window starts over."),
        "Retry-After": integerHeader("Seconds to wait before trying again."),
      },
    },
  };
};

export type OpenApiDocument = ReturnType<typeof buildOpenApiDocument>;

/**
 * @file src/lib/db.ts
 * @desc One MongoClient per process, built on first use (never at import, so builds and
 *       anonymous pages need no database env). better-auth reads getDb(); mongoose models live on
 *       getModelConnection(), which connectDb() attaches to the same client, so M0 sees one pool.
 *       State sits on globalThis so Next dev reloads don't leak clients.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { type Db, MongoClient } from "mongodb";
import mongoose, { type Connection } from "mongoose";
import { getDatabaseUri } from "@/env";
import { ensureIndexes } from "@/lib/db-indexes";

export const DB_NAME = "packs";

/** Vercel runs many function instances against one M0 cluster (500 connections max). */
const MAX_POOL_SIZE = 5;
const SERVER_SELECTION_TIMEOUT_MS = 5000;

type MongoState = {
  client: MongoClient;
  /** Unscoped mongoose connection that setClient() attaches to the shared client. */
  base: Connection;
  /** The same connection scoped to DB_NAME (MongoClientOptions has no dbName; the URI has no path). */
  models: Connection;
  ready: Promise<void> | null;
};

const store = globalThis as typeof globalThis & { __packsMongo?: MongoState };

const createState = (): MongoState => {
  const client = new MongoClient(getDatabaseUri(), {
    maxPoolSize: MAX_POOL_SIZE,
    // Fail fast when the cluster is unreachable: a hung function is billed for every second.
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
  });
  const base = mongoose.createConnection();
  // Connection#useDb, not a React hook.
  const models = base.useDb(DB_NAME, { useCache: true });
  return { client, base, models, ready: null };
};

const state = (): MongoState => {
  store.__packsMongo ??= createState();
  return store.__packsMongo;
};

/**
 * @function getMongoClient
 * @returns {MongoClient} the shared client (connects lazily on first operation)
 */
export const getMongoClient = (): MongoClient => state().client;

/**
 * @function getDb
 * @returns {Db} the packs database on the shared client
 */
export const getDb = (): Db => state().client.db(DB_NAME);

/**
 * @function getModelConnection
 * @returns {Connection} the mongoose connection models register on (usable after connectDb)
 */
export const getModelConnection = (): Connection => state().models;

/**
 * @function connectDb
 * @returns {Promise<void>} resolves once the client is connected, mongoose is attached, and our
 *          indexes exist
 */
export const connectDb = async (): Promise<void> => {
  const current = state();
  current.ready ??= current.client.connect().then(async () => {
    if (current.base.readyState === 0) current.base.setClient(current.client);
    await ensureIndexes(current.client.db(DB_NAME));
  });
  try {
    await current.ready;
  } catch (error) {
    // Never cache a failure: one DNS blip on the Atlas SRV lookup must not poison the process.
    current.ready = null;
    throw error;
  }
};

/**
 * @function connectedDb
 * @returns {Promise<Db>} the packs database once connectDb has resolved (the default db dep for
 *          services that talk to the driver directly)
 */
export const connectedDb = async (): Promise<Db> => {
  await connectDb();
  return getDb();
};

/**
 * @function closeDb
 * @returns {Promise<void>} closes the client and forgets it (tests; graceful shutdown)
 */
export const closeDb = async (): Promise<void> => {
  const current = store.__packsMongo;
  if (!current) return;
  store.__packsMongo = undefined;
  await current.client.close();
};

/**
 * @file src/models/Pack.ts
 * @desc Saved pack model (collection "packs"): identity (name, slots, bucket list), description, export links,
 *       owner, visibility, moderation flag, timestamps.
 *       Registered lazily on the shared connection so importing it needs no env.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { type Connection, Schema } from "mongoose";
import { getModelConnection } from "@/lib/db";
import { VISIBILITIES } from "@/schemas/saved-pack";

// Validation is zod's job (packInputSchema); the model only stores what the API accepted.
const slotSchema = new Schema(
  {
    mod: { type: String, default: null },
    index: { type: Number, required: true },
    beatmapId: { type: Number, required: true },
  },
  { _id: false },
);

const bucketSchema = new Schema(
  {
    code: { type: String, required: true },
    color: { type: Number },
    // Custom slots only: { kind: "forced", set: [...] } or { kind: "free" }. Absent = no mods.
    // Mixed, not a sub-schema: a subdocument path named "set" would shadow Document#set.
    mods: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const exportSchema = new Schema(
  {
    kind: { type: String, required: true },
    url: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const packSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    slots: { type: [slotSchema], required: true },
    // Absent = the six built-ins in default order. `default: undefined` so Mongoose doesn't
    // create an empty array (an empty list isn't a valid bucket list).
    buckets: { type: [bucketSchema], default: undefined },
    // Saved packs only (keys never carry it). Absent = no description.
    description: { type: String },
    // Magnet links the owner recorded, newest first (≤ MAX_PACK_EXPORTS). Absent = none.
    exports: { type: [exportSchema], default: undefined },
    // Bumped by every export-link write, so concurrent writes can detect each other.
    exportsRev: { type: Number },
    // Set by a moderator: off /packs, and 404 for everyone but the owner and admins.
    hiddenAt: { type: Date },
    hiddenBy: { type: Schema.Types.ObjectId },
    visibility: { type: String, enum: [...VISIBILITIES], required: true },
  },
  { timestamps: true, collection: "packs" },
);

packSchema.index({ ownerId: 1, updatedAt: -1 });
packSchema.index({ visibility: 1, updatedAt: -1 });

const register = (connection: Connection) => connection.model("Pack", packSchema);

type PackModel = ReturnType<typeof register>;

/**
 * @function getPackModel
 * @returns {PackModel} the Pack model on the shared connection (registered once)
 */
export const getPackModel = (): PackModel => {
  const connection = getModelConnection();
  return (connection.models.Pack as PackModel | undefined) ?? register(connection);
};

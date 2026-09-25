/**
 * @file src/lib/collections/collection-files.ts
 * @desc The files behind the "Add to osu! collection" card, made in the browser: reading the
 *       collection.db a player picks (its size checked before it loads) and the edited
 *       collection.db handed back to osu!stable. Browser-only; nothing here sends or keeps a file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import {
  type CollectionDb,
  CollectionDbError,
  type CollectionDbRead,
  MAX_COLLECTION_DB_BYTES,
  readCollectionDb,
  writeCollectionDb,
} from "@haruhimemoe/osu/collections";

/**
 * @function readCollectionFile
 * @param file {Blob} the file the player picked
 * @param maxBytes {number} the largest file accepted (default MAX_COLLECTION_DB_BYTES, 64 MiB)
 * @returns {Promise<CollectionDbRead>} the database and the reader's warnings
 * @throws {CollectionDbError} too_large before loading a file over maxBytes, or whatever the
 *         strict reader finds wrong with it (too_large as well when its counts claim more than
 *         maxBytes / 34 collections plus hashes)
 */
export const readCollectionFile = async (
  file: Blob,
  maxBytes: number = MAX_COLLECTION_DB_BYTES,
): Promise<CollectionDbRead> => {
  if (file.size > maxBytes) {
    throw new CollectionDbError("too_large", `the file is over ${maxBytes} bytes`);
  }
  return readCollectionDb(new Uint8Array(await file.arrayBuffer()), { maxBytes });
};

/**
 * @function stableCollectionFile
 * @param db {CollectionDb} the edited database
 * @returns {Blob} the whole collection.db, every collection and hash included
 * @throws {CollectionDbError} whatever writeCollectionDb throws
 */
export const stableCollectionFile = (db: CollectionDb): Blob =>
  new Blob([writeCollectionDb(db)], { type: "application/octet-stream" });

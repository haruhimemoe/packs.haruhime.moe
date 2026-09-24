/**
 * @file scripts/archive-import.ts
 * @desc `bun run archive:import otdb [--dry-run] [--file <path>]`: imports past tournament pools
 *       as archive packs (src/lib/archive-import.ts does the work). Connects with MONGODB_URI
 *       from the environment; set CRON_SECRET too to refresh the live /packs afterwards. Runs
 *       with the react-server condition (package.json), so server-only modules load outside Next.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { runArchiveImport } from "@/lib/archive-import";
import { closeDb } from "@/lib/db";

const code = await runArchiveImport(process.argv.slice(2));
await closeDb();
process.exit(code);

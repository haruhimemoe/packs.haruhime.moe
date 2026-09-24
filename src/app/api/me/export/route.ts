/**
 * @file src/app/api/me/export/route.ts
 * @desc GET: "Download my data". The caller's account data as a JSON attachment named
 *       packs-data-{username}-{yyyy-mm-dd}.json. Signed-in only; never cached anywhere.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { jsonError } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { exportAccountData } from "@/services/account-export";
import { accountExportFileName } from "@/utils/account-export";

export async function GET(request: Request) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) {
    const response = jsonError(401, "Sign in with osu! to download your data.");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  const data = await exportAccountData(user.id);
  const fileName = accountExportFileName(data.user.username, new Date(data.exportedAt));
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

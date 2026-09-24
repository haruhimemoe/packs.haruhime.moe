/**
 * @file src/app/(protected)/admin/page.tsx
 * @desc /admin: moderation for admins (ADMIN_OSU_IDS). Everyone else gets the site 404, so the
 *       page never confirms it exists. Dynamic: admin traffic only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { RestoreSignedIn } from "@/components/auth/RestoreSignedIn";
import { MAX_NAME_LENGTH } from "@/constants/pack";
import { requireUser } from "@/lib/auth-session";
import { listPacksForAdmin } from "@/services/moderation";
import { parsePageParam } from "@/utils/paging";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? "";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireUser("/admin");
  if (!user.isAdmin) notFound();
  const params = await searchParams;
  const page = parsePageParam(first(params.page)) ?? 1;
  const hiddenOnly = first(params.show) === "hidden";
  const query = first(params.q).trim().slice(0, MAX_NAME_LENGTH);
  const result = await listPacksForAdmin({ page, hiddenOnly, query });
  return (
    <>
      <RestoreSignedIn />
      <AdminScreen {...result} hiddenOnly={hiddenOnly} query={query} />
    </>
  );
}

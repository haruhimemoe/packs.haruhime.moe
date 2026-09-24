/**
 * @file src/app/(protected)/p/[slug]/edit/page.tsx
 * @desc Edit a saved pack. Anyone but the owner gets a 404.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SavedPackEditor } from "@/components/pack/SavedPackEditor";
import { requireUser } from "@/lib/auth-session";
import { getPackForViewer } from "@/services/packs";

export const metadata: Metadata = { title: "Edit pack", robots: { index: false } };

export default async function EditPackPage({ params }: PageProps<"/p/[slug]/edit">) {
  const { slug } = await params;
  const user = await requireUser(`/p/${slug}/edit`);
  const found = await getPackForViewer(slug, user.id);
  if (!found?.isOwner) notFound();
  return <SavedPackEditor pack={found.pack} />;
}

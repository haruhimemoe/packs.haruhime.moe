/**
 * @file src/app/(auth)/signin/page.tsx
 * @desc /signin?next=: osu! sign-in. Signed-in visitors go straight to `next`.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { Metadata } from "next";
import Link from "next/link";
import { RestoreSignedIn } from "@/components/auth/RestoreSignedIn";
import { SignInWithOsu } from "@/components/auth/SignInWithOsu";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentUser } from "@/lib/auth-session";
import { safeNextPath } from "@/utils/safe-next";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  // Already signed in: continue to `next` through the browser, so a session without the readable
  // signed-in marker gets it (and the header catches up) on the way.
  if (await getCurrentUser()) return <RestoreSignedIn next={next} />;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-10 text-center">
      <PageHeader
        title="Sign in"
        lead="Sign in with your osu! account to save packs and get short links you can edit later. Building packs, sharing keys, and exporting all work without an account."
        className="justify-center text-center"
      />
      {params.error !== undefined ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          Sign-in didn't finish. Try again.
        </p>
      ) : null}
      <SignInWithOsu next={next} />
      <p className="text-c4 text-xs">
        We keep your osu! id, username, avatar, and country. See the{" "}
        <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-c1">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}

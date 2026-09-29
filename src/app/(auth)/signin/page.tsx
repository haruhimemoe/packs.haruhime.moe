/**
 * @file src/app/(auth)/signin/page.tsx
 * @desc /signin?next=: osu! sign-in. Signed-in visitors go straight to `next`.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { safeNextPath } from "@haruhimemoe/next-kit/server";
import { Notice, PageHeader, TextLink } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { SEO_SITE } from "@/constants/seo";
import { DEFAULT_AFTER_SIGN_IN } from "@/constants/site";
import { RestoreSignedIn, SignInWithOsu } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth-session";

export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/signin",
  title: "Sign in",
  index: false,
});

/**
 * @function SignInPage
 * @param props {PageProps<"/signin">} searchParams
 * @returns {Promise<JSX.Element>} the page
 */
export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, {
    fallback: DEFAULT_AFTER_SIGN_IN,
  });
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
        <Notice tone="error" live className="font-bold">
          Sign-in didn't finish. Try again.
        </Notice>
      ) : null}
      <SignInWithOsu next={next} />
      <p className="text-c4 text-xs">
        We keep your osu! id, username, avatar, and country. See the{" "}
        <TextLink href="/legal/privacy">privacy policy</TextLink>.
      </p>
    </div>
  );
}

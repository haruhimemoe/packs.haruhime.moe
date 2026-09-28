/**
 * @file src/components/auth/SignOutButton.tsx
 * @desc Signs out, returns home, and refreshes server components.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { markSignedOut } from "@/lib/account";
import { authClient } from "@/lib/auth-client";

const defaultSignOut = async (): Promise<void> => {
  await authClient.signOut();
};

/**
 * @function SignOutButton
 * @param props {{ signOut? }} how to sign out (a test seam)
 * @returns {JSX.Element} the Sign out button
 */
export function SignOutButton({ signOut = defaultSignOut }: { signOut?: () => Promise<void> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    setPending(true);
    // Only forget the marker once the session is really gone.
    await signOut().then(markSignedOut, () => undefined);
    router.replace("/");
    router.refresh();
  };

  return (
    <Button variant="secondary" onClick={onClick} disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

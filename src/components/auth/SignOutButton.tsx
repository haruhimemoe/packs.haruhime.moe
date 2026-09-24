/**
 * @file src/components/auth/SignOutButton.tsx
 * @desc Signs out, returns home, and refreshes server components.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { markSignedOut } from "@/hooks/useAccount";
import { authClient } from "@/lib/auth-client";

const defaultSignOut = async (): Promise<void> => {
  await authClient.signOut();
};

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

/**
 * @file src/components/account/SignOutButton.tsx
 * @desc /me's Sign out: signOut (src/lib/account.ts) ends the haruhime.moe session through POST
 *       /api/signout and refreshes the page in place, never leaving packs. A failure says so under
 *       the button.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

"use client";

import { Button, Text } from "@haruhimemoe/ui";
import { useState } from "react";
import { signOut as defaultSignOut } from "@/lib/account";

/**
 * @function SignOutButton
 * @param props {{ signOut?: () => Promise<void> }} the sign-out to run (a test seam)
 * @returns {JSX.Element} the Sign out button
 */
export function SignOutButton({ signOut = defaultSignOut }: { signOut?: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "pending" | "failed">("idle");
  const run = async () => {
    setState("pending");
    try {
      await signOut();
    } catch {
      setState("failed");
    }
  };
  return (
    <span className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={run} disabled={state === "pending"}>
        {state === "pending" ? "Signing out…" : "Sign out"}
      </Button>
      {state === "failed" ? (
        <Text role="alert" tone="error" className="text-xs">
          Couldn't sign out. Try again.
        </Text>
      ) : null}
    </span>
  );
}

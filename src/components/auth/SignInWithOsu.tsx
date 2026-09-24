/**
 * @file src/components/auth/SignInWithOsu.tsx
 * @desc "Sign in with osu!": starts the OAuth redirect, then lands on `next`.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { OSU_PROVIDER_ID } from "@/constants/auth";
import { authClient } from "@/lib/auth-client";

const startOsuSignIn = async (next: string): Promise<void> => {
  // genericOAuth providers register as social providers in better-auth 1.7.
  const { error } = await authClient.signIn.social({
    provider: OSU_PROVIDER_ID,
    callbackURL: next,
    errorCallbackURL: "/signin?error=oauth",
  });
  if (error) throw new Error(error.message ?? "Couldn't start osu! sign-in. Try again.");
};

type SignInWithOsuProps = { next: string; start?: (next: string) => Promise<void> };

export function SignInWithOsu({ next, start = startOsuSignIn }: SignInWithOsuProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setPending(true);
    setError(null);
    try {
      await start(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't start osu! sign-in. Try again.");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button size="lg" onClick={onClick} disabled={pending}>
        {pending ? "Opening osu!…" : "Sign in with osu!"}
      </Button>
      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

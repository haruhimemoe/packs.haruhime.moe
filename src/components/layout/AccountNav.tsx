/**
 * @file src/components/layout/AccountNav.tsx
 * @desc Header account area. Client-side so static pages stay static; the session is fetched
 *       after load.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { useAccount } from "@/hooks/useAccount";

export function AccountNav() {
  const account = useAccount();

  if (account.status === "loading") return <span aria-hidden="true" className="block h-7 w-16" />;

  if (account.status === "signed-out") {
    return (
      <Link href="/signin" className="font-bold text-c3 text-sm transition-colors hover:text-c1">
        Sign in
      </Link>
    );
  }

  return (
    <Link
      href="/me"
      className="flex items-center gap-2 font-bold text-c1 text-sm transition-colors hover:text-h1"
    >
      {account.user.avatarUrl ? (
        <Image
          src={account.user.avatarUrl}
          alt=""
          width={28}
          height={28}
          className="rounded-full"
        />
      ) : null}
      <span>{account.user.username}</span>
    </Link>
  );
}

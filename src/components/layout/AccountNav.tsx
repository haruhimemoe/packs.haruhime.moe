/**
 * @file src/components/layout/AccountNav.tsx
 * @desc Header account area. Client-side so static pages stay static; the session is fetched
 *       after load.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import { textClasses } from "@haruhimemoe/ui";
import Image from "next/image";
import Link from "next/link";
import { useAccount } from "@/lib/account";

/**
 * @function AccountNav
 * @returns {JSX.Element} header account area
 */
export function AccountNav() {
  const account = useAccount();

  if (account.status === "loading") return <span aria-hidden="true" className="block h-7 w-16" />;

  if (account.status === "signed-out") {
    return (
      <Link
        href="/signin"
        className={textClasses({
          tone: "muted",
          bold: true,
          className:
            "inline-flex coarse:min-h-11 min-h-6 items-center transition-colors hover:text-c1",
        })}
      >
        Sign in
      </Link>
    );
  }

  return (
    <Link
      href="/me"
      className="flex coarse:min-h-11 min-h-6 items-center gap-2 font-bold text-c1 text-sm transition-colors hover:text-h1"
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

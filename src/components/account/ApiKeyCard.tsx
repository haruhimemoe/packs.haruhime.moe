/**
 * @file src/components/account/ApiKeyCard.tsx
 * @desc /me "API key" card: create a key, show it once (Copy, "I've saved it"), then only its
 *       prefix and dates. Regenerate and revoke each ask first, inline, as magnet removal does.
 *       Every transition unmounts the clicked button, so focus is moved to a sensible target
 *       (the revealed key, the next primary button, or the confirm's first button) and the
 *       outcome is announced in the polite `status` live region.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { Button, Card, fieldClasses } from "@haruhimemoe/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { API_DOCS_PATH } from "@/constants/api";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import type { ApiKeyCreated, ApiKeyInfo } from "@/schemas/api";
import { formatShortDate } from "@/utils/date";

type ApiKeyCardProps = {
  initial: ApiKeyInfo | null;
  createKey?: () => Promise<ApiKeyCreated>;
  revokeKey?: () => Promise<void>;
};

/**
 * Where to send focus after the next render, once the DOM it targets exists. "existing" is the
 * Regenerate button: the next primary action after creating, saving, or cancelling a regenerate
 * confirm. "revokeTrigger" is the Revoke button, targeted only when cancelling its own confirm.
 */
type FocusTarget = "reveal" | "existing" | "empty" | "confirmFirst" | "revokeTrigger" | null;

export function ApiKeyCard({
  initial,
  createKey = packsApi.createApiKey,
  revokeKey = packsApi.revokeApiKey,
}: ApiKeyCardProps) {
  const [apiKey, setApiKey] = useState<ApiKeyInfo | null>(initial);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"regenerate" | "revoke" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pendingFocus, setPendingFocus] = useState<FocusTarget>(null);

  const revealedInputRef = useRef<HTMLInputElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const regenerateButtonRef = useRef<HTMLButtonElement>(null);
  const revokeButtonRef = useRef<HTMLButtonElement>(null);
  const confirmFirstButtonRef = useRef<HTMLButtonElement>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (pendingFocus === null) return;
    const targets: Record<Exclude<FocusTarget, null>, HTMLElement | null> = {
      reveal: revealedInputRef.current,
      existing: regenerateButtonRef.current,
      empty: createButtonRef.current,
      confirmFirst: confirmFirstButtonRef.current,
      revokeTrigger: revokeButtonRef.current,
    };
    targets[pendingFocus]?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  const run = async (action: () => Promise<void>, fallback: string) => {
    // `busy` disables buttons only after a render; two clicks in one frame must not both run.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirming(null);
    } catch (cause) {
      setError(cause instanceof PacksApiError ? cause.message : fallback);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const made = await createKey();
      setApiKey(made.apiKey);
      setRevealed(made.key);
      setStatus("API key created. Copy it now; it won't be shown again.");
      setPendingFocus("reveal");
    }, "Couldn't make a key. Try again.");

  const revoke = () =>
    run(async () => {
      await revokeKey();
      setApiKey(null);
      setStatus("API key revoked.");
      setPendingFocus("empty");
    }, "Couldn't revoke the key. Try again.");

  const copy = async () => {
    if (revealed === null) return;
    try {
      await navigator.clipboard.writeText(revealed);
      setStatus("Key copied.");
    } catch {
      setStatus("Couldn't copy. Select the key and copy it by hand.");
    }
  };

  const saved = () => {
    setRevealed(null);
    setStatus("Key saved.");
    setPendingFocus("existing");
  };

  const openConfirm = (which: "regenerate" | "revoke") => () => {
    setConfirming(which);
    setPendingFocus("confirmFirst");
  };

  const cancelConfirm = () => {
    setPendingFocus(confirming === "revoke" ? "revokeTrigger" : "existing");
    setConfirming(null);
  };

  const confirm = (question: string, yes: string, onYes: () => Promise<void>) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-c3 text-sm">{question}</span>
      <Button ref={confirmFirstButtonRef} variant="ghost" onClick={cancelConfirm} disabled={busy}>
        Keep it
      </Button>
      <Button variant="secondary" onClick={onYes} disabled={busy}>
        {yes}
      </Button>
    </div>
  );

  return (
    <Card title="API key">
      <p className="text-c3 text-sm">
        Scripts and bots can use a key to read public packs and manage yours. Anyone with the key
        can change your packs, so keep it secret.{" "}
        <Link href={API_DOCS_PATH} className="text-h1 underline hover:text-c1">
          Read the API docs
        </Link>
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {revealed !== null ? (
          <>
            <p className="font-bold text-c1 text-sm">Copy your key now. You won't see it again.</p>
            <input
              ref={revealedInputRef}
              readOnly
              value={revealed}
              aria-label="Your new API key"
              className={fieldClasses("font-mono")}
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={copy}>
                Copy
              </Button>
              <Button variant="ghost" onClick={saved}>
                I've saved it
              </Button>
            </div>
          </>
        ) : apiKey === null ? (
          <Button
            ref={createButtonRef}
            variant="secondary"
            className="self-start"
            onClick={create}
            disabled={busy}
          >
            Create API key
          </Button>
        ) : (
          <>
            <p className="text-c2 text-sm">
              <code className="font-mono text-c1">{apiKey.prefix}…</code> Created{" "}
              {formatShortDate(apiKey.createdAt)}.{" "}
              {apiKey.lastUsedAt
                ? `Last used ${formatShortDate(apiKey.lastUsedAt)}.`
                : "Not used yet."}
            </p>
            {confirming === "regenerate" ? (
              confirm("Your current key stops working right away.", "Yes, regenerate", create)
            ) : confirming === "revoke" ? (
              confirm(
                "Revoke this key? Anything using it stops working right away.",
                "Yes, revoke",
                revoke,
              )
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  ref={regenerateButtonRef}
                  variant="secondary"
                  onClick={openConfirm("regenerate")}
                  disabled={busy}
                >
                  Regenerate
                </Button>
                <Button
                  ref={revokeButtonRef}
                  variant="ghost"
                  onClick={openConfirm("revoke")}
                  disabled={busy}
                >
                  Revoke
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <output aria-live="polite" className="mt-2 block text-c3 text-sm">
        {status}
      </output>
      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * @file src/components/account/ApiKeyCard.tsx
 * @desc /me "API key" card: create a key, show it once (ApiKeyReveal), then only its prefix and
 *       dates. Regenerate and revoke each ask first with @haruhimemoe/ui's InlineConfirm, which
 *       keeps focus on its own buttons. When a step swaps what the card shows, focus moves to the
 *       revealed key or the next primary button, and the outcome is announced in the polite
 *       `status` live region.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import { Button, Card, InlineConfirm, Notice, Text, TextLink, textClasses } from "@haruhimemoe/ui";
import { useEffect, useRef, useState } from "react";
import { ApiKeyReveal } from "@/components/account/ApiKeyReveal";
import { API_DOCS_PATH } from "@/constants/api";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import type { ApiKeyCreated, ApiKeyInfo } from "@/schemas/api";
import { formatShortDate } from "@/utils/date";

type ApiKeyCardProps = {
  initial: ApiKeyInfo | null;
  createKey?: () => Promise<ApiKeyCreated>;
  revokeKey?: () => Promise<void>;
};

/** Where to send focus after the next render: the revealed key, Regenerate, or Create. */
type FocusTarget = "reveal" | "existing" | "empty" | null;

/**
 * @function ApiKeyCard
 * @param props {ApiKeyCardProps} the account's key (or null), and test seams for create and revoke
 * @returns {JSX.Element} the API key card
 */
export function ApiKeyCard({
  initial,
  createKey = packsApi.createApiKey,
  revokeKey = packsApi.revokeApiKey,
}: ApiKeyCardProps) {
  const [apiKey, setApiKey] = useState<ApiKeyInfo | null>(initial);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pendingFocus, setPendingFocus] = useState<FocusTarget>(null);

  const revealedInputRef = useRef<HTMLInputElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const regenerateRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (pendingFocus === null) return;
    const targets: Record<Exclude<FocusTarget, null>, HTMLElement | null | undefined> = {
      reveal: revealedInputRef.current,
      existing: regenerateRef.current?.querySelector("button"),
      empty: createButtonRef.current,
    };
    targets[pendingFocus]?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  /** Runs one action at a time; a failure sets the error and rejects, so a confirm stays open. */
  const run = async (action: () => Promise<void>, fallback: string) => {
    // `busy` disables buttons only after a render; two clicks in one frame must not both run.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof PacksApiError ? cause.message : fallback);
      throw cause;
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

  const saved = () => {
    setRevealed(null);
    setStatus("Key saved.");
    setPendingFocus("existing");
  };

  return (
    <Card title="API key">
      <Text tone="muted">
        Scripts and bots can use a key to read public packs and manage yours. Anyone with the key
        can change your packs, so keep it secret.{" "}
        <TextLink href={API_DOCS_PATH}>Read the API docs</TextLink>
      </Text>
      <div className="mt-3 flex flex-col gap-3">
        {revealed !== null ? (
          <ApiKeyReveal apiKey={revealed} onSaved={saved} inputRef={revealedInputRef} />
        ) : apiKey === null ? (
          <Button
            ref={createButtonRef}
            variant="secondary"
            onClick={() => create().catch(() => undefined)}
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
            <div ref={regenerateRef} className="flex flex-wrap items-center gap-2">
              <InlineConfirm
                trigger="Regenerate"
                triggerProps={{ disabled: busy }}
                question="Your current key stops working right away."
                cancelLabel="Keep it"
                confirmLabel="Yes, regenerate"
                onConfirm={create}
              />
              <InlineConfirm
                trigger="Revoke"
                triggerProps={{ variant: "ghost", disabled: busy }}
                question="Revoke this key? Anything using it stops working right away."
                cancelLabel="Keep it"
                confirmLabel="Yes, revoke"
                onConfirm={revoke}
              />
            </div>
          </>
        )}
      </div>
      <output
        aria-live="polite"
        className={textClasses({ tone: "muted", className: "mt-2 block" })}
      >
        {status}
      </output>
      {error ? (
        <Notice tone="error" live className="font-bold">
          {error}
        </Notice>
      ) : null}
    </Card>
  );
}

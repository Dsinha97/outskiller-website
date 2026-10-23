"use client";

import { useActionState, useState } from "react";
import { createInvite, createResetLink, type LinkResult } from "@/app/actions/admin";

function CopyBox({ url, message }: { url: string; message: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="note" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontWeight: 500, color: "var(--fg)" }}>Copy it now. Only a fingerprint is stored, so this link can&apos;t be shown again.</span>
      <code className="mono" style={{ wordBreak: "break-all", fontSize: 12 }}>{url}</code>
      <button
        type="button"
        className="btn btn-fill btn-sm"
        style={{ alignSelf: "flex-start" }}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy message for WhatsApp / Discord"}
      </button>
    </div>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState<LinkResult, FormData>(createInvite, undefined);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label className="field" style={{ flex: "1 1 200px" }}>
          Label
          <input name="label" defaultValue="Team invite" maxLength={60} />
        </label>
        <label className="field" style={{ width: 120 }}>
          Valid for (days)
          <input name="days" type="number" min={1} max={14} defaultValue={4} />
        </label>
        <label className="field" style={{ width: 120 }}>
          Max sign-ups
          <input name="maxUses" type="number" min={1} max={50} defaultValue={10} />
        </label>
      </div>
      <button className="btn btn-fill" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Creating…" : "Create invite link"}
      </button>
      {state?.url && <CopyBox url={state.url} message={`Join the Outskiller AI Collusion Sprint workspace: ${state.url}`} />}
    </form>
  );
}

export function ResetLinkButton({ userId, name }: { userId: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  return url ? (
    <CopyBox url={url} message={`${name}, here's your password reset link for Outskiller Sprint HQ (works once, for 2 days): ${url}`} />
  ) : (
    <button type="button" className="linkbtn" onClick={async () => setUrl((await createResetLink(userId))?.url ?? null)}>
      Reset link
    </button>
  );
}

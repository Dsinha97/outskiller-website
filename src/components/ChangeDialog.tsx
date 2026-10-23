"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitChange, type ActionResult } from "@/app/actions/content";

type Field = "title" | "body" | "url" | "question" | "note-only";
type Props = {
  label: string;
  heading: string;
  kind: string;
  itemId?: number;
  type?: "edit" | "new" | "flag";
  fields?: Field[];
  initial?: { title?: string; body?: string; url?: string; question?: string };
  isAdmin?: boolean;
  className?: string;
};

/** "Suggest edit" / "Suggest new" / "Flag an issue": members propose, admins may publish directly. */
export function ChangeDialog({ label, heading, kind, itemId, type = itemId ? "edit" : "new", fields = ["title", "body"], initial = {}, isAdmin, className = "linkbtn" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ActionResult, FormData>(submitChange, undefined);
  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => ref.current?.close(), 1200);
      return () => clearTimeout(t);
    }
  }, [state]);
  const flag = type === "flag";
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog ref={ref} className="sheet" aria-label={heading}>
        <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h2 className="display" style={{ fontSize: 24 }}>{heading}</h2>
            <button type="button" className="linkbtn" onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="type" value={type} />
          {itemId ? <input type="hidden" name="itemId" value={itemId} /> : null}
          {!flag && fields.includes("title") && (
            <label className="field">
              Title
              <input name="title" defaultValue={initial.title} required={!itemId} maxLength={200} />
            </label>
          )}
          {!flag && fields.includes("question") && (
            <label className="field">
              Research question
              <input name="data.question" defaultValue={initial.question} />
            </label>
          )}
          {!flag && fields.includes("url") && (
            <label className="field">
              Link
              <input name="data.url" type="url" defaultValue={initial.url} placeholder="https://" />
            </label>
          )}
          {!flag && fields.includes("body") && (
            <label className="field">
              Text
              <textarea name="body" defaultValue={initial.body} rows={10} />
              <span className="hint">Markdown: **bold**, *italic*, [link](https://…), - lists.</span>
            </label>
          )}
          <label className="field">
            {flag ? "What's wrong?" : "Note for the reviewer"}
            <textarea name="note" rows={3} style={{ minHeight: 80, fontFamily: "inherit", fontSize: 14 }} required={flag} placeholder={flag ? "Wrong figure, broken link, outdated claim…" : "Why this change? Cite the source if it's a factual claim."} />
          </label>
          {isAdmin && !flag && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" name="direct" style={{ accentColor: "var(--fill)" }} /> Publish directly (admin)
            </label>
          )}
          {state?.error && <p className="error" role="alert">{state.error}</p>}
          {state?.ok && <p className="ok" role="status">{state.ok}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-quiet" onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button className="btn btn-fill" disabled={pending}>
              {pending ? "Sending…" : flag ? "Flag it" : "Submit"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

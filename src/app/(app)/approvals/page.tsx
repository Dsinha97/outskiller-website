import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { approveSuggestion, rejectSuggestion } from "@/app/actions/content";
import { db, schema } from "@/db";
import { itemHref } from "@/lib/data";
import { requireAdmin } from "@/lib/session";
import { fmt } from "@/lib/time";

export const metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

const STATUSES = ["pending", "approved", "rejected"] as const;

/** Line-level diff: lines only in the old text are struck, lines only in the new one are marked. */
function LineDiff({ before, after }: { before: string; after: string }) {
  const a = before.split("\n");
  const b = after.split("\n");
  const inB = new Set(b);
  const inA = new Set(a);
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 12 }}>
      <div>
        <span className="eyebrow">Current</span>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: "6px 0 0", fontFamily: "var(--font-mono)" }}>
          {a.map((l, i) => (
            <div key={i} style={inB.has(l) ? undefined : { background: "var(--del-bg)", color: "var(--del-fg)", textDecoration: "line-through" }}>{l || " "}</div>
          ))}
        </pre>
      </div>
      <div>
        <span className="eyebrow">Proposed</span>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: "6px 0 0", fontFamily: "var(--font-mono)" }}>
          {b.map((l, i) => (
            <div key={i} style={inA.has(l) ? undefined : { background: "var(--ins-bg)", color: "var(--ins-fg)" }}>{l || " "}</div>
          ))}
        </pre>
      </div>
    </div>
  );
}

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const me = await requireAdmin();
  const { status: raw } = await searchParams;
  const status = (STATUSES as readonly string[]).includes(raw ?? "") ? raw! : "pending";
  const d = await db();
  const rows = await d.select().from(schema.suggestions).where(eq(schema.suggestions.status, status)).orderBy(desc(schema.suggestions.createdAt)).limit(50);
  const itemIds = rows.map((r) => r.itemId).filter((x): x is number => x !== null);
  const [current, people] = await Promise.all([
    itemIds.length ? d.select().from(schema.items).where(inArray(schema.items.id, itemIds)) : Promise.resolve([]),
    d.select({ id: schema.users.id, name: schema.users.name }).from(schema.users),
  ]);
  const byId = new Map(current.map((c) => [c.id, c]));
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 14 }}>
        <div style={{ flex: "1 1 380px", display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow">Admin</span>
          <h1 className="display h1">Approvals</h1>
          <p className="sub">Suggestions wait here until an admin approves them. Every approval becomes a new version, and the item&apos;s history keeps the old one.</p>
        </div>
        <nav className="tabs" aria-label="Filter">
          {STATUSES.map((s) => (
            <Link key={s} href={`/approvals?status=${s}`} aria-current={status === s ? "page" : undefined} style={{ textTransform: "capitalize" }}>
              {s}
            </Link>
          ))}
        </nav>
      </header>

      {rows.length === 0 && <p className="muted">Nothing {status}.</p>}
      {rows.map((s) => {
        const cur = s.itemId ? byId.get(s.itemId) : undefined;
        const p = s.proposed;
        const dataKeys = Object.keys(p.data ?? {});
        return (
          <article key={s.id} className="card" style={{ gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="eyebrow">
                  {s.type === "flag" ? "Flag" : s.itemId ? "Edit" : "New"} · {s.kind}
                </span>
                <h2 className="display" style={{ fontSize: 22, fontWeight: 400 }}>{p.title ?? cur?.title ?? "Untitled"}</h2>
                <span className="muted">
                  {nameOf.get(s.authorId) ?? "Someone"} · {fmt(s.createdAt, me.tz)}
                  {cur ? ` · v${cur.version} → v${cur.version + 1}` : ""}
                </span>
              </div>
              {cur && <Link href={itemHref(cur.kind, cur.slug)} style={{ fontSize: 13 }}>View the page →</Link>}
            </div>

            {s.note && (
              <p className="note">
                <b style={{ color: "var(--fg)" }}>{s.type === "flag" ? "Reported problem:" : "Note from the suggester:"}</b> {s.note}
              </p>
            )}

            {s.type !== "flag" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {p.title !== undefined && cur && p.title !== cur.title && (
                  <p>
                    <span className="eyebrow">Title</span>
                    <br />
                    <span style={{ background: "var(--del-bg)", color: "var(--del-fg)", textDecoration: "line-through", padding: "1px 6px", borderRadius: 3 }}>{cur.title}</span>{" "}
                    <span style={{ background: "var(--ins-bg)", color: "var(--ins-fg)", padding: "1px 6px", borderRadius: 3 }}>{p.title}</span>
                  </p>
                )}
                {dataKeys.map((k) => (
                  <p key={k}>
                    <span className="eyebrow">{k}</span>
                    <br />
                    {cur && String(cur.data[k] ?? "") ? <span style={{ background: "var(--del-bg)", color: "var(--del-fg)", textDecoration: "line-through", padding: "1px 6px", borderRadius: 3, marginRight: 6 }}>{String(cur.data[k])}</span> : null}
                    <span style={{ background: "var(--ins-bg)", color: "var(--ins-fg)", padding: "1px 6px", borderRadius: 3, wordBreak: "break-all" }}>{String(p.data![k]) || "(empty)"}</span>
                  </p>
                ))}
                {p.body !== undefined && p.body !== (cur?.body ?? "") && <LineDiff before={cur?.body ?? ""} after={p.body} />}
              </div>
            )}

            {s.status === "pending" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <form action={approveSuggestion.bind(null, s.id)} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label className="field" style={{ flex: "1 1 240px", fontWeight: 400, fontSize: 12, color: "var(--muted)" }}>
                    Reply to the suggester (optional)
                    <input name="reply" placeholder="Thanks, merged." />
                  </label>
                  <button className="btn btn-fill">{s.type === "flag" ? "Mark resolved" : "Approve"}</button>
                  <button className="btn btn-quiet" formAction={rejectSuggestion.bind(null, s.id)} style={{ color: "var(--stamp)" }}>
                    {s.type === "flag" ? "Dismiss" : "Reject"}
                  </button>
                </form>
                {s.type !== "flag" && (
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--accent)" }}>Edit, then approve</summary>
                    <form action={approveSuggestion.bind(null, s.id)} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                      <input type="hidden" name="edited" value="1" />
                      <label className="field">
                        Title
                        <input name="title" defaultValue={p.title ?? cur?.title ?? ""} />
                      </label>
                      {dataKeys.map((k) => (
                        <label key={k} className="field">
                          {k}
                          <input name={`data.${k}`} defaultValue={String(p.data![k] ?? "")} />
                        </label>
                      ))}
                      <label className="field">
                        Text
                        <textarea name="body" defaultValue={p.body ?? cur?.body ?? ""} rows={10} />
                      </label>
                      <button className="btn btn-fill" style={{ alignSelf: "flex-start" }}>Save and approve</button>
                    </form>
                  </details>
                )}
              </div>
            ) : (
              <p className="muted">
                {s.status === "approved" ? "Approved" : "Rejected"} by {s.reviewerId ? nameOf.get(s.reviewerId) : "an admin"}
                {s.reviewedAt ? ` · ${fmt(s.reviewedAt, me.tz)}` : ""}
                {s.reply ? ` · "${s.reply}"` : ""}
              </p>
            )}
          </article>
        );
      })}
    </>
  );
}

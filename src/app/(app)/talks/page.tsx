import Link from "next/link";
import { ChangeDialog } from "@/components/ChangeDialog";
import { Markdown } from "@/components/Markdown";
import { getItem, listItems } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { fmt, fmtDay, untilLabel } from "@/lib/time";

export const metadata = { title: "Sprint talks" };
export const dynamic = "force-dynamic";

export default async function TalksPage() {
  const me = await requireUser();
  const isAdmin = me.role === "admin";
  const [talks, meaning] = await Promise.all([listItems("talk"), getItem("note", "what-the-talks-mean")]);
  const now = Date.now();
  const sorted = [...talks].sort((a, b) => String(a.data.startsAt ?? "").localeCompare(String(b.data.startsAt ?? "")));
  const days = new Map<string, typeof sorted>();
  sorted.forEach((t) => {
    const key = t.data.startsAt ? fmtDay(String(t.data.startsAt), me.tz) : "Unscheduled";
    days.set(key, [...(days.get(key) ?? []), t]);
  });

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow">{talks.length} sessions · times in your zone</span>
          <h1 className="display h1">
            Sprint <em>talks</em>
          </h1>
          <p className="sub" style={{ maxWidth: "62ch" }}>
            All talks are on Zoom; RSVP on each talk&apos;s Luma page for the link. After a talk, add notes with <b>Suggest notes</b>. They go live once Deepayan or Liezl approves them.
          </p>
        </div>
        <ChangeDialog label="Suggest a talk" heading="Add a talk or session" kind="talk" type="new" fields={["title", "body"]} isAdmin={isAdmin} className="btn btn-line" />
      </header>

      {[...days.entries()].map(([day, list]) => (
        <section key={day} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="eyebrow">{day}</h2>
          {list.map((t) => {
            const at = t.data.startsAt ? String(t.data.startsAt) : null;
            const past = at ? new Date(at).getTime() < now : false;
            return (
              <article key={t.id} id={t.slug} className="card" style={{ gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
                  <span className="eyebrow">
                    {at ? fmt(at, me.tz) : ""}
                    {t.data.minutes ? ` · ${t.data.minutes} min` : ""}
                    {at && !past ? ` · in ${untilLabel(at, now)}` : past ? " · held" : ""}
                  </span>
                  <span className="muted">{String(t.data.affiliation ?? "")}</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>{t.title}</h3>
                {t.data.note ? <p className="callout">{String(t.data.note)}</p> : null}
                {t.body ? (
                  <details open={past}>
                    <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--accent)" }}>Notes and takeaways</summary>
                    <Markdown>{t.body}</Markdown>
                  </details>
                ) : (
                  <p className="muted">{past ? "No notes yet. Add what you heard." : "Notes go here after the talk."}</p>
                )}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
                  {((t.data.people as string[]) ?? []).map((p) => (
                    <Link key={p} href={`/library/${p}`}>Speaker page</Link>
                  ))}
                  {((t.data.papers as string[]) ?? []).map((p) => (
                    <Link key={p} href={`/library/${p}`}>Their paper</Link>
                  ))}
                  {t.data.wiki ? <Link href={`/library/${String(t.data.wiki)}`}>Wiki notes</Link> : null}
                  {!t.data.event && (
                    <ChangeDialog label={t.body ? "Suggest edit" : "Suggest notes"} heading={`Notes: ${t.title}`} kind="talk" itemId={t.id} fields={["title", "body"]} initial={{ title: t.title, body: t.body }} isAdmin={isAdmin} />
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ))}

      {meaning && (
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2>{meaning.title}</h2>
            <ChangeDialog label="Suggest edit" heading="What the talks mean for us" kind="note" itemId={meaning.id} initial={{ title: meaning.title, body: meaning.body }} isAdmin={isAdmin} />
          </div>
          <Markdown>{meaning.body}</Markdown>
        </section>
      )}
    </>
  );
}

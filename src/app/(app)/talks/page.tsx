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
            All talks are on Zoom; RSVP on each talk&apos;s Luma page for the link. After a talk, add notes with <b>Suggest notes</b> and the recording with <b>Add links</b>. Changes go live after admin approval.
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
            const link = String(t.data.link ?? "");
            const recording = String(t.data.recording ?? "");
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
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--accent)" }}>Notes and takeaways</summary>
                    <Markdown>{t.body}</Markdown>
                  </details>
                ) : t.data.event ? null : (
                  <p className="muted">{past ? "No notes yet. Add what you heard." : "Notes go here after the talk."}</p>
                )}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, alignItems: "baseline" }}>
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer">
                      {t.data.event ? "Event page ↗" : "Talk page ↗"}
                    </a>
                  ) : null}
                  {recording ? (
                    <a href={recording} target="_blank" rel="noreferrer">
                      <b>Recording ↗</b>
                    </a>
                  ) : past && (!t.data.event || t.data.recorded) ? (
                    <span className="muted">No recording yet</span>
                  ) : null}
                  {((t.data.people as string[]) ?? []).map((p) => (
                    <Link key={p} href={`/library/${p}`}>Speaker page</Link>
                  ))}
                  {((t.data.papers as string[]) ?? []).map((p) => (
                    <Link key={p} href={`/library/${p}`}>Their paper</Link>
                  ))}
                  {t.data.wiki ? <Link href={`/library/${String(t.data.wiki)}`}>Wiki notes</Link> : null}
                  <ChangeDialog
                    label="Add links"
                    heading={`Links: ${t.title}`}
                    kind="talk"
                    itemId={t.id}
                    fields={past ? ["link", "recording"] : ["link"]}
                    initial={{ link, recording }}
                    isAdmin={isAdmin}
                  />
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

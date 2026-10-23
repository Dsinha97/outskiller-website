import Link from "next/link";
import { asc } from "drizzle-orm";
import { setCheckOwner, setDecision, toggleCheck } from "@/app/actions/team";
import { BudgetEstimator } from "@/components/BudgetEstimator";
import { ChangeDialog } from "@/components/ChangeDialog";
import { WorkflowTimeline } from "@/components/WorkflowTimeline";
import { db, schema } from "@/db";
import { listItems, members } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { DEADLINE, fmt, zoneName } from "@/lib/time";

export const metadata = { title: "Workflow & decisions" };
export const dynamic = "force-dynamic";

const short = (tz: string) => zoneName(tz).replace(/ (Standard|Daylight) Time$/, "").replace(/ Time$/, "");

export default async function WorkflowPage() {
  const me = await requireUser();
  const isAdmin = me.role === "admin";
  const d = await db();
  const [phases, talks, links, people, decisions, checks] = await Promise.all([
    listItems("phase"),
    listItems("talk"),
    listItems("link"),
    members(),
    d.select().from(schema.decisions).orderBy(asc(schema.decisions.sort)),
    d.select().from(schema.checklist).orderBy(asc(schema.checklist.sort)),
  ]);
  const active = people.filter((p) => !p.disabled);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const groupsMap = new Map<string, string[]>();
  active.forEach((p) => groupsMap.set(p.tz, [...(groupsMap.get(p.tz) ?? []), p.name.split(" ")[0]]));
  const groups = [...groupsMap.entries()].map(([tz, names]) => ({ tz, label: `${names.join(" + ")} · ${short(tz)}` }));

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="eyebrow">Fri Oct 23 – Sun Oct 25</span>
        <h1 className="display h1">
          Workflow &amp; <em>decisions</em>
        </h1>
        <p className="sub">
          Times follow your profile location{me.city ? ` (${me.city})` : ""}. Switch zones to see a teammate&apos;s view. <Link href="/me">Change location</Link>
        </p>
      </header>

      <WorkflowTimeline
        myTz={me.tz}
        myLabel={short(me.tz)}
        nowIso={new Date().toISOString()}
        deadline={DEADLINE}
        groups={groups}
        phases={phases.map((p) => ({ slug: p.slug, title: p.title, body: p.body.replace(/\*\*/g, ""), note: String(p.data.note ?? ""), startsAt: String(p.data.startsAt), endsAt: String(p.data.endsAt) }))}
        talks={talks.filter((t) => t.data.startsAt).map((t) => ({ slug: t.slug, title: t.data.event ? t.title : String(t.data.speaker ?? t.title), startsAt: String(t.data.startsAt), event: Boolean(t.data.event) }))}
      />

      <section className="card" aria-label="Logistics" style={{ padding: 0, gap: 0 }}>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, borderBottom: "1px solid var(--line2)" }}>
          <h2 style={{ fontSize: 15 }}>Logistics</h2>
          <ChangeDialog label="Suggest a link" heading="Add a logistics link" kind="link" type="new" fields={["title", "url", "body"]} isAdmin={isAdmin} />
        </div>
        {links.map((l) => (
          <div key={l.id} className="linkrow">
            <b style={{ fontWeight: 500 }}>{l.title}</b>
            <span className="sub">{l.body}</span>
            <span style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: 13 }}>
              {l.data.url ? (
                <a href={String(l.data.url)} target="_blank" rel="noopener noreferrer">Open ↗</a>
              ) : (
                <span className="muted">link not added yet</span>
              )}
              <ChangeDialog label={l.data.url ? "Edit" : "Add link"} heading={`Edit: ${l.title}`} kind="link" itemId={l.id} fields={["title", "url", "body"]} initial={{ title: l.title, url: String(l.data.url ?? ""), body: l.body }} isAdmin={isAdmin} />
            </span>
          </div>
        ))}
      </section>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", alignItems: "start" }}>
        <section className="card" aria-label="Decisions">
          <h2 style={{ fontSize: 15 }}>Decisions board</h2>
          <div>
            {decisions.map((dec) => (
              <div key={dec.key} className="row" style={{ flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontWeight: 500 }}>{dec.label}</span>
                  <span className="muted">{dec.by ? `${nameOf.get(dec.by) ?? "Someone"} · ${fmt(dec.at!, me.tz)}` : "Undecided"}</span>
                </div>
                {dec.key === "angle" ? (
                  <span className="sub">
                    {dec.value ?? "Set by the plan poll"} · <Link href="/angles">Plan poll</Link>
                  </span>
                ) : (
                  <form action={setDecision.bind(null, dec.key)} style={{ display: "flex", gap: 6 }}>
                    {dec.options.length ? (
                      <select name="value" defaultValue={dec.value ?? ""} className="input" style={{ flex: 1, minWidth: 0 }} aria-label={dec.label}>
                        <option value="">Undecided</option>
                        {dec.options.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input name="value" defaultValue={dec.value ?? ""} className="input" style={{ flex: 1, minWidth: 0 }} aria-label={dec.label} />
                    )}
                    <button className="btn btn-quiet btn-sm" style={{ height: 42 }}>Set</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="card" aria-label="Submission checklist" id="submission">
          <h2 style={{ fontSize: 15 }}>Submission checklist</h2>
          <div>
            {checks.map((c) => (
              <div key={c.id} className="row" style={{ alignItems: "center", gap: 10 }}>
                <form action={toggleCheck.bind(null, c.id)}>
                  <button type="submit" role="checkbox" aria-checked={c.done} aria-label={c.label} style={{ width: 20, height: 20, borderRadius: 3, border: "1px solid var(--accent)", background: c.done ? "var(--fill)" : "transparent", color: "var(--on-fill)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {c.done ? "✓" : ""}
                  </button>
                </form>
                <span style={{ flex: 1, textDecoration: c.done ? "line-through" : "none", color: c.done ? "var(--muted)" : "inherit" }}>{c.label}</span>
                <form action={setCheckOwner.bind(null, c.id)} style={{ display: "flex", gap: 4 }}>
                  <select name="owner" defaultValue={c.ownerId ?? ""} className="input" style={{ minHeight: 32, fontSize: 12, maxWidth: 120 }} aria-label={`Owner of ${c.label}`}>
                    <option value="">Owner</option>
                    {active.map((p) => (
                      <option key={p.id} value={p.id}>{p.name.split(" ")[0]}</option>
                    ))}
                  </select>
                  <button className="linkbtn" style={{ fontSize: 12 }}>Set</button>
                </form>
              </div>
            ))}
          </div>
          <span className="muted">
            From the wiki&apos;s <Link href="/library/sprint/submission-requirements">submission requirements</Link> · <Link href="/library/sprint/judging-rubric">judging rubric</Link>
          </span>
        </section>
      </div>

      <BudgetEstimator cap={Number(decisions.find((x) => x.key === "budget")?.value ?? 50)} />
    </>
  );
}

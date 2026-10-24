import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { ChangeDialog } from "@/components/ChangeDialog";
import { Markdown } from "@/components/Markdown";
import { PilotStatus } from "@/components/PilotStatus";
import { db, schema } from "@/db";
import { currentPoll, listItems } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Team Project" };
export const dynamic = "force-dynamic";

export default async function ProjectPage() {
  const me = await requireUser();
  const poll = await currentPoll(me.id);
  if (poll?.poll.status !== "decided") redirect("/angles");
  const d = await db();
  const [angles, roles, decisions, links] = await Promise.all([
    listItems("angle", "team_project"),
    d.select().from(schema.roleCells),
    d.select().from(schema.decisions).orderBy(asc(schema.decisions.sort)),
    listItems("link"),
  ]);
  const leads = new Map<string, string[]>();
  roles.filter((r) => r.value === "L").forEach((r) => leads.set(r.pkg, [...(leads.get(r.pkg) ?? []), r.person]));

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="eyebrow">Team Project · selected from the plan poll</span>
        <h1 className="display h1">{poll.winner?.label}</h1>
        <p className="sub">
          The other angles are in the <Link href="/angles/archive">archive</Link>. Suggest edits on each card; they go live after admin approval.
        </p>
      </header>

      {angles.map((a) => (
        <article key={a.id} className="card pick1">
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span className="idbox">{a.slug.toUpperCase()}</span>
            {((a.data.tracks as string[]) ?? []).map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
            <span className="chip gold">Team Project</span>
          </div>
          <h2 className="display" style={{ fontSize: 28, fontWeight: 300 }}>{a.title}</h2>
          <Markdown>{a.body}</Markdown>
          <ChangeDialog label="Suggest edit" heading={`Edit angle ${a.slug.toUpperCase()}`} kind="angle" itemId={a.id} fields={["title", "question", "body"]} initial={{ title: a.title, question: String(a.data.question ?? ""), body: a.body }} isAdmin={me.role === "admin"} />
        </article>
      ))}

      <PilotStatus />

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", alignItems: "start" }}>
        <section className="card">
          <h2 style={{ fontSize: 15 }}>Who leads what</h2>
          <div>
            {[...leads.entries()].map(([pkg, names]) => (
              <div key={pkg} className="row" style={{ justifyContent: "space-between" }}>
                <span>{pkg}</span>
                <span className="muted">{names.join(" & ")}</span>
              </div>
            ))}
          </div>
          <Link href="/team" style={{ fontSize: 13 }}>Edit the role matrix →</Link>
        </section>
        <section className="card">
          <h2 style={{ fontSize: 15 }}>Decisions</h2>
          <div>
            {decisions.map((dec) => (
              <div key={dec.key} className="row" style={{ justifyContent: "space-between" }}>
                <span>{dec.label}</span>
                <span className="muted" style={{ textAlign: "right" }}>{dec.value ?? "Undecided"}</span>
              </div>
            ))}
          </div>
          <Link href="/workflow" style={{ fontSize: 13 }}>Open the workflow →</Link>
        </section>
        <section className="card">
          <h2 style={{ fontSize: 15 }}>Links</h2>
          <div>
            {links.map((l) => (
              <div key={l.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>{l.title}</span>
                {l.data.url ? (
                  <a href={String(l.data.url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>Open ↗</a>
                ) : (
                  <span className="muted">not added yet</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

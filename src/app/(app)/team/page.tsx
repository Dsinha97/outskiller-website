import { cycleRole } from "@/app/actions/team";
import { ChangeDialog } from "@/components/ChangeDialog";
import { Markdown } from "@/components/Markdown";
import { db, schema } from "@/db";
import { getItem, listItems } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Team & roles" };
export const dynamic = "force-dynamic";

const PEOPLE = ["Liezl", "Carl", "Deepayan", "Prashanth", "Vidhya"];
const LABEL: Record<string, string> = { L: "Lead", S: "Support", "-": "–" };

export default async function TeamPage() {
  const me = await requireUser();
  const isAdmin = me.role === "admin";
  const d = await db();
  const [people, cells, engineering] = await Promise.all([listItems("person"), d.select().from(schema.roleCells), getItem("note", "engineering")]);
  const pkgs = [...new Set(cells.map((c) => c.pkg))];
  const cell = (pkg: string, person: string) => cells.find((c) => c.pkg === pkg && c.person === person)?.value ?? "-";

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="eyebrow">Five people · three time zones</span>
        <h1 className="display h1">
          Who brings <em>what</em>
        </h1>
        <p className="sub">Drawn from public profiles and what we&apos;ve shared. Suggest a correction on any card.</p>
      </header>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(330px, 100%), 1fr))" }}>
        {people.map((p) => (
          <article key={p.id} className="card">
            <span className="eyebrow">{String(p.data.location ?? "")}</span>
            <h2 className="display" style={{ fontSize: 24, fontWeight: 400 }}>{p.title}</h2>
            <Markdown>{p.body}</Markdown>
            {p.data.suggested ? <span className="chip" style={{ alignSelf: "flex-start", whiteSpace: "normal" }}>{String(p.data.suggested)}</span> : null}
            <ChangeDialog label="Suggest a correction" heading={`Edit: ${p.title}`} kind="person" itemId={p.id} initial={{ title: p.title, body: p.body }} isAdmin={isAdmin} />
          </article>
        ))}
      </section>

      <section className="card" aria-label="Role matrix">
        <h2 style={{ fontSize: 15 }}>Role matrix</h2>
        <p className="muted">Click a cell to cycle Lead → Support → –. Changes are shared with the whole team.</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--muted)", fontWeight: 500 }}>Work package</th>
                {PEOPLE.map((p) => (
                  <th key={p} style={{ padding: "8px 6px", color: "var(--muted)", fontWeight: 500 }}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pkgs.map((pkg) => (
                <tr key={pkg} style={{ borderTop: "1px solid var(--line2)" }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 400 }}>{pkg}</th>
                  {PEOPLE.map((person) => {
                    const v = cell(pkg, person);
                    return (
                      <td key={person} style={{ padding: 4, textAlign: "center" }}>
                        <form action={cycleRole.bind(null, pkg, person)}>
                          <button
                            aria-label={`${pkg}, ${person}: ${LABEL[v]}. Change`}
                            style={{ width: "100%", height: 34, borderRadius: 3, border: "1px solid var(--line2)", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: v === "L" ? 600 : 400, background: v === "L" ? "var(--fill)" : v === "S" ? "var(--chip)" : "transparent", color: v === "L" ? "var(--on-fill)" : v === "S" ? "var(--on-chip)" : "var(--muted)" }}
                          >
                            {LABEL[v]}
                          </button>
                        </form>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {engineering && (
        <p className="note">
          <b style={{ color: "var(--fg)" }}>On engineering:</b> {engineering.body}
        </p>
      )}
    </>
  );
}
